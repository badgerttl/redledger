import xml.etree.ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Asset, ToolOutput, ActivityLog, Engagement

router = APIRouter(tags=["nmap_import"])


@router.post("/engagements/{engagement_id}/import/nmap", status_code=201)
async def import_nmap(engagement_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not db.query(Engagement).filter(Engagement.id == engagement_id).first():
        raise HTTPException(404, "Engagement not found")

    content = await file.read()
    xml_text = content.decode("utf-8", errors="replace")

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        raise HTTPException(400, "Invalid XML file")

    created_assets = []
    for host_el in root.findall(".//host"):
        addr_el = host_el.find("address[@addrtype='ipv4']")
        if addr_el is None:
            addr_el = host_el.find("address")
        if addr_el is None:
            continue

        ip = addr_el.get("addr", "")
        hostname = ""
        hn_el = host_el.find(".//hostname")
        if hn_el is not None:
            hostname = hn_el.get("name", "")

        ports = []
        for port_el in host_el.findall(".//port"):
            state_el = port_el.find("state")
            if state_el is not None and state_el.get("state") == "open":
                port_id = port_el.get("portid", "")
                protocol = port_el.get("protocol", "")
                service_el = port_el.find("service")
                service_name = service_el.get("name", "") if service_el is not None else ""
                ports.append(f"{port_id}/{protocol} ({service_name})" if service_name else f"{port_id}/{protocol}")

        ports_summary = ", ".join(ports)

        existing = db.query(Asset).filter(
            Asset.engagement_id == engagement_id,
            Asset.target == ip,
            Asset.asset_type == "host",
        ).first()

        if existing:
            existing.ports_summary = ports_summary
            if hostname and not existing.name:
                existing.name = hostname
            created_assets.append({"id": existing.id, "target": ip, "name": existing.name, "updated": True})
        else:
            asset = Asset(
                engagement_id=engagement_id,
                name=hostname or ip,
                asset_type="host",
                target=ip,
                ports_summary=ports_summary,
            )
            db.add(asset)
            db.flush()
            created_assets.append({"id": asset.id, "target": ip, "name": asset.name, "updated": False})

    to = ToolOutput(
        engagement_id=engagement_id,
        tool_name="nmap",
        phase="Scanning and Enumeration",
        content=xml_text[:50000],
        source_file=file.filename or "nmap_scan.xml",
    )
    db.add(to)

    db.add(ActivityLog(
        engagement_id=engagement_id,
        action=f"Imported Nmap scan — {len(created_assets)} hosts found",
        phase="Scanning and Enumeration",
    ))

    db.commit()

    return {"hosts_found": len(created_assets), "assets": created_assets}
