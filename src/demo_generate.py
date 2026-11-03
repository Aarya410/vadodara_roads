"""DEMO DATA generator - for screens/presentations only, NOT survey results.

What it does
  1. Places made-up damage points on your real Vadodara road network
     (random but reproducible; some wards are given more damage than others).
  2. Runs your real scoring code (s05) on them, writing to outputs_demo/.
  3. Copies outputs_demo/ into outputs/ so the site shows it.
     Your real outputs are first moved to outputs_real/ and can be restored.

Usage (from the src folder):
  python demo_generate.py            # build demo data and switch the site to it
  python demo_generate.py --restore  # put your real outputs back
"""
import sys, shutil
import numpy as np, geopandas as gpd, pandas as pd
import common

ROOT = common.ROOT
OUT, REAL, DEMO = ROOT / "outputs", ROOT / "outputs_real", ROOT / "outputs_demo"
MARKER = OUT / "DEMO_DATA.txt"          # a file in the folder, nothing is shown on the site
SEED = 7


def restore():
    if not MARKER.exists():
        print("outputs/ is not demo data - nothing to restore."); return
    shutil.rmtree(OUT)
    if REAL.exists():
        shutil.move(str(REAL), str(OUT))
    else:
        OUT.mkdir()
    print("Real outputs restored.")


def make_points(roads):
    rng = np.random.default_rng(SEED)
    roads = roads[roads.ward.notna() & (roads.length_m > 20)].copy()
    ward_factor = {w: rng.uniform(0.3, 1.8) for w in roads.ward.unique()}   # some wards much worse
    roads["w"] = roads.length_m.clip(upper=400) * roads.ward.map(ward_factor)
    roads["w"] /= roads.w.sum()

    pts = []
    centres = rng.choice(len(roads), size=450, p=roads.w.values)             # hotspot clusters
    for i in centres:
        seg = roads.iloc[i].geometry
        for _ in range(rng.poisson(6) + 3):
            pt = seg.interpolate(rng.uniform(0, 1), normalized=True)
            pts.append((pt.x + rng.normal(0, 4), pt.y + rng.normal(0, 4)))
    for i in rng.choice(len(roads), size=2500, p=roads.w.values):             # scattered single potholes
        pt = roads.iloc[i].geometry.interpolate(rng.uniform(0, 1), normalized=True)
        pts.append((pt.x + rng.normal(0, 4), pt.y + rng.normal(0, 4)))

    n = len(pts)
    g = gpd.GeoDataFrame({
        "image_id": [f"demo{k:05d}" for k in range(n)], "cls": "0", "is_pothole": True,
        "conf": rng.uniform(0.35, 0.92, n), "area_frac": rng.lognormal(-3.2, 0.6, n).clip(0.002, 0.4)},
        geometry=gpd.points_from_xy(*zip(*pts)), crs=common.cfg()["metric_crs"]).to_crs("EPSG:4326")
    g["lon"], g["lat"] = g.geometry.x, g.geometry.y
    return g


def main():
    if "--restore" in sys.argv:
        restore(); return

    c = common.cfg()
    roads = gpd.read_file(ROOT / c["paths"]["basemap"], layer="roads")
    det = make_points(roads)
    det_path = common.p("data/processed/detections_demo.gpkg")
    det.to_file(det_path, driver="GPKG")

    # run the REAL scoring code, pointed at the demo files
    orig = common.cfg
    def demo_cfg():
        cc = orig(); cc["paths"]["detections"] = "data/processed/detections_demo.gpkg"
        cc["paths"]["outputs"] = "outputs_demo"; return cc
    common.cfg = demo_cfg
    import s05_hotspots_and_risk as s05
    s05.main()

    # switch the site over (keep real outputs safe)
    if OUT.exists() and not MARKER.exists():
        if REAL.exists():
            shutil.rmtree(REAL)
        shutil.move(str(OUT), str(REAL))
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(DEMO, OUT)
    MARKER.write_text("Demo data. Run: python demo_generate.py --restore  to bring back real outputs.\n")
    print("\nDemo outputs are now in outputs/. Restart the site and refresh.")


if __name__ == "__main__":
    main()