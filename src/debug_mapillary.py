import os, requests
from dotenv import load_dotenv
from common import ROOT
load_dotenv(ROOT / ".env", override=True)
tok = os.environ["MAPILLARY_TOKEN"]
URL = "https://graph.mapillary.com/images"
bbox = "73.17,22.29,73.19,22.31"   # central Vadodara, ~2 km square

def show(label, r):
    print(f"\n== {label} -> HTTP {r.status_code}")
    print(r.text[:400].replace(tok, "***"))

show("query-param token, with thumb field",
     requests.get(URL, params={"access_token": tok, "bbox": bbox, "limit": 5,
                               "fields": "id,geometry,captured_at,thumb_1024_url"}, timeout=60))
show("query-param token, id only",
     requests.get(URL, params={"access_token": tok, "bbox": bbox, "limit": 5, "fields": "id"}, timeout=60))
show("header token, id only",
     requests.get(URL, headers={"Authorization": f"OAuth {tok}"},
                  params={"bbox": bbox, "limit": 5, "fields": "id"}, timeout=60))
show("larger area (0.1 deg)",
     requests.get(URL, params={"access_token": tok, "bbox": "73.10,22.25,73.20,22.35",
                               "limit": 5, "fields": "id"}, timeout=60))