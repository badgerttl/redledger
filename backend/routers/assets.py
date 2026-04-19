from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import Asset, Engagement, Tag

router = APIRouter(tags=["assets"])


class AssetCreate(BaseModel):
    name: str
    asset_type: str  # host, web_page
    target: str = ""
    os: str = ""
    ports_summary: str = ""


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    target: Optional[str] = None
    os: Optional[str] = None
    ports_summary: Optional[str] = None
    tag_ids: Optional[list[int]] = None


def _serialize(a: Asset) -> dict:
    return {
        "id": a.id,
        "engagement_id": a.engagement_id,
        "name": a.name,
        "asset_type": a.asset_type,
        "target": a.target,
        "os": a.os,
        "ports_summary": a.ports_summary,
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in a.tags],
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/engagements/{engagement_id}/assets")
def list_assets(engagement_id: int, db: Session = Depends(get_db)):
    return [_serialize(a) for a in db.query(Asset).filter(Asset.engagement_id == engagement_id).options(
        selectinload(Asset.tags),
    ).order_by(Asset.created_at.desc()).all()]


@router.post("/engagements/{engagement_id}/assets", status_code=201)
def create_asset(engagement_id: int, body: AssetCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    asset = Asset(engagement_id=engagement_id, **body.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _serialize(asset)


@router.get("/assets/{asset_id}")
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    return _serialize(asset)


@router.patch("/assets/{asset_id}")
def update_asset(asset_id: int, body: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    data = body.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
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
