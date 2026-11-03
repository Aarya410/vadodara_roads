"""VMC Road Management System — FastAPI main application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.database import get_db, close_db
from app.routers import auth, wards, reports, pipeline, analytics

ROOT_DIR  = Path(__file__).resolve().parent
STATIC_DIR = ROOT_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create MongoDB indexes on startup
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.pipeline_runs.create_index([("started_at", -1)])
    await db.ward_risks.create_index([("run_id", 1), ("ward_no", 1)])
    await db.reports.create_index([("ward_no", 1), ("created_at", -1)])
    yield
    await close_db()


app = FastAPI(
    title="VMC Road Management System",
    description="AI-powered road risk analysis and maintenance planning for Vadodara Municipal Corporation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(auth.router)
app.include_router(wards.router)
app.include_router(reports.router)
app.include_router(pipeline.router)
app.include_router(analytics.router)


@app.get("/health")
async def health_check():
    """Health check endpoint for Render and load balancers."""
    return {"status": "healthy", "service": "VMC Road Management System"}

# Serve static frontend
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # SPA fallback - serve index.html for all non-API routes
        file = STATIC_DIR / full_path
        if file.exists() and file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(STATIC_DIR / "index.html"))
