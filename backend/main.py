import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import engine, Base, ensure_sqlite_schema

from backend.routers import (
    engagements, scope, assets, notes, tool_output,
    screenshots, phases, findings, credentials,
    checklists, activity_log, tags, assistant, nmap_import, burp_import, reports,
    engagement_io, app_settings, chat_history, code_scanner, semgrep,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR.parent / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
REPORT_DIR = DATA_DIR / "reports"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema()
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
app.include_router(burp_import.router, prefix="/api")

app.include_router(reports.router, prefix="/api")
app.include_router(engagement_io.router, prefix="/api")
app.include_router(app_settings.router, prefix="/api")
app.include_router(chat_history.router, prefix="/api")
app.include_router(code_scanner.router, prefix="/api")
app.include_router(semgrep.router, prefix="/api")

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
