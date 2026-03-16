from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["phases"])

GUIDES_DIR = Path(__file__).resolve().parent.parent / "guides"

PHASES = [
    {"slug": "reconnaissance", "name": "Reconnaissance", "order": 1},
    {"slug": "scanning_and_enumeration", "name": "Scanning and Enumeration", "order": 2},
    {"slug": "exploitation", "name": "Exploitation", "order": 3},
    {"slug": "post_exploitation", "name": "Post-Exploitation", "order": 4},
    {"slug": "reporting", "name": "Reporting", "order": 5},
]


@router.get("/phases")
def list_phases():
    return PHASES


@router.get("/phases/{slug}/guide")
def get_phase_guide(slug: str):
    phase = next((p for p in PHASES if p["slug"] == slug), None)
    if not phase:
        raise HTTPException(404, "Phase not found")
    guide_file = GUIDES_DIR / f"{slug}.md"
    if guide_file.exists():
        return {"slug": slug, "name": phase["name"], "content": guide_file.read_text()}
    return {"slug": slug, "name": phase["name"], "content": f"# {phase['name']}\n\nGuide content coming soon."}
