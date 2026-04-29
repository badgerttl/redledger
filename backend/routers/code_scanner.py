"""Code Scanner — background LLM vulnerability analysis with job queue."""

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import AsyncIterator, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import SessionLocal, get_db
from backend.models import CodeReviewResult, ScanJob, ScanJobFile
from backend.routers.assistant import DEFAULT_TIMEOUT, _llm_base_url, _lm_studio_auth_headers

router = APIRouter(prefix="/code-scanner", tags=["code_scanner"])

# job_id → asyncio.Task (in-process only; cleared on restart)
_running_tasks: dict[int, asyncio.Task] = {}


def _scan_dir() -> str:
    return os.environ.get("SCAN_DIR", "/app/data/scan").rstrip("/")


@router.get("/config")
def get_config():
    return {"scan_dir": _scan_dir()}


def _safe_subpath(name: str) -> Path:
    base = Path(_scan_dir()).resolve()
    target = (base / name).resolve()
    if not str(target).startswith(str(base) + os.sep) and target != base:
        raise HTTPException(400, "Invalid directory name")
    return target


@router.get("/scan-directories")
def list_scan_directories():
    base = Path(_scan_dir())
    base.mkdir(parents=True, exist_ok=True)
    dirs = []
    for p in sorted(base.iterdir()):
        if p.is_dir() and not p.name.startswith("."):
            try:
                file_count = sum(1 for f in p.rglob("*") if f.is_file())
            except Exception:
                file_count = 0
            dirs.append({"name": p.name, "path": str(p), "file_count": file_count})
    return dirs


@router.post("/upload-directory")
async def upload_directory(request: Request):
    form = await request.form(max_files=50_000, max_fields=50_000)
    files = form.getlist("files")
    paths_json = form.get("paths_json", "")
    try:
        paths = json.loads(paths_json)
    except Exception:
        raise HTTPException(400, "paths_json must be a JSON array of strings")
    if not files or not paths or len(files) != len(paths):
        raise HTTPException(400, f"files={len(files)} paths={len(paths)} — must be equal and non-empty")

    first_rel = paths[0].lstrip("/")
    folder_name = Path(first_rel).parts[0] if Path(first_rel).parts else "upload"
    dest_root = _safe_subpath(folder_name)

    uploaded = 0
    skipped = 0
    for upload_file, rel_path in zip(files, paths):
        rel = Path(rel_path.lstrip("/"))
        parts = rel.parts
        sub = Path(*parts[1:]) if len(parts) > 1 else Path(parts[0])
        if any(part in ("..", "") for part in sub.parts):
            skipped += 1
            continue
        target = dest_root / sub
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            content = await upload_file.read()
            target.write_bytes(content)
            uploaded += 1
        except Exception:
            skipped += 1

    return {"folder": folder_name, "path": str(dest_root), "uploaded": uploaded, "skipped": skipped}


@router.delete("/scan-directory/{name}", status_code=204)
def delete_scan_directory(name: str):
    target = _safe_subpath(name)
    if not target.exists():
        raise HTTPException(404, f"Directory not found: {name}")
    if not target.is_dir():
        raise HTTPException(400, "Not a directory")
    shutil.rmtree(target)


SCAN_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rs", ".rb", ".php",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala", ".sh", ".bash",
    ".ps1", ".yaml", ".yml", ".json", ".xml", ".html", ".css", ".sql",
    ".tf", ".hcl", ".toml", ".ini", ".cfg", ".env",
}

SKIP_DIRS = {
    "node_modules", "__pycache__", "venv", ".venv", "dist", "build",
    ".git", ".svn", "target", "vendor", "coverage", ".next", ".nuxt",
    ".mypy_cache", ".pytest_cache", "eggs", ".eggs",
}

MAX_FILE_SIZE = 100_000  # 100 KB


class DirectoryRequest(BaseModel):
    path: str


class FileRequest(BaseModel):
    path: str


@router.post("/list-files")
def list_files(body: DirectoryRequest):
    p = Path(body.path.strip()).expanduser()
    if not p.exists():
        raise HTTPException(400, f"Path does not exist: {body.path}")
    if not p.is_dir():
        raise HTTPException(400, f"Not a directory: {body.path}")

    files = []
    for f in sorted(p.rglob("*")):
        if not f.is_file():
            continue
        if f.suffix.lower() not in SCAN_EXTENSIONS:
            continue
        rel = f.relative_to(p)
        parts = rel.parts
        if any(part.startswith(".") or part in SKIP_DIRS for part in parts):
            continue
        size = f.stat().st_size
        files.append({
            "path": str(f),
            "relative_path": str(rel),
            "size": size,
            "skippable": size > MAX_FILE_SIZE,
        })

    return {"files": files, "base_path": str(p)}


@router.post("/read-file")
def read_file(body: FileRequest):
    p = Path(body.path.strip()).expanduser()
    if not p.exists() or not p.is_file():
        raise HTTPException(400, f"File not found: {body.path}")
    size = p.stat().st_size
    if size > MAX_FILE_SIZE:
        raise HTTPException(400, f"File exceeds {MAX_FILE_SIZE // 1000} KB limit.")
    try:
        content = p.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(500, f"Could not read file: {e}")
    return {"content": content, "path": str(p)}


# ── Background LLM runner ─────────────────────────────────────────────────────

async def _call_llm_full(base_url: str, auth_headers: dict, model: str,
                          system_prompt: str, filename: str, content: str) -> str:
    messages = []
    if system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    messages.append({"role": "user", "content": f"File: `{filename}`\n\n```\n{content}\n```"})

    payload = {"model": model, "messages": messages, "stream": True}
    upstream = f"{base_url}/v1/chat/completions"

    parts = []
    carry = ""
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        async with client.stream(
            "POST", upstream, json=payload,
            headers={"Content-Type": "application/json", "Accept": "text/event-stream", **auth_headers},
        ) as resp:
            if resp.status_code >= 400:
                err = (await resp.aread()).decode(errors="replace")[:800]
                raise RuntimeError(f"LLM {resp.status_code}: {err}")
            async for raw in resp.aiter_bytes():
                carry += raw.decode(errors="replace")
                while "\n" in carry:
                    line, carry = carry.split("\n", 1)
                    line = line.rstrip("\r")
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                        delta = (obj.get("choices") or [{}])[0].get("delta", {}).get("content") or ""
                        if delta:
                            parts.append(delta)
                    except Exception:
                        pass
    return "".join(parts)


async def _run_scan_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        while True:
            db.expire_all()
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if not job:
                return

            if job.status == "cancelled":
                for f in job.files:
                    if f.status == "pending":
                        f.status = "cancelled"
                db.commit()
                return

            next_file = next((f for f in job.files if f.status == "pending"), None)
            if not next_file:
                job.status = "done"
                db.commit()
                return

            next_file.status = "running"
            db.commit()

            base_url = _llm_base_url()
            auth_headers = _lm_studio_auth_headers()

            try:
                content = next_file.inline_content or ""
                if not content and next_file.file_path:
                    p = Path(next_file.file_path)
                    content = p.read_text(encoding="utf-8", errors="replace")
                if not content:
                    raise ValueError("No source content")

                full_text = await _call_llm_full(
                    base_url, auth_headers, job.model, job.system_prompt,
                    next_file.filename, content,
                )

                result = CodeReviewResult(
                    engagement_id=job.engagement_id,
                    filename=next_file.filename,
                    content=full_text,
                )
                db.add(result)
                db.flush()
                next_file.status = "done"
                next_file.result_id = result.id
                db.commit()

            except asyncio.CancelledError:
                db.expire_all()
                db.query(ScanJobFile).filter(ScanJobFile.id == next_file.id).update(
                    {"status": "cancelled"}
                )
                db.query(ScanJob).filter(ScanJob.id == job_id).update({"status": "cancelled"})
                db.commit()
                raise

            except Exception as e:
                db.expire_all()
                db.query(ScanJobFile).filter(ScanJobFile.id == next_file.id).update(
                    {"status": "error", "error_message": str(e)[:500]}
                )
                db.commit()

    finally:
        _running_tasks.pop(job_id, None)
        db.close()


def cleanup_orphaned_jobs() -> None:
    """Mark any jobs left in 'running' state (server restart) as errored."""
    db = SessionLocal()
    try:
        stuck = db.query(ScanJob).filter(ScanJob.status == "running").all()
        for job in stuck:
            job.status = "error"
            for f in job.files:
                if f.status in ("pending", "running"):
                    f.status = "error"
                    f.error_message = "Server restarted during scan"
        if stuck:
            db.commit()
    finally:
        db.close()


# ── Job routes ────────────────────────────────────────────────────────────────

class JobFileIn(BaseModel):
    filename: str
    file_path: Optional[str] = None
    inline_content: Optional[str] = None


class JobCreate(BaseModel):
    engagement_id: int
    model: str
    system_prompt: str = ""
    files: List[JobFileIn]


def _serialize_job(job: ScanJob) -> dict:
    return {
        "id": job.id,
        "engagement_id": job.engagement_id,
        "model": job.model,
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "files": [_serialize_job_file(f) for f in job.files],
    }


def _serialize_job_file(f: ScanJobFile) -> dict:
    result_content = None
    if f.status == "done" and f.result_id:
        db = SessionLocal()
        try:
            r = db.query(CodeReviewResult).filter(CodeReviewResult.id == f.result_id).first()
            result_content = r.content if r else None
        finally:
            db.close()
    return {
        "id": f.id,
        "filename": f.filename,
        "status": f.status,
        "result_id": f.result_id,
        "result_content": result_content,
        "error_message": f.error_message,
    }


@router.post("/jobs", status_code=201)
async def create_job(body: JobCreate, db: Session = Depends(get_db)):
    base_url = _llm_base_url()
    if not base_url:
        raise HTTPException(503, "LLM_PROXY_URL is not set.")
    if not body.files:
        raise HTTPException(400, "No files provided")

    job = ScanJob(
        engagement_id=body.engagement_id,
        model=body.model,
        system_prompt=body.system_prompt,
        status="running",
    )
    db.add(job)
    db.flush()

    for f in body.files:
        db.add(ScanJobFile(
            job_id=job.id,
            filename=f.filename,
            file_path=f.file_path,
            inline_content=f.inline_content,
            status="pending",
        ))
    db.commit()
    db.refresh(job)

    task = asyncio.create_task(_run_scan_job(job.id))
    _running_tasks[job.id] = task

    return _serialize_job(job)


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return _serialize_job(job)


@router.get("/active-job/{engagement_id}")
def get_active_job(engagement_id: int, db: Session = Depends(get_db)):
    job = (
        db.query(ScanJob)
        .filter(ScanJob.engagement_id == engagement_id, ScanJob.status == "running")
        .order_by(ScanJob.created_at.desc())
        .first()
    )
    if not job:
        return None
    return _serialize_job(job)


@router.delete("/jobs/{job_id}", status_code=204)
def cancel_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    job.status = "cancelled"
    for f in job.files:
        if f.status == "pending":
            f.status = "cancelled"
    db.commit()
    task = _running_tasks.get(job_id)
    if task:
        task.cancel()


@router.delete("/jobs/{job_id}/files/{file_id}", status_code=204)
def cancel_job_file(job_id: int, file_id: int, db: Session = Depends(get_db)):
    f = db.query(ScanJobFile).filter(
        ScanJobFile.id == file_id, ScanJobFile.job_id == job_id
    ).first()
    if not f:
        raise HTTPException(404, "File not found")
    if f.status == "pending":
        f.status = "cancelled"
        db.commit()


# ── Persisted review results ──────────────────────────────────────────────────

class ReviewResultCreate(BaseModel):
    filename: str
    content: str


def _serialize_result(r: CodeReviewResult) -> dict:
    return {
        "id": r.id,
        "engagement_id": r.engagement_id,
        "filename": r.filename,
        "content": r.content,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/results/{engagement_id}")
def list_results(engagement_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(CodeReviewResult)
        .filter(CodeReviewResult.engagement_id == engagement_id)
        .order_by(CodeReviewResult.created_at.desc())
        .all()
    )
    return [_serialize_result(r) for r in rows]


@router.post("/results/{engagement_id}", status_code=201)
def create_result(engagement_id: int, body: ReviewResultCreate, db: Session = Depends(get_db)):
    row = CodeReviewResult(engagement_id=engagement_id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_result(row)


@router.delete("/results/{result_id}", status_code=204)
def delete_result(result_id: int, db: Session = Depends(get_db)):
    row = db.query(CodeReviewResult).filter(CodeReviewResult.id == result_id).first()
    if not row:
        raise HTTPException(404, "Result not found")
    db.delete(row)
    db.commit()
