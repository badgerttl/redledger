"""Shared data directory paths (DATA_DIR, uploads, reports)."""
import os
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent

DATA_DIR = Path(os.environ.get("DATA_DIR", _REPO_ROOT / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
REPORT_DIR = DATA_DIR / "reports"
