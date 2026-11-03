import yaml, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]

def cfg():
    with open(ROOT / "config.yaml") as f:
        return yaml.safe_load(f)

def p(rel):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

def bbox_tuple(c):  # osmnx 2.x order: west, south, east, north
    b = c["bbox"]
    return (b["west"], b["south"], b["east"], b["north"])
