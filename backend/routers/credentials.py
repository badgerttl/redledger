from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Credential, Engagement

router = APIRouter(tags=["credentials"])


class CredentialCreate(BaseModel):
    username: str = ""
    secret: str = ""
    secret_type: str = "plaintext"
    source: str = ""
    access_level: str = ""
    notes: str = ""
    asset_id: Optional[int] = None


class CredentialUpdate(BaseModel):
    username: Optional[str] = None
    secret: Optional[str] = None
    secret_type: Optional[str] = None
    source: Optional[str] = None
    access_level: Optional[str] = None
    notes: Optional[str] = None
    asset_id: Optional[int] = None


def _serialize(c: Credential) -> dict:
    return {
        "id": c.id,
        "engagement_id": c.engagement_id,
        "asset_id": c.asset_id,
        "username": c.username,
        "secret": c.secret,
        "secret_type": c.secret_type,
        "source": c.source,
        "access_level": c.access_level,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/engagements/{engagement_id}/credentials")
def list_credentials(engagement_id: int, db: Session = Depends(get_db)):
    return [_serialize(c) for c in db.query(Credential).filter(Credential.engagement_id == engagement_id).order_by(Credential.created_at.desc()).all()]


@router.post("/engagements/{engagement_id}/credentials", status_code=201)
def create_credential(engagement_id: int, body: CredentialCreate, db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")
    cred = Credential(engagement_id=engagement_id, **body.model_dump())
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return _serialize(cred)


@router.patch("/credentials/{credential_id}")
def update_credential(credential_id: int, body: CredentialUpdate, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(404, "Credential not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cred, k, v)
    db.commit()
    db.refresh(cred)
    return _serialize(cred)


@router.delete("/credentials/{credential_id}", status_code=204)
def delete_credential(credential_id: int, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == credential_id).first()
    if not cred:
        raise HTTPException(404, "Credential not found")
    db.delete(cred)
    db.commit()
