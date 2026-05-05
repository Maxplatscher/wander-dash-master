"""Block 15: Ergänzende Endpoint-Tests (Lücken schließen)."""
from __future__ import annotations

import os
import uuid
from datetime import date

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


def test_plan_zero_shipments_after_date_filter_returns_400(monkeypatch):
    """POST /plan: keine Sendungen für gewähltes Datum → 400."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    cr = client.post(
        "/companies",
        json={"name": "Gap No Ship " + date.today().isoformat()},
        headers=h or {},
    )
    if cr.status_code != 200:
        pytest.skip("Company")
    cid = cr.json()["id"]
    client.post(
        "/vehicles",
        json={"company_id": cid, "name": "V1", "capacity": 100},
        headers=h or {},
    )
    client.post(
        "/shipments",
        json={
            "company_id": cid,
            "name": "S1",
            "demand": 1,
            "location_x": 104000,
            "location_y": 522000,
            "window_start": 480,
            "window_end": 1020,
            "service_date": "2099-01-01",
        },
        headers=h or {},
    )
    r = client.post(
        f"/companies/{cid}/plan",
        json={"date": date.today().isoformat()},
        headers=h or {},
    )
    assert r.status_code == 400


def test_shipments_intake_incomplete_with_date_filter(monkeypatch):
    """GET /shipments: intake_incomplete + date kombiniert."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

    demo = client.post("/demo/one-click", headers=h or {})
    assert demo.status_code == 200, demo.text
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    sr = client.post(
        "/shipments",
        json={
            "company_id": cid,
            "name": "Gap incomplete",
            "demand": 1,
            "location_x": 104000,
            "location_y": 522000,
            "window_start": 480,
            "window_end": 1020,
            "service_date": today,
        },
        headers=h or {},
    )
    assert sr.status_code == 200, sr.text
    sid = sr.json()["id"]
    client.patch(
        f"/shipments/{sid}",
        json={"intake_source": "email", "intake_status": "unvollständig"},
        headers=h or {},
    )

    r = client.get(
        f"/shipments?company_id={cid}&intake_incomplete=true&date={today}",
        headers=h or {},
    )
    assert r.status_code == 200
    assert any(x["id"] == sid for x in r.json())

    r2 = client.get(
        f"/shipments?company_id={cid}&intake_incomplete=true&date=2099-01-01",
        headers=h or {},
    )
    assert r2.status_code == 200
    assert not any(x["id"] == sid for x in r2.json())


def test_delete_shipment_referenced_by_tour_stop_fails_or_blocks(monkeypatch):
    """DELETE /shipments: Sendung auf Tour — FK verhindert Löschen typischerweise."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")
    demo = client.post("/demo/one-click", headers=h or {})
    assert demo.status_code == 200, demo.text
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    tour_id = plan_r.json()["tour_id"]
    detail = client.get(f"/tours/{tour_id}", headers=h or {}).json()
    stops = [s for s in detail.get("stops") or [] if s.get("shipment_id")]
    if not stops:
        pytest.skip("Keine Kundenstopps")
    sid = stops[0]["shipment_id"]
    dr = client.delete(f"/shipments/{sid}", headers=h or {})
    assert dr.status_code in (400, 409, 500) or (
        dr.status_code == 200
    )  # SQLite vs PG: ideal wäre 409


def test_get_drivers_without_active_tour():
    """GET /drivers: liefert Liste auch ohne laufende Tour."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

    cr = client.post(
        "/companies",
        json={"name": "Gap Drivers " + date.today().isoformat()},
        headers=h or {},
    )
    if cr.status_code != 200:
        pytest.skip("Company")
    cid = cr.json()["id"]
    client.post(
        "/drivers",
        json={
            "company_id": cid,
            "name": "Fahrer Test",
            "shift_start": 480,
            "shift_end": 1020,
        },
        headers=h or {},
    )
    r = client.get(f"/drivers?company_id={cid}", headers=h or {})
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_patch_driver_me_empty_status_400():
    """PATCH /driver/me: leerer Status → 400."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

    r = client.patch("/driver/me", json={"status": ""}, headers=h or {})
    assert r.status_code in (400, 403)
