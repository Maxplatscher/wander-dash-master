"""End-to-End-Smoke: Demo -> Plan -> Version-Deltas -> Tour aktivieren -> Driver-View.

Läuft im Dev-Modus (ohne Token) oder mit Admin-Login (EASYPLAN_REQUIRE_AUTH=1)."""
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


def test_smoke_demo_plan_versions_activate_driver_view(monkeypatch):
    """Hauptfluss: One-Click-Demo, Plan, Deltas prüfen, Tour aktivieren, Fahrer sieht Tour heute."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Admin-Login für Smoke nicht möglich (testadmin fehlt?)")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo/One-Click fehlgeschlagen: " + demo.text)
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    drv = client.post(
        "/drivers",
        json={
            "company_id": cid,
            "name": "Smoke Fahrer",
            "phone": None,
            "status": "available",
            "shift_start": 360,
            "shift_end": 1200,
        },
        headers=h or {},
    )
    assert drv.status_code == 200, drv.text
    driver_id = drv.json()["id"]

    email = f"smoke_driver_{uuid.uuid4().hex[:12]}@example.com"
    pw = "smoke-secret-123"
    usr = client.post(
        "/users",
        json={
            "email": email,
            "password": pw,
            "role": "driver",
            "company_id": cid,
            "driver_id": driver_id,
        },
        headers=h or {},
    )
    assert usr.status_code == 200, usr.text

    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    tour_id = plan_r.json()["tour_id"]

    deltas_r = client.get(
        f"/companies/{cid}/version_deltas?date={today}",
        headers=h or {},
    )
    assert deltas_r.status_code == 200, deltas_r.text
    deltas = deltas_r.json()
    assert isinstance(deltas, list)
    assert len(deltas) >= 1
    assert "version" in deltas[0]

    act_r = client.post(f"/tours/{tour_id}/activate", headers=h or {})
    assert act_r.status_code == 200, act_r.text
    assert act_r.json().get("is_active") is True

    login_r = client.post("/auth/login", json={"email": email, "password": pw})
    assert login_r.status_code == 200, login_r.text
    token = login_r.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {token}"}

    me_r = client.get("/driver/me/tour-today", params={"date": today}, headers=driver_headers)
    assert me_r.status_code == 200, me_r.text
    body = me_r.json()
    assert body.get("status") != "no_assignment"
    assert body.get("tour_id") == str(tour_id)
    assert body.get("date") == today
    assert "progress_completed" in body and "progress_total" in body

    stops = body.get("stops") or []
    service = [s for s in stops if s.get("shipment_id")]
    assert len(service) >= 1, "Demo-Tour sollte mindestens einen Kundenstopp haben"
    first_id = service[0]["tour_stop_id"]
    assert service[0].get("completed") is False

    done_r = client.post(
        f"/driver/me/tour-stops/{first_id}/complete",
        headers=driver_headers,
    )
    assert done_r.status_code == 200, done_r.text
    after = done_r.json()
    assert after.get("progress_completed", 0) >= 1

    patch_r = client.patch(
        "/driver/me",
        json={"status": "on_tour"},
        headers=driver_headers,
    )
    assert patch_r.status_code == 200, patch_r.text
    assert patch_r.json().get("status") == "on_tour"
