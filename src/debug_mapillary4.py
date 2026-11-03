import os, requests, mercantile
from dotenv import load_dotenv
from common import ROOT, cfg
from s03_fetch_mapillary import tile_images
load_dotenv(ROOT / ".env", override=True)
tok = os.environ["MAPILLARY_TOKEN"]
b = cfg()["mapillary"]["bbox"]

feats = []
for t in mercantile.tiles(b["west"], b["south"], b["east"], b["north"], 14):
    feats, _ = tile_images(t, tok)
    if feats:
        break
f = feats[0]
print("properties:", {k: (v if k != "id" else f"{v!r} ({type(v).__name__})") for k, v in f["properties"].items()})
iid = int(f["properties"]["id"])

def show(label, **kw):
    r = requests.get(f"https://graph.mapillary.com/{iid}", timeout=60, **kw)
    print(f"\n== {label} -> HTTP {r.status_code}\n{r.text[:300].replace(tok, '***')}")

for fld in ["id,geometry", "thumb_1024_url", "thumb_2048_url", "thumb_original_url"]:
    show(f"query token, fields={fld}", params={"access_token": tok, "fields": fld})
show("header token, fields=thumb_1024_url",
     params={"fields": "thumb_1024_url"}, headers={"Authorization": f"OAuth {tok}"})