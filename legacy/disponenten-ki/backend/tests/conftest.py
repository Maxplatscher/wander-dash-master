"""Session-Setup: optionale SQL-Migrationen für bestehende PostgreSQL-Test-DBs."""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import text

from db import engine


def _apply_sql_file(path: Path) -> None:
    raw = path.read_text(encoding="utf-8")
    parts = [p.strip() for p in raw.split(";")]

    def _strip_comments(block: str) -> str:
        lines = [ln for ln in block.splitlines() if not ln.strip().startswith("--")]
        return "\n".join(lines).strip()

    with engine.begin() as conn:
        for part in parts:
            stmt = _strip_comments(part)
            if not stmt:
                continue
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


@pytest.fixture(scope="session", autouse=True)
def _apply_email_intake_migration() -> None:
    url = str(engine.url)
    if "postgresql" not in url:
        return
    mig_dir = Path(__file__).resolve().parent.parent / "migrations"
    if not mig_dir.is_dir():
        return
    for sql_path in sorted(mig_dir.glob("*.sql")):
        _apply_sql_file(sql_path)
