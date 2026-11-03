"""Step 2: fine-tune YOLO on the Roboflow/RDD2022 export (YOLO format)."""
import shutil
from ultralytics import YOLO
from common import cfg, ROOT, p

def main():
    c = cfg(); d = c["detector"]
    data = ROOT / c["paths"]["yolo_data_yaml"]
    if not data.exists():
        raise SystemExit(f"{data} not found - unzip the Roboflow export into data/raw/yolo_dataset/")
    import yaml
    fixed = data.parent / "data_local.yaml"   # Roboflow's yaml uses ../train paths that break when unzipped here
    y = yaml.safe_load(open(data)); y.update({"path": str(data.parent.resolve()), "train": "train/images", "val": "valid/images"})
    y.pop("test", None); yaml.safe_dump(y, open(fixed, "w")); data = fixed
    model = YOLO(d["base_model"])
    model.train(data=str(data), epochs=d["epochs"], imgsz=d["imgsz"], project=str(ROOT / "models"), name="train", exist_ok=True)
    best = ROOT / "models" / "train" / "weights" / "best.pt"
    shutil.copy(best, p(c["paths"]["model_weights"]))
    metrics = model.val(data=str(data))
    print("mAP50:", metrics.box.map50, "mAP50-95:", metrics.box.map)

if __name__ == "__main__":
    main()
