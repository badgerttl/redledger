import json
import re
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models import ChecklistItem, Engagement

router = APIRouter(tags=["wstg"])

# ── Paths ──────────────────────────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent.parent
WSTG_CHECKLIST_PATH = _HERE / "wstg_checklist.json"
WSTG_DIR = _HERE / "guides" / "wstg"
WSTG_CATEGORIES_DIR = WSTG_DIR / "categories"
WSTG_TESTS_DIR = WSTG_DIR / "tests"
WSTG_INDEX_PATH = WSTG_DIR / "index.json"

# ── GitHub ─────────────────────────────────────────────────────────────────
GITHUB_API = "https://api.github.com/repos/OWASP/wstg/contents"
GITHUB_RAW = "https://raw.githubusercontent.com/OWASP/wstg/master"
WSTG_DOC = "document/4-Web_Application_Security_Testing"
BRANCH = "master"

# ── Category metadata ──────────────────────────────────────────────────────
# Maps checklist phase name → (key, WSTG-ID, GitHub folder name)
CATEGORY_META = {
    "WSTG - Information Gathering":             ("info",     "WSTG-INFO", "01-Information_Gathering"),
    "WSTG - Configuration & Deployment Management": ("config","WSTG-CONF", "02-Configuration_and_Deployment_Management_Testing"),
    "WSTG - Identity Management":               ("identity", "WSTG-IDNT", "03-Identity_Management_Testing"),
    "WSTG - Authentication":                    ("authn",    "WSTG-ATHN", "04-Authentication_Testing"),
    "WSTG - Authorization":                     ("authz",    "WSTG-ATHZ", "05-Authorization_Testing"),
    "WSTG - Session Management":                ("session",  "WSTG-SESS", "06-Session_Management_Testing"),
    "WSTG - Input Validation":                  ("input",    "WSTG-INPV", "07-Input_Validation_Testing"),
    "WSTG - Error Handling":                    ("error",    "WSTG-ERRH", "08-Testing_for_Error_Handling"),
    "WSTG - Cryptography":                      ("crypto",   "WSTG-CRYP", "09-Testing_for_Weak_Cryptography"),
    "WSTG - Business Logic":                    ("business", "WSTG-BUSL", "10-Business_Logic_Testing"),
    "WSTG - Client-Side":                       ("client",   "WSTG-CLNT", "11-Client-side_Testing"),
    "WSTG - API Testing":                       ("api",      "WSTG-APIT", "12-API_Testing"),
}
KEY_TO_META = {v[0]: (phase, v[1], v[2]) for phase, v in CATEGORY_META.items()}

WSTG_PHASE_PREFIX = "WSTG - "


# ── Index helpers ──────────────────────────────────────────────────────────

def _ensure_dirs():
    WSTG_DIR.mkdir(parents=True, exist_ok=True)
    WSTG_CATEGORIES_DIR.mkdir(parents=True, exist_ok=True)
    WSTG_TESTS_DIR.mkdir(parents=True, exist_ok=True)


def _build_index() -> dict:
    """Derive navigation index from bundled wstg_checklist.json (always offline)."""
    if not WSTG_CHECKLIST_PATH.exists():
        return {"version": "4.2", "categories": []}
    checklist = json.loads(WSTG_CHECKLIST_PATH.read_text(encoding="utf-8"))
    categories = []
    for phase, items in checklist.items():
        if phase not in CATEGORY_META:
            continue
        key, cat_id, folder = CATEGORY_META[phase]
        tests = [
            {
                "id": item["id"],
                "name": re.sub(r"^WSTG-[A-Z]+-\d+:\s*", "", item["label"]),
                "description": item.get("description", ""),
            }
            for item in items
        ]
        categories.append({
            "key": key,
            "id": cat_id,
            "name": phase.replace("WSTG - ", ""),
            "folder": folder,
            "tests": tests,
        })
    return {"version": "4.2", "categories": categories}


def _get_index() -> dict:
    if not WSTG_INDEX_PATH.exists():
        _ensure_dirs()
        index = _build_index()
        WSTG_INDEX_PATH.write_text(json.dumps(index, indent=2), encoding="utf-8")
    return json.loads(WSTG_INDEX_PATH.read_text(encoding="utf-8"))


def _category_stub(cat: dict) -> str:
    lines = [
        f"# {cat['id']}: {cat['name']}\n",
        "*Full category guide not yet downloaded. Click **Update from Online** to fetch the complete OWASP WSTG content.*\n",
        "## Test Cases\n",
    ]
    for t in cat["tests"]:
        lines.append(f"### {t['id']}: {t['name']}\n")
        if t.get("description"):
            lines.append(f"{t['description']}\n")
    return "\n".join(lines)


def _test_stub(test: dict) -> str:
    content = f"# {test['id']}: {test['name']}\n\n"
    if test.get("description"):
        content += f"## Summary\n\n{test['description']}\n\n"
    content += "*Full test guide not yet downloaded. Click **Update from Online** to fetch detailed test procedures from OWASP.*\n"
    return content


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/guides/wstg/index")
def get_wstg_index():
    return _get_index()


@router.get("/guides/wstg/categories/{key}")
def get_wstg_category(key: str):
    if key not in KEY_TO_META:
        raise HTTPException(404, f"Unknown category: {key}")
    cache = WSTG_CATEGORIES_DIR / f"{key}.md"
    if cache.exists():
        return {"content": cache.read_text(encoding="utf-8"), "downloaded": True}
    index = _get_index()
    cat = next((c for c in index["categories"] if c["key"] == key), None)
    if not cat:
        raise HTTPException(404, "Category not found in index")
    return {"content": _category_stub(cat), "downloaded": False}


@router.get("/guides/wstg/tests/{test_id}")
def get_wstg_test(test_id: str):
    cache = WSTG_TESTS_DIR / f"{test_id}.md"
    if cache.exists():
        return {"content": cache.read_text(encoding="utf-8"), "downloaded": True}
    index = _get_index()
    for cat in index["categories"]:
        test = next((t for t in cat["tests"] if t["id"] == test_id), None)
        if test:
            return {"content": _test_stub(test), "downloaded": False}
    raise HTTPException(404, f"Test {test_id} not found")


@router.post("/guides/wstg/refresh")
async def refresh_wstg():
    """
    Download all WSTG category READMEs and individual test files from OWASP GitHub.
    Saves to backend/guides/wstg/{categories,tests}/ for offline use.
    Regenerates the navigation index from downloaded data.
    """
    return await download_wstg_content()


async def download_wstg_content() -> dict:
    """
    Download all WSTG category READMEs and individual test files from OWASP GitHub.
    Used by both the API refresh endpoint and the build-time cache script.
    """
    _ensure_dirs()
    index = _get_index()
    stats = {"categories": 0, "tests": 0, "errors": []}

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        for cat in index["categories"]:
            folder = cat["folder"]
            listing_url = f"{GITHUB_API}/{WSTG_DOC}/{folder}?ref={BRANCH}"

            try:
                resp = await client.get(listing_url)
                resp.raise_for_status()
                entries = resp.json()
            except Exception as exc:
                stats["errors"].append(f"{cat['id']} listing: {exc}")
                continue

            md_files = sorted(
                [e for e in entries if e["type"] == "file" and e["name"].endswith(".md")],
                key=lambda e: e["name"],
            )
            readme = next((e for e in md_files if e["name"].upper() == "README.MD"), None)
            test_files = [e for e in md_files if e["name"].upper() != "README.MD"]

            # Fetch category README
            if readme:
                try:
                    r = await client.get(readme["download_url"])
                    r.raise_for_status()
                    (WSTG_CATEGORIES_DIR / f"{cat['key']}.md").write_text(r.text, encoding="utf-8")
                    stats["categories"] += 1
                except Exception as exc:
                    stats["errors"].append(f"{cat['id']} README: {exc}")

            # Fetch individual tests — match by position to test IDs in index
            for i, entry in enumerate(test_files):
                if i >= len(cat["tests"]):
                    break
                test_id = cat["tests"][i]["id"]
                try:
                    r = await client.get(entry["download_url"])
                    r.raise_for_status()
                    (WSTG_TESTS_DIR / f"{test_id}.md").write_text(r.text, encoding="utf-8")
                    stats["tests"] += 1
                except Exception as exc:
                    stats["errors"].append(f"{test_id}: {exc}")

    return stats


# ── Checklist seeding ──────────────────────────────────────────────────────

@router.post("/engagements/{engagement_id}/wstg/load")
def load_wstg_checklist(engagement_id: int, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")

    existing = db.query(ChecklistItem).filter(
        ChecklistItem.engagement_id == engagement_id,
        ChecklistItem.phase.like(f"{WSTG_PHASE_PREFIX}%"),
    ).first()
    if existing:
        return {"loaded": 0, "already_loaded": True}

    if not WSTG_CHECKLIST_PATH.exists():
        raise HTTPException(500, "WSTG checklist data not found")

    checklist = json.loads(WSTG_CHECKLIST_PATH.read_text(encoding="utf-8"))
    max_order = (
        db.query(func.max(ChecklistItem.sort_order))
        .filter(ChecklistItem.engagement_id == engagement_id)
        .scalar() or 0
    )

    sort_order = max_order + 1
    created = 0
    for phase, items in checklist.items():
        for item in items:
            db.add(ChecklistItem(
                engagement_id=engagement_id,
                phase=phase,
                label=item["label"],
                description=item.get("description", ""),
                is_checked=False,
                is_na=False,
                sort_order=sort_order,
            ))
            sort_order += 1
            created += 1

    db.commit()
    return {"loaded": created, "already_loaded": False}
