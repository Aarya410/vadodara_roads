import os, requests
from dotenv import load_dotenv
from common import ROOT
load_dotenv(ROOT / ".env", override=True)
tok = os.environ["MAPILLARY_TOKEN"]
URL = "https://graph.mapillary.com/images"

def count(bbox, limit=100):
    r = requests.get(URL, params={"access_token": tok, "bbox": bbox, "limit": limit, "fields": "id"}, timeout=60)
    return len(r.json().get("data", [])) if r.status_code == 200 else f"HTTP {r.status_code}"

print("CONTROL (Berlin, should be >0):", count("13.40,52.51,13.45,52.54"))

# Vadodara in 0.05-degree blocks (area 0.0025, well under the limit)
tot = 0
for x in [73.05, 73.10, 73.15, 73.20, 73.25]:
    for y in [22.20, 22.25, 22.30, 22.35, 22.40]:
        n = count(f"{x},{y},{x+0.05},{y+0.05}")
        print(f"lon {x:.2f} lat {y:.2f}: {n}")
        if isinstance(n, int): tot += n
print("TOTAL images found (max 100 per block):", tot)