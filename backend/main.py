import json
import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import engine, Base, SessionLocal
from backend.models import Scope, ChecklistItem, Engagement

from backend.routers import (
    engagements, scope, assets, notes, tool_output,
    screenshots, phases, findings, credentials,
    checklists, activity_log, tags, assistant, nmap_import, reports,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR.parent / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
REPORT_DIR = DATA_DIR / "reports"


def _seed_checklists(db, engagement_id: int):
    """Clone default checklist items into a new engagement."""
    checklist_path = BASE_DIR / "checklists" / "defaults.json"
    if not checklist_path.exists():
        return
    with open(checklist_path) as f:
        defaults = json.load(f)
    order = 0
    for phase_name, items in defaults.items():
        for item in items:
            db.add(ChecklistItem(
                engagement_id=engagement_id,
                phase=phase_name,
                label=item.get("label", ""),
                description=item.get("description", ""),
                is_checked=False,
                sort_order=order,
            ))
            order += 1
    db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="RedLedger", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(engagements.router, prefix="/api")
app.include_router(scope.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(tool_output.router, prefix="/api")
app.include_router(screenshots.router, prefix="/api")
app.include_router(phases.router, prefix="/api")
app.include_router(findings.router, prefix="/api")
app.include_router(credentials.router, prefix="/api")
app.include_router(checklists.router, prefix="/api")
app.include_router(activity_log.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(nmap_import.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="static-assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
