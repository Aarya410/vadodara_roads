"""Step 4: run the trained detector on geotagged images -> detections.gpkg"""
import pandas as pd, geopandas as gpd
from ultralytics import YOLO
from tqdm import tqdm
from common import cfg, p, ROOT

def main():
    c = cfg(); d = c["detector"]
    meta = pd.read_csv(ROOT / c["paths"]["mapillary_dir"] / "meta.csv")
    model = YOLO(str(ROOT / c["paths"]["model_weights"]))
    pot = {n.lower() for n in d["pothole_class_names"]}
    rows = []
    for r in tqdm(meta.itertuples(), total=len(meta)):
        f = ROOT / c["paths"]["mapillary_dir"] / f"{r.id}.jpg"
        if not f.exists(): continue
        res = model.predict(str(f), conf=d["conf"], verbose=False)[0]
        h, w = res.orig_shape
        for box in res.boxes:
            cls = res.names[int(box.cls)]
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            rows.append({"image_id": r.id, "lat": r.lat, "lon": r.lon, "cls": cls,
                         "is_pothole": cls.lower() in pot, "conf": float(box.conf),
                         "area_frac": (x2 - x1) * (y2 - y1) / (w * h)})  # image-area share: severity PROXY, not real area/depth
    df = pd.DataFrame(rows)
    if df.empty: raise SystemExit("No detections found.")
    g = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.lon, df.lat), crs=c["wgs84"])
    g.to_file(p(c["paths"]["detections"]), driver="GPKG")
    print(len(g), "detections,", int(g.is_pothole.sum()), "potholes")

if __name__ == "__main__":
    main()
