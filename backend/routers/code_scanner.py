"""Code Scanner — list directory files and stream LLM vulnerability analysis."""

import json
import os
import shutil
from pathlib import Path
from typing import AsyncIterator, List

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import CodeReviewResult
from backend.routers.assistant import DEFAULT_TIMEOUT, _llm_base_url, _lm_studio_auth_headers

router = APIRouter(prefix="/code-scanner", tags=["code_scanner"])


def _scan_dir() -> str:
    return os.environ.get("SCAN_DIR", "/app/data/scan").rstrip("/")


@router.get("/config")
def get_config():
    return {"scan_dir": _scan_dir()}


def _safe_subpath(name: str) -> Path:
    """Resolve name under SCAN_DIR, reject path traversal."""
    base = Path(_scan_dir()).resolve()
    target = (base / name).resolve()
    if not str(target).startswith(str(base) + os.sep) and target != base:
        raise HTTPException(400, "Invalid directory name")
    return target


@router.get("/scan-directories")
def list_scan_directories():
    """List top-level directories inside SCAN_DIR."""
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
    """Upload a folder (files + relative paths) into SCAN_DIR/{folder_name}/."""
    form = await request.form(max_files=50_000, max_fields=50_000)
    files = form.getlist("files")
    paths_json = form.get("paths_json", "")
    try:
        paths = json.loads(paths_json)
    except Exception:
        raise HTTPException(400, "paths_json must be a JSON array of strings")
    if not files or not paths or len(files) != len(paths):
        raise HTTPException(400, f"files={len(files)} paths={len(paths)} — must be equal and non-empty")

    # Derive folder name from first path segment of first file
    first_rel = paths[0].lstrip("/")
    folder_name = Path(first_rel).parts[0] if Path(first_rel).parts else "upload"

    dest_root = _safe_subpath(folder_name)

    uploaded = 0
    skipped = 0
    for upload_file, rel_path in zip(files, paths):
        rel = Path(rel_path.lstrip("/"))
        # Strip leading folder component so files land in dest_root directly
        parts = rel.parts
        sub = Path(*parts[1:]) if len(parts) > 1 else Path(parts[0])
        # Safety: reject traversal in any part
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
    """Delete a top-level directory from SCAN_DIR."""
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


class ScanRequest(BaseModel):
    model: str
    system_prompt: str
    filename: str
    content: str


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


@router.post("/scan-file")
async def scan_file(body: ScanRequest):
    base = _llm_base_url()
    if not base:
        raise HTTPException(503, "LLM_PROXY_URL is not set.")

    messages = []
    if body.system_prompt.strip():
        messages.append({"role": "system", "content": body.system_prompt.strip()})
    messages.append({
        "role": "user",
        "content": f"File: `{body.filename}`\n\n```\n{body.content}\n```",
    })

    payload = {"model": body.model, "messages": messages, "stream": True}
    upstream = f"{base}/v1/chat/completions"

    async def stream() -> AsyncIterator[bytes]:
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    upstream,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                        **_lm_studio_auth_headers(),
                    },
                ) as resp:
                    if resp.status_code >= 400:
                        err = (await resp.aread()).decode(errors="replace")[:800]
                        yield f"data: {json.dumps({'error': {'message': err or str(resp.status_code)}})}\n\n".encode()
                        return
                    async for chunk in resp.aiter_bytes():
                        yield chunk
        except httpx.ConnectError:
            yield f"data: {json.dumps({'error': {'message': 'Connection refused — is LLM running at LLM_PROXY_URL?'}})}\n\n".encode()
        except httpx.TimeoutException:
            yield f"data: {json.dumps({'error': {'message': 'Request timed out.'}})}\n\n".encode()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


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
