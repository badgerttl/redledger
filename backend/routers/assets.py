from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload, contains_eager

from backend.database import get_db
from backend.models import Asset, Engagement, Tag

VALID_ASSET_TYPES = {"host", "web_page", "api_endpoint", "domain", "network", "database", "git_repo", "mobile_app", "cloud_resource"}

router = APIRouter(tags=["assets"])


class AssetCreate(BaseModel):
    name: str
    asset_type: str  # host, web_page
    target: str = ""
    os: str = ""
    ports_summary: str = ""
    parent_asset_id: Optional[int] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    target: Optional[str] = None
    os: Optional[str] = None
    ports_summary: Optional[str] = None
    parent_asset_id: Optional[int] = None
    tag_ids: Optional[list[int]] = None


def _serialize(a: Asset) -> dict:
    return {
        "id": a.id,
        "engagement_id": a.engagement_id,
        "parent_asset_id": a.parent_asset_id,
        "name": a.name,
        "asset_type": a.asset_type,
        "target": a.target,
        "os": a.os,
        "ports_summary": a.ports_summary,
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in a.tags],
        "children": [{"id": c.id, "name": c.name, "asset_type": c.asset_type, "target": c.target}
                     for c in (a.children or [])],
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/engagements/{engagement_id}/assets")
def list_assets(engagement_id: int, db: Session = Depends(get_db)):
    return [_serialize(a) for a in db.query(Asset).filter(Asset.engagement_id == engagement_id).options(
        selectinload(Asset.tags),
        selectinload(Asset.children),
    ).order_by(Asset.created_at.desc()).all()]


@router.post("/engagements/{engagement_id}/assets", status_code=201)
def create_asset(engagement_id: int, body: AssetCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    data = body.model_dump()
    parent_id = data.get("parent_asset_id")
    if parent_id is not None:
        parent = db.query(Asset).filter(Asset.id == parent_id, Asset.engagement_id == engagement_id).first()
        if not parent:
            raise HTTPException(404, "Parent asset not found in this engagement")
    asset = Asset(engagement_id=engagement_id, **data)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _serialize(asset)


@router.get("/assets/{asset_id}")
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).options(
        selectinload(Asset.tags),
        selectinload(Asset.children),
    ).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    return _serialize(asset)


@router.patch("/assets/{asset_id}")
def update_asset(asset_id: int, body: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).options(
        selectinload(Asset.tags),
        selectinload(Asset.children),
    ).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    data = body.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    if "parent_asset_id" in data:
        new_parent_id = data["parent_asset_id"]
        if new_parent_id is not None:
            if new_parent_id == asset.id:
                raise HTTPException(422, "Asset cannot be its own parent")
            parent = db.query(Asset).filter(
                Asset.id == new_parent_id, Asset.engagement_id == asset.engagement_id
            ).first()
            if not parent:
                raise HTTPException(404, "Parent asset not found in this engagement")
    for k, v in data.items():
        setattr(asset, k, v)
    if tag_ids is not None:
        asset.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    db.commit()
    db.refresh(asset)
    return _serialize(asset)


@router.delete("/assets/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    db.delete(asset)
    db.commit()


class AssetImportRow(BaseModel):
    name: str
    asset_type: str = "host"
    target: str = ""
    os: str = ""


class AssetImportRequest(BaseModel):
    assets: list[AssetImportRow]


@router.post("/engagements/{engagement_id}/assets/import")
def import_assets(engagement_id: int, body: AssetImportRequest, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    if not body.assets:
        raise HTTPException(422, "No assets to import")

    errors = []
    for i, row in enumerate(body.assets):
        if not row.name.strip():
            errors.append(f"Row {i + 1}: name is required")
        if row.asset_type not in VALID_ASSET_TYPES:
            errors.append(f"Row {i + 1}: invalid asset_type '{row.asset_type}'")
    if errors:
        raise HTTPException(422, "; ".join(errors))

    created = []
    for row in body.assets:
        asset = Asset(
            engagement_id=engagement_id,
            name=row.name.strip(),
            asset_type=row.asset_type,
            target=row.target.strip(),
            os=row.os.strip(),
        )
        db.add(asset)
        created.append(asset)
    db.commit()
    return {"imported": len(created)}
