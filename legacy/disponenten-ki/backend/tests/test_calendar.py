"""Kalender-Endpoint (Block 14)."""
from __future__ import annotations

import os
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
# Auth ist standardmäßig aktiv; für Tests EASYPLAN_DEV=1 setzen
REQUIRE_AUTH = not (os.environ.get("EASYPLAN_DEV", "").strip().lower() in ("1", "true", "yes") or os.environ.get("EASYPLAN_REQUIRE_AUTH", "1").strip().lower() in ("0", "false", "no"))


def _headers():
    if REQUIRE_AUTH:
        r = client.post(
            "/auth/login",
            json={"email": "testadmin@example.com", "password": "secret123"},
        )
        if r.status_code != 200:
            return None
        return {"Authorization": "Bearer " + r.json()["access_token"]}
    return {}


def test_calendar_returns_entries_shape():
    """GET /companies/{id}/calendar liefert entries + max_tours_per_day."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login nicht verfügbar")

    companies = client.get("/companies", headers=h or {}).json()
    if not companies:
        pytest.skip("Kein Mandant")
    cid = companies[0]["id"]
    today = date.today()
    start = today - timedelta(days=3)
    end = today + timedelta(days=10)

    r = client.get(
        f"/companies/{cid}/calendar",
        params={"start": start.isoformat(), "end": end.isoformat()},
        headers=h or {},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "entries" in data
    assert "max_tours_per_day" in data
    assert isinstance(data["entries"], list)
    assert data["max_tours_per_day"] >= 1


def test_calendar_rejects_inverted_range():
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login nicht verfügbar")
    companies = client.get("/companies", headers=h or {}).json()
    if not companies:
        pytest.skip("Kein Mandant")
    cid = companies[0]["id"]
    r = client.get(
        f"/companies/{cid}/calendar",
        params={"start": "2026-03-10", "end": "2026-03-01"},
        headers=h or {},
    )
    assert r.status_code == 400
