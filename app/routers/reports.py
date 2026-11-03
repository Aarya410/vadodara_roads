"""Maintenance reports router."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from app.database import get_db
from app.dependencies import get_current_user, require_engineer
from app.schemas import ReportCreate, ReportOut, PriorityLevel

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _out(r: dict) -> ReportOut:
    return ReportOut(
        id=str(r["_id"]),
        ward=r["ward"],
        ward_no=r.get("ward_no", 0),
        road_name=r.get("road_name"),
        issue_type=r["issue_type"],
        severity=r["severity"],
        description=r["description"],
        status=r.get("status", "open"),
        created_at=r["created_at"],
        resolved_at=r.get("resolved_at"),
        location_lat=r.get("location_lat"),
        location_lon=r.get("location_lon"),
    )


@router.post("/", response_model=ReportOut, status_code=201)
async def create_report(body: ReportCreate, current_user=Depends(get_current_user)):
    db = get_db()
    doc = body.model_dump()
    doc.update({
        "status": "open",
        "created_at": datetime.now(timezone.utc),
        "created_by": str(current_user["_id"]),
        "resolved_at": None,
    })
    result = await db.reports.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _out(doc)


@router.get("/", response_model=list[ReportOut])
async def list_reports(
    ward_no: Optional[int] = Query(None),
    severity: Optional[PriorityLevel] = Query(None),
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    db = get_db()
    filt = {}
    if ward_no is not None:
        filt["ward_no"] = ward_no
    if severity:
        filt["severity"] = severity
    if status:
        filt["status"] = status
    docs = await db.reports.find(filt).sort("created_at", -1).to_list(500)
    return [_out(d) for d in docs]


@router.patch("/{report_id}/status")
async def update_status(
    report_id: str,
    status: str,
    current_user=Depends(require_engineer),
):
    db = get_db()
    update = {"status": status}
    if status == "resolved":
        update["resolved_at"] = datetime.now(timezone.utc)
    result = await db.reports.update_one(
        {"_id": ObjectId(report_id)}, {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Report not found")
    return {"ok": True}


@router.delete("/{report_id}")
async def delete_report(report_id: str, current_user=Depends(require_engineer)):
    db = get_db()
    result = await db.reports.delete_one({"_id": ObjectId(report_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Report not found")
    return {"ok": True}
