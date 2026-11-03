"""Pipeline trigger & status router.

Runs the 5-step pipeline asynchronously via asyncio subprocess and
streams logs into MongoDB for live status polling.
"""
import asyncio, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from bson import ObjectId
from app.database import get_db
from app.dependencies import require_engineer
from app.schemas import PipelineRunOut

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

ROOT  = Path(__file__).resolve().parents[2]
SRC   = ROOT / "src"
STEPS = ["s01_build_basemap.py", "s02_train_detector.py",
         "s03_fetch_mapillary.py", "s04_detect_geotag.py",
         "s05_hotspots_and_risk.py"]

# Steps that need the Mapillary token (skip if not set)
MAPILLARY_STEPS = {"s03_fetch_mapillary.py", "s04_detect_geotag.py"}


async def _run_pipeline(run_id: str):
    db = get_db()
    logs = []

    async def _append(line: str):
        logs.append(line)
        await db.pipeline_runs.update_one(
            {"_id": ObjectId(run_id)},
            {"$set": {"log_tail": "\n".join(logs[-120:])}}
        )

    from app.config import settings
    has_mapillary = bool(settings.mapillary_token)

    for step in STEPS:
        if step in MAPILLARY_STEPS and not has_mapillary:
            await _append(f"[SKIP] {step} – MAPILLARY_TOKEN not set")
            continue

        if step == "s02_train_detector.py" and (ROOT / "models" / "pothole_best.pt").exists():
            await _append(f"[SKIP] {step} - models/pothole_best.pt already exists")
            continue

        await _append(f"[RUN] {step}")
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(SRC / step),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(SRC),
        )
        async for raw in proc.stdout:
            await _append(raw.decode(errors="replace").rstrip())

        await proc.wait()
        if proc.returncode != 0:
            await _append(f"[FAIL] {step} exited {proc.returncode}")
            await db.pipeline_runs.update_one(
                {"_id": ObjectId(run_id)},
                {"$set": {"status": "failed", "finished_at": datetime.now(timezone.utc)}}
            )
            return

        await _append(f"[OK] {step}")

    # Ingest ward_ranking.csv into MongoDB
    await _append("[INFO] Ingesting results into MongoDB …")
    csv_path = ROOT / "outputs" / "ward_ranking.csv"
    if csv_path.exists():
        import csv, math
        from app.routers.wards import _compute_planning, _priority

        WARD_NOS = {
            "Nyay Mandir": 1, "Harni": 2, "Waghodia": 3, "Pratap Nagar": 4,
            "Raopura": 5, "Akota": 6, "Fatehgunj": 7, "Tin Rasta": 8,
            "Ajwa": 9, "Subhanpura": 10, "Vasna": 11, "Makarpura": 12,
        }
        with open(csv_path) as f:
            rows = list(csv.DictReader(f))
        await db.ward_risks.delete_many({"run_id": run_id})
        docs = []
        for r in rows:
            ward_name = r.get("ward", "")
            risk = float(r.get("risk_mean", 0))
            km   = float(r.get("km", 0))
            crit = float(r.get("critical_km", 0))
            pot  = int(float(r.get("potholes", 0)))
            labour, budget, days = _compute_planning(km, crit, risk)
            docs.append({
                "run_id": run_id,
                "ward": ward_name,
                "ward_no": WARD_NOS.get(ward_name, 0),
                "risk_mean": round(risk, 3),
                "potholes": pot,
                "km": round(km, 3),
                "critical_km": round(crit, 3),
                "labour_required": labour,
                "budget_estimate_lakh": budget,
                "estimated_days": days,
                "last_updated": datetime.now(timezone.utc),
            })
        if docs:
            await db.ward_risks.insert_many(docs)
            await _append(f"[INFO] Stored {len(docs)} ward records in MongoDB")

    await db.pipeline_runs.update_one(
        {"_id": ObjectId(run_id)},
        {"$set": {"status": "done", "finished_at": datetime.now(timezone.utc)}}
    )
    await _append("[DONE] Pipeline completed successfully!")


def _run_out(r: dict) -> PipelineRunOut:
    return PipelineRunOut(
        id=str(r["_id"]),
        status=r["status"],
        started_at=r["started_at"],
        finished_at=r.get("finished_at"),
        triggered_by=r.get("triggered_by", "unknown"),
        log_tail=r.get("log_tail"),
    )


@router.post("/run", response_model=PipelineRunOut, status_code=202)
async def trigger_pipeline(
    background_tasks: BackgroundTasks,
    current_user=Depends(require_engineer),
):
    db = get_db()
    # Allow only one run at a time
    running = await db.pipeline_runs.find_one({"status": "running"})
    if running:
        raise HTTPException(409, "A pipeline run is already in progress")

    doc = {
        "status": "running",
        "started_at": datetime.now(timezone.utc),
        "triggered_by": current_user.get("email", "unknown"),
        "log_tail": "Pipeline queued …",
    }
    result = await db.pipeline_runs.insert_one(doc)
    run_id = str(result.inserted_id)
    background_tasks.add_task(_run_pipeline, run_id)
    doc["_id"] = result.inserted_id
    return _run_out(doc)


@router.get("/runs", response_model=list[PipelineRunOut])
async def list_runs(current_user=Depends(require_engineer)):
    db = get_db()
    runs = await db.pipeline_runs.find({}).sort("started_at", -1).to_list(20)
    return [_run_out(r) for r in runs]


@router.get("/runs/{run_id}", response_model=PipelineRunOut)
async def get_run(run_id: str, current_user=Depends(require_engineer)):
    db = get_db()
    run = await db.pipeline_runs.find_one({"_id": ObjectId(run_id)})
    if not run:
        raise HTTPException(404, "Run not found")
    return _run_out(run)
