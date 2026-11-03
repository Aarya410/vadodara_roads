"""Step 1: OSM road network + VMC wards + schools/hospitals -> basemap.gpkg"""
import glob, numpy as np, geopandas as gpd, osmnx as ox
from shapely.ops import transform as shp_transform
from common import cfg, p, bbox_tuple, ROOT

ROAD_IMPORTANCE = {  # traffic/road-importance proxy until real traffic data exists
    "motorway": 100, "trunk": 95, "primary": 85, "secondary": 70, "tertiary": 55,
    "unclassified": 35, "residential": 25, "living_street": 15, "service": 10,
}

def norm_hw(v):
    v = v[0] if isinstance(v, (list, tuple)) else v
    return str(v).replace("_link", "")

def main():
    c = cfg(); crs = c["metric_crs"]
    G = ox.graph_from_bbox(bbox_tuple(c), network_type="drive")
    edges = ox.graph_to_gdfs(G, nodes=False).reset_index(drop=True)
    edges["highway"] = edges["highway"].map(norm_hw)
    edges = edges[["highway", "name", "length", "geometry"]].copy()
    edges["name"] = edges["name"].astype(str)
    edges["seg_id"] = np.arange(len(edges))
    edges["importance"] = edges["highway"].map(ROAD_IMPORTANCE).fillna(20)
    edges = edges.to_crs(crs)
    edges["length_m"] = edges.length

    wd = ROOT / c["paths"]["wards_dir"]
    files = [f for ext in ("*.shp", "*.geojson", "*.gpkg") for f in glob.glob(str(wd / ext))]
    if not files:
        raise SystemExit("No ward file found in %s - add the VMC ward boundary first." % c["paths"]["wards_dir"])
    wards = gpd.read_file(files[0])
    minx, miny, maxx, maxy = wards.total_bounds
    if miny > 60 and maxx < 40:  # coordinates stored as (lat, lon): swap to (lon, lat)
        print("Ward file has swapped lat/lon axes - correcting")
        wards["geometry"] = wards.geometry.map(lambda g: shp_transform(lambda x, y, z=None: (y, x), g))
    wards = wards.set_crs(c["wgs84"], allow_override=True).to_crs(crs)
    print("Ward columns:", list(wards.columns))
    name_col = next((pref for pref in ("ward_name", "name", "ward", "ward_no", "wardno")
                     for k in wards.columns if k.lower() == pref), wards.columns[0])  # priority order, not column order
    wards = wards.rename(columns={name_col: "ward"})[["ward", "geometry"]]

    pts = edges.copy(); pts["geometry"] = edges.geometry.interpolate(0.5, normalized=True)
    edges["ward"] = gpd.sjoin(pts, wards, how="left", predicate="within").groupby(level=0)["ward"].first().values

    poi = ox.features_from_bbox(bbox_tuple(c), tags={"amenity": ["school", "hospital", "clinic", "college"]})
    poi = poi.to_crs(crs); poi["geometry"] = poi.geometry.representative_point()
    nearest = gpd.sjoin_nearest(pts[["seg_id", "geometry"]], poi[["geometry"]], how="left", distance_col="d_poi")
    edges = edges.merge(nearest.groupby("seg_id")["d_poi"].min().rename("dist_poi_m"), on="seg_id", how="left")

    out = p(c["paths"]["basemap"])
    edges.to_file(out, layer="roads", driver="GPKG")
    wards.to_file(out, layer="wards", driver="GPKG")
    poi[["geometry"]].to_file(out, layer="poi", driver="GPKG")
    print(f"Saved {len(edges)} road segments, {len(wards)} wards, {len(poi)} POIs -> {out}")

if __name__ == "__main__":
    main()
