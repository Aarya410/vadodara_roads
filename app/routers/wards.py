"""Ward risk & planning data router."""
import json, math
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas import WardRisk, WardRiskList, PriorityLevel

router = APIRouter(prefix="/api/wards", tags=["wards"])

ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "outputs"

# ── Budget / labour constants (based on MoRTH / Gujarat PWD SoR) ─────────────
#  Labour: 1 person handles ~0.015 km of critical road per day
#  ₹ per km by priority level (adjusted for realistic municipal maintenance):
COST_PER_KM = {
    PriorityLevel.critical: 18_00_000,   # ₹ 18 lakh/km  (full resurfacing)
    PriorityLevel.high:     10_00_000,   # ₹ 10 lakh/km  (major patching)
    PriorityLevel.medium:    5_00_000,   # ₹  5 lakh/km  (moderate patching)
    PriorityLevel.low:       2_00_000,   # ₹  2 lakh/km  (minor repairs)
}
LABOUR_PER_KM = {
    PriorityLevel.critical: 12,
    PriorityLevel.high:      8,
    PriorityLevel.medium:    5,
    PriorityLevel.low:       2,
}
DAYS_PER_KM = {
    PriorityLevel.critical: 10,
    PriorityLevel.high:      7,
    PriorityLevel.medium:    4,
    PriorityLevel.low:       2,
}


def _priority(risk: float) -> PriorityLevel:
    if risk >= 75:
        return PriorityLevel.critical
    if risk >= 50:
        return PriorityLevel.high
    if risk >= 25:
        return PriorityLevel.medium
    return PriorityLevel.low


def _compute_planning(km: float, critical_km: float, risk_mean: float):
    """Return labour, budget (₹ lakh), days for a ward."""
    p = _priority(risk_mean)
    budget = (km * COST_PER_KM[p]) / 1_00_000          # → lakh
    labour = math.ceil(km * LABOUR_PER_KM[p])
    days   = math.ceil(km * DAYS_PER_KM[p] / max(labour / 8, 1))
    return labour, round(budget, 2), days


async def _load_from_db(db):
    """Return the latest run's ward list from MongoDB."""
    run = await db.pipeline_runs.find_one(
        {"status": "done"},
        sort=[("finished_at", -1)]
    )
    if not run:
        return None
    records = await db.ward_risks.find({"run_id": str(run["_id"])}).to_list(100)
    if not records:
        return None
    wards = []
    for i, r in enumerate(records, 1):
        wards.append(WardRisk(
            ward=r["ward"],
            ward_no=r.get("ward_no", i),
            risk_mean=r["risk_mean"],
            potholes=int(r["potholes"]),
            km=round(r["km"], 2),
            critical_km=round(r.get("critical_km", 0), 2),
            priority_rank=i,
            priority_level=_priority(r["risk_mean"]),
            labour_required=r.get("labour_required", 0),
            budget_estimate_lakh=r.get("budget_estimate_lakh", 0.0),
            estimated_days=r.get("estimated_days", 0),
            last_updated=r.get("last_updated"),
        ))
    return WardRiskList(
        wards=wards,
        run_id=str(run["_id"]),
        generated_at=run.get("finished_at", datetime.now(timezone.utc)),
        total_km=round(sum(w.km for w in wards), 2),
        total_budget_lakh=round(sum(w.budget_estimate_lakh for w in wards), 2),
        total_potholes=sum(w.potholes for w in wards),
    )


def _load_from_csv() -> WardRiskList | None:
    """Fallback: load ward_ranking.csv produced by pipeline step 5."""
    csv_path = OUTPUTS / "ward_ranking.csv"
    if not csv_path.exists():
        return None
    import csv
    rows = []
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    if not rows:
        return None

    WARD_NOS = {
        "Nyay Mandir": 1, "Harni": 2, "Waghodia": 3, "Pratap Nagar": 4,
        "Raopura": 5, "Akota": 6, "Fatehgunj": 7, "Tin Rasta": 8,
        "Ajwa": 9, "Subhanpura": 10, "Vasna": 11, "Makarpura": 12,
    }

    wards = []
    for i, r in enumerate(rows, 1):
        ward_name = r.get("ward", r.get("", f"Ward {i}"))
        risk = float(r.get("risk_mean", 0))
        km   = float(r.get("km", 0))
        crit_km = float(r.get("critical_km", 0))
        potholes = int(float(r.get("potholes", 0)))
        labour, budget, days = _compute_planning(km, crit_km, risk)
        wards.append(WardRisk(
            ward=ward_name,
            ward_no=WARD_NOS.get(ward_name, i),
            risk_mean=round(risk, 2),
            potholes=potholes,
            km=round(km, 2),
            critical_km=round(crit_km, 2),
            priority_rank=i,
            priority_level=_priority(risk),
            labour_required=labour,
            budget_estimate_lakh=budget,
            estimated_days=days,
            last_updated=None,
        ))

    run_id = "csv-fallback"
    return WardRiskList(
        wards=wards,
        run_id=run_id,
        generated_at=datetime.now(timezone.utc),
        total_km=round(sum(w.km for w in wards), 2),
        total_budget_lakh=round(sum(w.budget_estimate_lakh for w in wards), 2),
        total_potholes=sum(w.potholes for w in wards),
    )


@router.get("/risk/constrained")
async def get_ward_risk_constrained(current_user=Depends(get_current_user)):
    """Return ward risk ranking with resource-constrained planning."""
    # Temporarily return unconstrained data - constraints stored in localStorage
    db = get_db()
    data = await _load_from_db(db)
    if not data:
        csv_data = _load_from_csv()
        if csv_data:
            data = csv_data
        else:
            raise HTTPException(404, "No pipeline results yet. Run the pipeline first.")
    return data


@router.get("/risk", response_model=WardRiskList)
async def get_ward_risk(current_user=Depends(get_current_user)):
    """Return ward risk ranking with planning data."""
    db = get_db()
    data = await _load_from_db(db)
    if data:
        return data
    # fallback to CSV from last pipeline run
    csv_data = _load_from_csv()
    if csv_data:
        return csv_data
    raise HTTPException(404, "No pipeline results yet. Run the pipeline first.")


@router.get("/risk/{ward_no}", response_model=WardRisk)
async def get_ward_detail(ward_no: int, current_user=Depends(get_current_user)):
    """Single ward detail."""
    db = get_db()
    data = await _load_from_db(db)
    if not data:
        data = _load_from_csv()
    if not data:
        raise HTTPException(404, "No data available")
    for w in data.wards:
        if w.ward_no == ward_no:
            return w
    raise HTTPException(404, f"Ward {ward_no} not found")


@router.get("/geojson/roads")
async def get_roads_geojson(current_user=Depends(get_current_user)):
    """Serve road risk GeoJSON."""
    path = OUTPUTS / "road_risk.geojson"
    if not path.exists():
        raise HTTPException(404, "GeoJSON not generated yet. Run the pipeline.")
    with open(path) as f:
        return json.load(f)


@router.get("/geojson/hotspots")
async def get_hotspots_geojson(current_user=Depends(get_current_user)):
    """Serve hotspot GeoJSON."""
    path = OUTPUTS / "hotspots.geojson"
    if not path.exists():
        raise HTTPException(404, "Hotspots GeoJSON not generated yet.")
    with open(path) as f:
        return json.load(f)


@router.get("/geojson/wards")
async def get_wards_geojson():
    """Public: ward boundary GeoJSON."""
    path = ROOT / "data" / "raw" / "wards" / "wards_vadodara.geojson"
    if not path.exists():
        raise HTTPException(404, "Ward file missing")
    with open(path) as f:
        return json.load(f)
