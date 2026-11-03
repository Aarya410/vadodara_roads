"""Pydantic models / schemas for the API."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    engineer = "engineer"
    viewer = "viewer"


class PriorityLevel(str, Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.viewer
    employee_id: Optional[str] = None
    department: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    employee_id: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Ward / Road risk ──────────────────────────────────────────────────────────
class WardRisk(BaseModel):
    ward: str
    ward_no: int
    risk_mean: float
    potholes: int
    km: float
    critical_km: float
    priority_rank: int
    priority_level: PriorityLevel
    labour_required: int          # persons
    budget_estimate_lakh: float   # ₹ lakh
    estimated_days: int
    last_updated: Optional[datetime] = None


class WardRiskList(BaseModel):
    wards: List[WardRisk]
    run_id: str
    generated_at: datetime
    total_km: float
    total_budget_lakh: float
    total_potholes: int


# ── Maintenance Reports ───────────────────────────────────────────────────────
class ReportCreate(BaseModel):
    ward: str
    ward_no: int
    road_name: Optional[str] = None
    issue_type: str
    severity: PriorityLevel
    description: str
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    reported_by: Optional[str] = None


class ReportOut(BaseModel):
    id: str
    ward: str
    ward_no: int
    road_name: Optional[str] = None
    issue_type: str
    severity: PriorityLevel
    description: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None


# ── Pipeline run ─────────────────────────────────────────────────────────────
class PipelineRunOut(BaseModel):
    id: str
    status: str   # queued | running | done | failed
    started_at: datetime
    finished_at: Optional[datetime] = None
    triggered_by: str
    log_tail: Optional[str] = None


# ── Resource Constraints ───────────────────────────────────────────────────────
class ResourceConstraints(BaseModel):
    budget_lakh: Optional[float] = None      # Total budget available (₹ lakh)
    labour_persons: Optional[int] = None     # Total workforce available
    days_available: Optional[int] = None     # Total days available for execution
    updated_at: Optional[datetime] = None
