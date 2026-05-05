"""
Block 15: End-to-End-Szenarien gegen echte DB (kein Mocking der DB).

Hinweise:
- Kein PATCH /tours/{id}/status — Fahrer arbeiten über Tour-Stopp „erledigt“.
- Konflikte/Unassigned: PlanRun- bzw. Plan-Ergebnis.
"""
from __future__ import annotations

import os
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from db import SessionLocal
from main import app
from models import Tour, TourStop

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


def _delete_tour_cascade(tour_id: uuid.UUID) -> None:
    with SessionLocal() as db:
        db.execute(delete(TourStop).where(TourStop.tour_id == tour_id))
        db.execute(delete(Tour).where(Tour.id == tour_id))
        db.commit()


def test_scenario_a_normal_day_email_shipment_plan(monkeypatch):
    """A: E-Mail-ähnliche Sendung → Freigabe → Plan (aktiv)."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    demo = client.post("/demo/one-click", headers=h or {})
    assert demo.status_code == 200, demo.text
    cid = uuid.UUID(demo.json()["company_id"])
    today = date.today().isoformat()

    sr = client.post(
        "/shipments",
        json={
            "company_id": str(cid),
            "name": "E2E E-Mail Sendung",
            "demand": 2,
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
        json={
            "intake_source": "email",
            "intake_status": "unvollständig",
            "customer_name": "K1",
            "delivery_address": "Hauptstr. 1, 38100 Braunschweig",
            "missing_fields": ["customer_name"],
        },
        headers=h or {},
    )

    inc = client.get(
        f"/shipments?company_id={cid}&intake_incomplete=true",
        headers=h or {},
    )
    assert inc.status_code == 200
    assert any(x["id"] == sid for x in inc.json())

    fr = client.patch(
        f"/shipments/{sid}/freigabe",
        json={
            "customer_name": "K1 GmbH",
            "delivery_address": "Hauptstr. 1, 38100 Braunschweig",
            "requested_date": today,
        },
        headers=h or {},
    )
    assert fr.status_code == 200, fr.text

    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": True},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    tour_id = uuid.UUID(plan_r.json()["tour_id"])
    _delete_tour_cascade(tour_id)


def test_scenario_c_incomplete_release_422_then_ok():
    """C: Freigabe ohne Adresse → 422; mit Adresse → 200."""
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
            "name": "C nur Kunde",
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
        json={
            "intake_source": "email",
            "intake_status": "unvollständig",
            "customer_name": "Kunde",
            "delivery_address": None,
            "missing_fields": ["delivery_address"],
        },
        headers=h or {},
    )

    bad = client.patch(
        f"/shipments/{sid}/freigabe",
        json={"customer_name": "Kunde", "requested_date": today},
        headers=h or {},
    )
    assert bad.status_code == 422

    ok = client.patch(
        f"/shipments/{sid}/freigabe",
        json={
            "customer_name": "Kunde GmbH",
            "delivery_address": "Weg 5, 12345 Musterstadt",
            "requested_date": today,
        },
        headers=h or {},
    )
    assert ok.status_code == 200, ok.text


def test_scenario_e_calendar_consistency():
    """E: Tour im Kalender; nach DB-Löschen nicht mehr."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

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

    cal = client.get(
        f"/companies/{cid}/calendar?start={today}&end={today}",
        headers=h or {},
    )
    assert cal.status_code == 200
    tours = [e for e in cal.json().get("entries", []) if e["type"] == "tour"]
    assert any(e["id"] == tour_id for e in tours)

    _delete_tour_cascade(uuid.UUID(tour_id))

    cal2 = client.get(
        f"/companies/{cid}/calendar?start={today}&end={today}",
        headers=h or {},
    )
    assert cal2.status_code == 200
    tours2 = [e for e in cal2.json().get("entries", []) if e["type"] == "tour"]
    assert not any(e["id"] == tour_id for e in tours2)


def test_scenario_b_problem_demo_has_unassigned_or_conflicts(monkeypatch):
    """B: Problemtag-Demo → Plan mit Unassigned oder Konflikt-Hinweis."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    demo = client.post("/demo/one-click?scenario=problem", headers=h or {})
    assert demo.status_code == 200, demo.text
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    body = plan_r.json()
    unassigned = body.get("unassigned_shipments") or []
    tour_id = body.get("tour_id")
    conflicts = []
    if tour_id:
        from models import PlanRun

        with SessionLocal() as db:
            t = db.get(Tour, uuid.UUID(tour_id))
            if t and t.plan_run_id:
                pr = db.get(PlanRun, t.plan_run_id)
                if pr and isinstance(pr.result_snapshot, dict):
                    conflicts = pr.result_snapshot.get("conflicts") or []

    assert len(unassigned) > 0 or len(conflicts) > 0


def test_scenario_d_poller_alert_recovery(monkeypatch):
    """D: Drei fehlgeschlagene Polls → alert; erfolgreicher Leerlauf → kein alert."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login")

    from services import email_intake_config as eic
    from services import email_poller as ep
    from services.email_intake_config import EmailIntakeConfig

    cid = uuid.uuid4()

    def fake_cfg():
        return EmailIntakeConfig(
            enabled=True,
            imap_host="127.0.0.1",
            imap_port=993,
            imap_user="u",
            imap_password="p",
            imap_tls=True,
            poll_interval_ms=120000,
            default_company_id=cid,
            smtp_host=None,
            smtp_port=587,
            smtp_user=None,
            smtp_password=None,
            smtp_from=None,
            confirm_enabled=False,
            processed_folder=None,
            error_folder=None,
        )

    monkeypatch.setattr(eic, "load_email_intake_config", fake_cfg)
    monkeypatch.setattr(eic, "config_is_runnable", lambda c: True)

    def boom(_cfg):
        raise RuntimeError("imap test failure")

    monkeypatch.setattr(ep, "_imap_connect", boom)
    ep._consecutive_failures = 0
    ep._last_error = None

    for _ in range(3):
        r = client.post("/email-intake/poll-now", headers=h or {})
        assert r.status_code == 502

    st = client.get("/email-intake/status", headers=h or {}).json()
    assert st.get("alert") is True

    class FM:
        def select(self, *a, **k):
            return None

        def uid(self, cmd, *args):
            if cmd == "SEARCH":
                return "OK", [b""]
            return "OK", [b""]

        def logout(self):
            pass

    monkeypatch.setattr(ep, "_imap_connect", lambda c: FM())
    r_ok = client.post("/email-intake/poll-now", headers=h or {})
    assert r_ok.status_code == 200

    st2 = client.get("/email-intake/status", headers=h or {}).json()
    assert st2.get("alert") is False
