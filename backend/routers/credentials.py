from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import Asset, Credential, Engagement

router = APIRouter(tags=["credentials"])


class CredentialCreate(BaseModel):
    username: str = ""
    secret: str = ""
    secret_type: str = "plaintext"
    source: str = ""
    access_level: str = ""
    notes: str = ""
    status: str = "confirmed"
    import_source: str = ""
    asset_ids: list[int] = []


class CredentialUpdate(BaseModel):
    username: Optional[str] = None
    secret: Optional[str] = None
    secret_type: Optional[str] = None
    source: Optional[str] = None
    access_level: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    asset_ids: Optional[list[int]] = None


def _serialize(c: Credential, *, mask_secret: bool = False) -> dict:
    return {
        "id": c.id,
        "engagement_id": c.engagement_id,
        "asset_ids": [a.id for a in c.assets],
        "assets": [{"id": a.id, "name": a.name, "target": a.target} for a in c.assets],
        "username": c.username,
        "secret": "••••••••" if mask_secret and c.secret else c.secret,
        "secret_masked": mask_secret and bool(c.secret),
        "secret_type": c.secret_type,
        "source": c.source,
        "access_level": c.access_level,
        "notes": c.notes,
        "status": c.status or "confirmed",
        "import_source": c.import_source or "",
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/engagements/{engagement_id}/credentials")
def list_credentials(engagement_id: int, db: Session = Depends(get_db)):
    return [_serialize(c, mask_secret=True) for c in db.query(Credential).filter(Credential.engagement_id == engagement_id).options(
        selectinload(Credential.assets),
    ).order_by(Credential.created_at.desc()).all()]


@router.post("/engagements/{engagement_id}/credentials", status_code=201)
def create_credential(engagement_id: int, body: CredentialCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    data = body.model_dump()
    asset_ids = data.pop("asset_ids", [])
    cred = Credential(engagement_id=engagement_id, **data)
    if asset_ids:
        cred.assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return _serialize(cred)


@router.get("/credentials/{credential_id}")
def get_credential(credential_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == credential_id).options(
        selectinload(Credential.assets)
    ).first()
    if not cred:
        raise HTTPException(404, "Credential not found")
    return _serialize(cred)


@router.patch("/credentials/{credential_id}")
def update_credential(credential_id: int, body: CredentialUpdate, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(404, "Credential not found")
    data = body.model_dump(exclude_unset=True)
    asset_ids = data.pop("asset_ids", None)
    for k, v in data.items():
        setattr(cred, k, v)
    if asset_ids is not None:
        cred.assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
    db.commit()
    db.refresh(cred)
    return _serialize(cred)


@router.get("/assets/{asset_id}/credentials")
def list_credentials_for_asset(asset_id: int, db: Session = Depends(get_db)):
    """Return all credentials linked to a specific asset."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    creds = (
        db.query(Credential)
        .filter(Credential.assets.any(Asset.id == asset_id))
        .options(selectinload(Credential.assets))
        .order_by(Credential.created_at.desc())
        .all()
    )
    return [_serialize(c, mask_secret=True) for c in creds]


@router.post("/credentials/{credential_id}/confirm")
def confirm_credential(credential_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).options(selectinload(Credential.assets)).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(404, "Credential not found")
    cred.status = "confirmed"
    db.commit()
    db.refresh(cred)
    return _serialize(cred, mask_secret=True)


@router.delete("/credentials/{credential_id}", status_code=204)
def delete_credential(credential_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(404, "Credential not found")
    db.delete(cred)
    db.commit()
