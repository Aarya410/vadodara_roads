# Vadodara AI Road Management - Phase 1/2 pipeline

Deferred (hooks in config.yaml): DEM waterlogging, rainfall features, ML failure prediction, NLP, optimiser, web dashboard.

## Inputs you must supply (no synthetic data is generated)
- `data/raw/wards/`            VMC ward boundary (.shp/.geojson/.gpkg)
- `data/raw/yolo_dataset/`     Roboflow YOLO export (train/valid/test + data.yaml)
- Mapillary token (`MAPILLARY_TOKEN`) or your own geotagged street images + meta.csv (id,lat,lon,captured_at,url)

## Run
pip install -r requirements.txt
cd src
python s01_build_basemap.py
python s02_train_detector.py
python s03_fetch_mapillary.py
python s04_detect_geotag.py
python s05_hotspots_and_risk.py

## Outputs (outputs/)
road_risk.geojson, hotspots.geojson, ward_ranking.csv

## Known limits
- Severity is bounding-box share of the image, a proxy, not real area/depth.
- Without traffic data, "traffic importance" is an OSM road-class proxy.
- Consecutive Mapillary frames can see the same pothole; DBSCAN hotspots reduce but don't eliminate double counting.
- Unimaged roads show zero potholes, not "no potholes", so scores depend on imagery coverage.

## Dataset notes (IndiaRDD2022 YOLOv8 export: 875 train / 434 valid images, 914 boxes, 1 class "0")
- Sample boxes mix potholes with larger patches of cracked/ravelled surface, so the model is a general road-damage detector, not pothole-only. Treat counts as "damage detections".
- Images are 640x640 dashcam views from mostly rural/highway roads; expect a domain gap on urban Vadodara street imagery. Check results on real Mapillary frames before trusting scores.
- The ward file's coordinates were stored (lat, lon); s01 auto-corrects this. It has 12 wards - confirm that matches the VMC wards you need.
