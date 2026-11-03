import os, requests, mercantile
from dotenv import load_dotenv
from common import ROOT, cfg
from s03_fetch_mapillary import tile_images
load_dotenv(ROOT / ".env", override=True)
tok = os.environ["MAPILLARY_TOKEN"]
G = "https://graph.mapillary.com"

def get(path, **params):
    params["access_token"] = tok
    r = requests.get(f"{G}/{path}", params=params, timeout=60)
    return r.status_code, r.text[:200].replace(tok, "***")

print("1) BERLIN control image")
feats, _ = tile_images(mercantile.tile(13.405, 52.52, 14), tok)
iid = int(feats[0]["properties"]["id"])
print("  id", iid, "->", get(str(iid), fields="id,thumb_1024_url"))

print("\n2) VADODARA images from the tile")
b = cfg()["mapillary"]["bbox"]
for t in mercantile.tiles(b["west"], b["south"], b["east"], b["north"], 14):
    feats, _ = tile_images(t, tok)
    if feats:
        break
for f in feats[:5]:
    iid = int(f["properties"]["id"])
    print("  id", iid, "-> HTTP", get(str(iid), fields="id,thumb_1024_url")[0])

print("\n3) Ids Mapillary lists for the first Vadodara sequence")
seq = feats[0]["properties"]["sequence_id"]
code, txt = get("image_ids", sequence_id=seq)
print("  HTTP", code, txt)