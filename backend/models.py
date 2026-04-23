import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Table,
)
from sqlalchemy.orm import relationship
from backend.database import Base

# ── Association tables ────────────────────────────────────────────────

finding_asset = Table(
    "finding_asset", Base.metadata,
    Column("finding_id", Integer, ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", Integer, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
)

finding_tool_output = Table(
    "finding_tool_output", Base.metadata,
    Column("finding_id", Integer, ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True),
    Column("tool_output_id", Integer, ForeignKey("tool_outputs.id", ondelete="CASCADE"), primary_key=True),
)

asset_tag = Table(
    "asset_tag", Base.metadata,
    Column("asset_id", Integer, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

finding_tag = Table(
    "finding_tag", Base.metadata,
    Column("finding_id", Integer, ForeignKey("findings.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

tool_output_tag = Table(
    "tool_output_tag", Base.metadata,
    Column("tool_output_id", Integer, ForeignKey("tool_outputs.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

note_tag = Table(
    "note_tag", Base.metadata,
    Column("note_id", Integer, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

credential_asset = Table(
    "credential_asset", Base.metadata,
    Column("credential_id", Integer, ForeignKey("credentials.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", Integer, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
)


def _utcnow():
    return datetime.datetime.utcnow()


# ── Core models ───────────────────────────────────────────────────────

class Engagement(Base):
    __tablename__ = "engagements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="active")
    client_name = Column(String(255), default="")
    client_contact = Column(Text, default="")
    start_date = Column(String(10), default="")
    end_date = Column(String(10), default="")
    rules_of_engagement = Column(Text, default="")
    authorization_doc = Column(String(500), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    scope = relationship("Scope", back_populates="engagement", uselist=False, cascade="all, delete-orphan")
    scope_entries = relationship("ScopeEntry", back_populates="engagement", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="engagement", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="engagement", cascade="all, delete-orphan")
    credentials = relationship("Credential", back_populates="engagement", cascade="all, delete-orphan")
    tool_outputs = relationship("ToolOutput", back_populates="engagement", cascade="all, delete-orphan")
    checklist_items = relationship("ChecklistItem", back_populates="engagement", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="engagement", cascade="all, delete-orphan")
    code_review_results = relationship("CodeReviewResult", back_populates="engagement", cascade="all, delete-orphan")
    semgrep_results = relationship("SemgrepResult", back_populates="engagement", cascade="all, delete-orphan")


class Scope(Base):
    __tablename__ = "scopes"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), unique=True, nullable=False)
    in_scope = Column(Text, default="")
    out_scope = Column(Text, default="")

    engagement = relationship("Engagement", back_populates="scope")


class ScopeEntry(Base):
    __tablename__ = "scope_entries"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    entry_type = Column(String(20), nullable=False)  # ip_range, domain, url, cidr
    value = Column(String(500), nullable=False)

    engagement = relationship("Engagement", back_populates="scope_entries")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    asset_type = Column(String(20), nullable=False)  # host, web_page
    target = Column(String(500), default="")
    os = Column(String(100), default="")
    ports_summary = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    engagement = relationship("Engagement", back_populates="assets")
    notes = relationship("Note", back_populates="asset", cascade="all, delete-orphan")
    screenshots = relationship("Screenshot", back_populates="asset", cascade="all, delete-orphan",
                               foreign_keys="Screenshot.asset_id")
    tags = relationship("Tag", secondary=asset_tag, back_populates="assets")
    findings = relationship("Finding", secondary=finding_asset, back_populates="affected_assets")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    asset = relationship("Asset", back_populates="notes")
    tags = relationship("Tag", secondary=note_tag, back_populates="notes")


class ToolOutput(Base):
    __tablename__ = "tool_outputs"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    tool_name = Column(String(100), default="")
    phase = Column(String(50), default="")
    content = Column(Text, default="")
    source_file = Column(String(500), default="")
    created_at = Column(DateTime, default=_utcnow)

    engagement = relationship("Engagement", back_populates="tool_outputs")
    asset = relationship("Asset")
    tags = relationship("Tag", secondary=tool_output_tag, back_populates="tool_outputs")
    findings = relationship("Finding", secondary=finding_tool_output, back_populates="linked_tool_outputs")


class Screenshot(Base):
    __tablename__ = "screenshots"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True)
    finding_id = Column(Integer, ForeignKey("findings.id", ondelete="CASCADE"), nullable=True)
    file_path = Column(String(500), nullable=False)
    filename = Column(String(255), nullable=False)
    caption = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    asset = relationship("Asset", back_populates="screenshots", foreign_keys=[asset_id])
    finding = relationship("Finding", back_populates="screenshots", foreign_keys=[finding_id])


class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    impact = Column(Text, default="")
    remediation = Column(Text, default="")
    severity = Column(String(20), default="Info")  # Critical, High, Medium, Low, Info
    cvss_score = Column(Float, nullable=True)
    cvss_vector = Column(String(255), default="")
    status = Column(String(20), default="draft")  # draft, confirmed, reported, remediated
    phase = Column(String(50), default="")
    references = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    engagement = relationship("Engagement", back_populates="findings")
    affected_assets = relationship("Asset", secondary=finding_asset, back_populates="findings")
    screenshots = relationship("Screenshot", back_populates="finding", cascade="all, delete-orphan",
                               foreign_keys="Screenshot.finding_id")
    linked_tool_outputs = relationship("ToolOutput", secondary=finding_tool_output, back_populates="findings")
    tags = relationship("Tag", secondary=finding_tag, back_populates="findings")


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(255), default="")
    secret = Column(String(500), default="")
    secret_type = Column(String(20), default="plaintext")  # plaintext, ntlm, sha256, other
    source = Column(Text, default="")
    access_level = Column(String(100), default="")
    notes = Column(Text, default="")
    status = Column(String(20), default="confirmed")  # confirmed | review
    import_source = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)

    engagement = relationship("Engagement", back_populates="credentials")
    assets = relationship("Asset", secondary="credential_asset")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    phase = Column(String(50), nullable=False)
    label = Column(String(255), nullable=False)
    description = Column(Text, default="")
    is_checked = Column(Boolean, default=False)
    is_na = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    engagement = relationship("Engagement", back_populates="checklist_items")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=_utcnow)
    action = Column(Text, nullable=False)
    target = Column(String(255), default="")
    phase = Column(String(50), default="")
    notes = Column(Text, default="")

    engagement = relationship("Engagement", back_populates="activity_logs")


class Setting(Base):
    """Global key-value store for app-level settings (system prompt, etc.)."""
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    color = Column(String(7), default="#6366f1")

    assets = relationship("Asset", secondary=asset_tag, back_populates="tags")
    findings = relationship("Finding", secondary=finding_tag, back_populates="tags")
    tool_outputs = relationship("ToolOutput", secondary=tool_output_tag, back_populates="tags")
    notes = relationship("Note", secondary=note_tag, back_populates="tags")


class CodeReviewResult(Base):
    __tablename__ = "code_review_results"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    engagement = relationship("Engagement", back_populates="code_review_results")


class SemgrepResult(Base):
    __tablename__ = "semgrep_results"

    id = Column(Integer, primary_key=True, index=True)
    engagement_id = Column(Integer, ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    check_id = Column(String(500), default="")
    path = Column(String(500), default="")
    line = Column(Integer, default=0)
    col = Column(Integer, default=0)
    message = Column(Text, default="")
    severity = Column(String(20), default="")
    lines = Column(Text, default="")
    technology = Column(String(500), default="")
    vulnerability_class = Column(String(255), default="")
    likelihood = Column(String(50), default="")
    impact = Column(String(50), default="")
    confidence = Column(String(50), default="")
    cwe = Column(Text, default="")
    owasp = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    engagement = relationship("Engagement", back_populates="semgrep_results")


class ChatMessage(Base):
    """Persisted chat history scoped by context_type ('engagement' | 'asset') + context_id."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    context_type = Column(String(20), nullable=False)   # 'engagement' | 'asset'
    context_id = Column(Integer, nullable=False, index=True)
    role = Column(String(20), nullable=False)            # 'user' | 'assistant'
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
