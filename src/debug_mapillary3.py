import os, requests
from dotenv import load_dotenv
from common import ROOT
load_dotenv(ROOT / ".env", override=True)
tok = os.environ["MAPILLARY_TOKEN"]
URL = "https://graph.mapillary.com/images"

def test(label, bbox):
    r = requests.get(URL, params={"access_token": tok, "bbox": bbox, "limit": 20, "fields": "id,geometry"}, timeout=60)
    if r.status_code == 200:
        print(f"{label:<28} images: {len(r.json().get('data', []))}")
    else:
        print(f"{label:<28} HTTP {r.status_code}: {r.text[:150].replace(tok, '***')}")

test("Berlin (tiny box)",        "13.405,52.520,13.412,52.525")
test("Delhi, Connaught Place",   "77.215,28.628,77.222,28.633")
test("Bengaluru, MG Road",       "77.600,12.972,77.607,12.977")
test("Mumbai, CST",              "72.831,18.938,72.838,18.943")
test("Vadodara, Alkapuri",       "73.160,22.305,73.167,22.310")
test("Vadodara, Sayajigunj",     "73.180,22.310,73.187,22.315")
test("Vadodara, Raopura",        "73.205,22.300,73.212,22.305")