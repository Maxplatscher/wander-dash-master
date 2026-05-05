"""Dispatcher operations_snapshot: aktive Tour, Stopp-Fortschritt, Fahrerliste."""
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


def test_dispatcher_operations_snapshot_after_activate(monkeypatch):
    """Nach Plan + Aktivierung: Snapshot mit has_active_tour und Fahrzeug-Fortschritt."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Admin-Login nicht möglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen: " + demo.text)
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    tour_id = plan_r.json()["tour_id"]

    act_r = client.post(f"/tours/{tour_id}/activate", headers=h or {})
    assert act_r.status_code == 200, act_r.text

    snap1 = client.get(
        f"/companies/{cid}/dispatcher/operations_snapshot?date={today}",
        headers=h or {},
    )
    assert snap1.status_code == 200, snap1.text
    body1 = snap1.json()
    assert body1.get("has_active_tour") is True
    assert body1.get("active_tour_id") == str(tour_id)
    assert isinstance(body1.get("active_version"), int)
    assert body1.get("vehicles_deployed", 0) >= 1
    assert body1.get("customer_stops_total", 0) >= 1
    assert body1.get("customer_stops_done", 0) == 0
    assert body1.get("progress_percent", 0) == 0
    vehicles = body1.get("vehicles") or []
    assert len(vehicles) >= 1
    v0 = vehicles[0]
    assert "vehicle_name" in v0
    assert v0.get("customer_stops_total", 0) >= 1
    assert v0.get("tour_complete") is False
    assert "drivers" in body1


@pytest.mark.skipif(not REQUIRE_AUTH, reason="Fahrer-403 nur mit aktivierter Auth testbar")
def test_dispatcher_operations_snapshot_forbidden_for_driver():
    """Rolle driver darf operations_snapshot nicht abrufen."""
    demo = client.post("/demo/one-click")
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    drv = client.post(
        "/drivers",
        json={
            "company_id": cid,
            "name": "DispTest Fahrer",
            "status": "available",
            "shift_start": 360,
            "shift_end": 1200,
        },
    )
    assert drv.status_code == 200, drv.text

    email = f"disp_driver_{uuid.uuid4().hex[:10]}@example.com"
    usr = client.post(
        "/users",
        json={
            "email": email,
            "password": "secret123",
            "role": "driver",
            "company_id": cid,
            "driver_id": drv.json()["id"],
        },
    )
    assert usr.status_code == 200, usr.text
    login = client.post("/auth/login", json={"email": email, "password": "secret123"})
    assert login.status_code == 200, login.text
    tok = login.json()["access_token"]
    r = client.get(
        f"/companies/{cid}/dispatcher/operations_snapshot?date={today}",
        headers={"Authorization": "Bearer " + tok},
    )
    assert r.status_code == 403
