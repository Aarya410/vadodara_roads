"""Step 3: download geotagged street-level images from Mapillary.

Uses the documented coverage vector tiles (zoom 14) to find images, then
fetches each image's thumbnail URL.  Run with --control to test the token
against Berlin (which has dense coverage) before blaming Vadodara.
"""
import os, sys, csv, random, requests, mercantile
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from tqdm import tqdm
from vt2geojson.tools import vt_bytes_to_geojson
from common import cfg, ROOT

load_dotenv(ROOT / ".env", override=True)
TILE_URL = "https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token={t}"
IMG_URL = "https://graph.mapillary.com/{id}"


def tile_images(tile, token):
    """Return (list of image point features, error text or None) for one z14 tile."""
    r = requests.get(TILE_URL.format(z=tile.z, x=tile.x, y=tile.y, t=token), timeout=60)
    if r.status_code != 200:
        return [], f"HTTP {r.status_code}: {r.text[:200].replace(token, '***')}"
    try:
        gj = vt_bytes_to_geojson(r.content, tile.x, tile.y, tile.z, layer="image")
    except Exception:          # tile has no 'image' layer = no coverage
        return [], None
    return [f for f in gj["features"] if not f["properties"].get("is_pano")], None


def main():
    c = cfg(); m = c["mapillary"]; b = m.get("bbox", c["bbox"])
    token = os.environ.get(m["token_env"])
    if not token:
        raise SystemExit("MAPILLARY_TOKEN not found - check your .env file.")

    if "--control" in sys.argv:
        feats, err = tile_images(mercantile.tile(13.405, 52.52, 14), token)
        print("Berlin control tile -> images:", len(feats), "| error:", err)
        return

    out_dir = ROOT / c["paths"]["mapillary_dir"]; out_dir.mkdir(parents=True, exist_ok=True)
    tiles = list(mercantile.tiles(b["west"], b["south"], b["east"], b["north"], 14))
    rng = random.Random(42)

    picked, with_cov, total, first_err = [], 0, 0, None
    for t in tqdm(tiles, desc="coverage tiles"):
        feats, err = tile_images(t, token)
        first_err = first_err or err
        if feats:
            with_cov += 1; total += len(feats)
            picked += rng.sample(feats, min(m.get("per_tile_limit", 6), len(feats)))
    print(f"Tiles with coverage: {with_cov}/{len(tiles)} | image points found: {total}")
    if first_err:
        print("First tile error:", first_err)
    if not picked:
        raise SystemExit("No images found in the area. Run with --control to test the token.")

    rng.shuffle(picked)
    picked = picked[: m["max_images"]]

    def fetch(f):
        iid = int(f["properties"]["id"])
        dest = out_dir / f"{iid}.jpg"
        lon, lat = f["geometry"]["coordinates"][:2]
        try:
            if not dest.exists():
                r = requests.get(IMG_URL.format(id=iid), params={
                    "access_token": token, "fields": "thumb_1024_url"}, timeout=60)
                url = r.json().get("thumb_1024_url")
                if not url:
                    return None
                dest.write_bytes(requests.get(url, timeout=60).content)
            return (iid, lat, lon, f["properties"].get("captured_at"))
        except Exception:
            return None

    with ThreadPoolExecutor(8) as ex:
        rows = [r for r in tqdm(ex.map(fetch, picked), total=len(picked), desc="download") if r]

    with open(out_dir / "meta.csv", "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["id", "lat", "lon", "captured_at"]); w.writerows(rows)
    print(f"{len(rows)} images downloaded -> {out_dir}")


if __name__ == "__main__":
    main()