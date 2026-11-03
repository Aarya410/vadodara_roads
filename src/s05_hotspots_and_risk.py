"""Step 5: DBSCAN hotspots + 0-100 priority score per road segment + ward ranking."""
import numpy as np, pandas as pd, geopandas as gpd
from sklearn.cluster import DBSCAN
from common import cfg, p, ROOT

def capscale(s, q=0.95):
    # Most segments have no detections, so take the percentile over segments that DO have some;
    # otherwise the 95th percentile is 0 and pothole density would be ignored completely.
    nz = s[s > 0]
    if nz.empty:
        return s * 0
    hi = nz.quantile(q)
    return (s.clip(upper=hi) / hi * 100).fillna(0)

def main():
    c = cfg(); crs = c["metric_crs"]; h = c["hotspots"]
    roads = gpd.read_file(ROOT / c["paths"]["basemap"], layer="roads")
    det = gpd.read_file(ROOT / c["paths"]["detections"]).to_crs(crs)
    pot = det[det.is_pothole].copy()
    if pot.empty: raise SystemExit("No pothole detections to score.")

    xy = np.c_[pot.geometry.x, pot.geometry.y]
    pot["cluster"] = DBSCAN(eps=h["eps_m"], min_samples=h["min_samples"]).fit_predict(xy)  # -1 = noise
    grp = pot[pot.cluster >= 0]
    hot = grp.dissolve(by="cluster", aggfunc={"conf": "mean", "area_frac": "mean"})
    hot["n_potholes"] = grp.groupby("cluster").size()
    hot["geometry"] = hot.geometry.convex_hull.buffer(15)

    snap = gpd.sjoin_nearest(pot[["geometry", "area_frac"]], roads[["seg_id", "geometry"]],
                             how="inner", max_distance=h["snap_distance_m"])
    snap = snap[~snap.index.duplicated()]
    per = snap.groupby("seg_id").agg(n_potholes=("area_frac", "size"), sev=("area_frac", "mean"))
    roads = roads.merge(per, on="seg_id", how="left").fillna({"n_potholes": 0, "sev": 0})
    roads["potholes_per_km"] = roads.n_potholes / (roads.length_m / 1000).clip(lower=0.05)

    comp = {"pothole_density": capscale(roads.potholes_per_km),
            "traffic_importance": roads.importance,
            "complaints_proximity": (1 - roads.dist_poi_m.clip(upper=500).fillna(500) / 500) * 100}
    on = [k for k in c["enabled_components"] if k in comp]
    w = pd.Series({k: c["weights"][k] for k in on}); w /= w.sum()
    roads["risk"] = sum(comp[k] * w[k] for k in on)
    t = c["classes"]
    roads["priority"] = pd.cut(roads.risk, [-1, t["medium"], t["high"], t["critical"], 101],
                               labels=["Low", "Medium", "High", "Critical"])
    print("Components used (renormalised weights):", w.round(3).to_dict())

    roads["critical_len"] = np.where(roads.priority == "Critical", roads.length_m, 0)
    roads["risk_x_len"] = roads.risk * roads.length_m
    g = roads.groupby("ward")
    wards = pd.DataFrame({"risk_mean": g.risk_x_len.sum() / g.length_m.sum(), "potholes": g.n_potholes.sum(),
                          "km": g.length_m.sum() / 1000, "critical_km": g.critical_len.sum() / 1000})
    wards = wards.sort_values("risk_mean", ascending=False)

    out = p(c["paths"]["outputs"] + "/x").parent
    roads.drop(columns=["critical_len", "risk_x_len"]).to_crs(c["wgs84"]).to_file(out / "road_risk.geojson", driver="GeoJSON")
    hot.to_crs(c["wgs84"]).to_file(out / "hotspots.geojson", driver="GeoJSON")
    wards.to_csv(out / "ward_ranking.csv")
    print(wards.head(10))

if __name__ == "__main__":
    main()