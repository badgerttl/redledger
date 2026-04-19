import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'offsec.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_sqlite_schema() -> None:
    """Additive SQLite migrations after create_all (existing DBs skip new columns until ALTER)."""
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        r = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='checklist_items'")
        )
        if not r.fetchone():
            return
        info = conn.execute(text("PRAGMA table_info(checklist_items)"))
        col_names = {row[1] for row in info.fetchall()}
        if "is_na" not in col_names:
            conn.execute(
                text("ALTER TABLE checklist_items ADD COLUMN is_na INTEGER NOT NULL DEFAULT 0")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
