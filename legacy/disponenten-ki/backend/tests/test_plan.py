"""Tests für Plan-Flows: Plan erstellen (erfolgreich/Fehler), Aktivieren, PlanRun-Detail.
Läuft mit Dev-Modus (ohne Token) oder mit gültigem Token."""
import os
from datetime import date

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
# Auth ist standardmäßig aktiv; für Tests EASYPLAN_DEV=1 setzen
REQUIRE_AUTH = not (os.environ.get("EASYPLAN_DEV", "").strip().lower() in ("1", "true", "yes") or os.environ.get("EASYPLAN_REQUIRE_AUTH", "1").strip().lower() in ("0", "false", "no"))


def _headers():
    if REQUIRE_AUTH:
        r = client.post("/auth/login", json={"email": "testadmin@example.com", "password": "secret123"})
        if r.status_code != 200:
            return None
        return {"Authorization": "Bearer " + r.json()["access_token"]}
    return {}


def test_plan_with_valid_data():
    """Plan erstellen mit gültigen Daten: Company hat Fahrzeuge und Sendungen."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login für Test nicht möglich")
    r = client.post("/demo/one-click", headers=h or {})
    if r.status_code != 200:
        pytest.skip("Demo/One-Click fehlgeschlagen: " + r.text)
    cid = r.json()["company_id"]
    today = date.today().isoformat()
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": True},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    data = plan_r.json()
    assert "tour_id" in data
    assert "total_cost" in data
    assert "routes" in data
    assert "unassigned_shipments" in data
    assert isinstance(data["routes"], list)


def test_plan_without_vehicles_returns_400():
    """Plan ohne Fahrzeuge für die Company → 400."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login für Test nicht möglich")
    # Company anlegen (ohne Fahrzeuge)
    cr = client.post("/companies", json={"name": "Test No Vehicles " + date.today().isoformat()}, headers=h or {})
    if cr.status_code != 200:
        pytest.skip("Company anlegen fehlgeschlagen (evtl. Name doppelt)")
    cid = cr.json()["id"]
    # Sendung anlegen
    sr = client.post(
        "/shipments",
        json={
            "company_id": cid,
            "name": "S1",
            "demand": 1,
            "location_x": 0,
            "location_y": 0,
            "window_start": 360,
            "window_end": 600,
            "service_date": date.today().isoformat(),
        },
        headers=h or {},
    )
    if sr.status_code != 200:
        pytest.skip("Shipment anlegen fehlgeschlagen")
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": date.today().isoformat()},
        headers=h or {},
    )
    assert plan_r.status_code == 400
    detail = (plan_r.json().get("detail") or "").lower()
    assert "vehicle" in detail


def test_plan_without_shipments_returns_400():
    """Plan ohne Sendungen für das Datum → 400."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login für Test nicht möglich")
    cr = client.post("/companies", json={"name": "Test No Shipments " + date.today().isoformat()}, headers=h or {})
    if cr.status_code != 200:
        pytest.skip("Company anlegen fehlgeschlagen")
    cid = cr.json()["id"]
    client.post(
        "/vehicles",
        json={"company_id": cid, "name": "V1", "capacity": 100},
        headers=h or {},
    )
    # Keine Sendungen mit service_date = heute
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": date.today().isoformat()},
        headers=h or {},
    )
    assert plan_r.status_code == 400
    detail = (plan_r.json().get("detail") or "").lower()
    assert "shipment" in detail


def test_activate_tour():
    """Tour aktivieren: POST /tours/{id}/activate → is_active True."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login für Test nicht möglich")
    r = client.post("/demo/one-click", headers=h or {})
    if r.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = r.json()["company_id"]
    today = date.today().isoformat()
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    if plan_r.status_code != 200:
        pytest.skip("Plan fehlgeschlagen")
    tour_id = plan_r.json()["tour_id"]
    list_r = client.get(f"/companies/{cid}/tours?date={today}", headers=h or {})
    assert list_r.status_code == 200
    tours = list_r.json()
    if not tours:
        pytest.skip("Keine Touren")
    tid = str(tours[0]["id"])
    act_r = client.post(f"/tours/{tid}/activate", headers=h or {})
    assert act_r.status_code == 200
    assert act_r.json()["is_active"] is True


def test_plan_run_detail_contains_snapshots():
    """PlanRun-Detail enthält input_snapshot und result_snapshot."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login für Test nicht möglich")
    r = client.post("/demo/one-click", headers=h or {})
    if r.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = r.json()["company_id"]
    today = date.today().isoformat()
    client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": True},
        headers=h or {},
    )
    list_r = client.get(f"/plan_runs?company_id={cid}", headers=h or {})
    assert list_r.status_code == 200
    runs = list_r.json()
    if not runs:
        pytest.skip("Keine Plan-Runs")
    run_id = runs[0]["id"]
    detail_r = client.get(f"/plan_runs/{run_id}", headers=h or {})
    assert detail_r.status_code == 200
    data = detail_r.json()
    assert "input_snapshot" in data
    assert "result_snapshot" in data
    assert data["input_snapshot"] is None or isinstance(data["input_snapshot"], dict)
    assert data["result_snapshot"] is None or isinstance(data["result_snapshot"], dict)


def test_driver_me_tour_today_requires_driver_role():
    """Endpoint ist fahrerspezifisch und lehnt andere Rollen ab."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")
    r = client.get("/driver/me/tour-today", headers=h or {})
    assert r.status_code in (401, 403)


def test_plan_with_locked_shipments_applied(monkeypatch):
    """Locked Sendungen werden im Planlauf berücksichtigt."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")
    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()
    baseline = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    if baseline.status_code != 200:
        pytest.skip("Basis-Plan nicht moeglich")
    tour_id = baseline.json()["tour_id"]
    detail = client.get(f"/tours/{tour_id}", headers=h or {}).json()
    stops = [s for s in detail.get("stops") or [] if s.get("shipment_id")]
    if len(stops) < 2:
        pytest.skip("Zu wenige Stopps fuer Lock-Test")
    locked_ids = [stops[0]["shipment_id"], stops[1]["shipment_id"]]
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False, "locked_shipment_ids": locked_ids},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    data = plan_r.json()
    assert data.get("locked_applied") is True


def test_plan_with_preassigned_vehicle_applied(monkeypatch):
    """Preassigned shipment:vehicle wird in TourStop umgesetzt."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")
    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")
    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()
    baseline = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    if baseline.status_code != 200:
        pytest.skip("Basis-Plan nicht moeglich")
    tour_id = baseline.json()["tour_id"]
    detail = client.get(f"/tours/{tour_id}", headers=h or {}).json()
    stops = [s for s in detail.get("stops") or [] if s.get("shipment_id")]
    if not stops:
        pytest.skip("Keine Demo-Stopps vorhanden")
    sid = stops[0]["shipment_id"]
    vid = stops[0]["vehicle_id"]
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False, "preassigned": {str(sid): str(vid)}},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    tour_id = plan_r.json()["tour_id"]
    detail = client.get(f"/tours/{tour_id}", headers=h or {})
    assert detail.status_code == 200
    stops = detail.json().get("stops", [])
    hit = [s for s in stops if s.get("shipment_id") == sid]
    assert hit, "Preassigned shipment not found in tour stops"
    assert hit[0].get("vehicle_id") == vid


def test_plan_osrm_fallback_in_snapshot(monkeypatch):
    """Bei OSRM-Fehler fällt der Planlauf auf Manhattan zurück (Snapshot-Nachweis)."""
    import eta_provider

    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "osrm")

    def _fail_osrm(coords):
        raise RuntimeError("OSRM unavailable for test")

    monkeypatch.setattr(eta_provider, "_osrm_matrix", _fail_osrm)

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()
    plan_r = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": True},
        headers=h or {},
    )
    assert plan_r.status_code == 200, plan_r.text
    runs = client.get(f"/plan_runs?company_id={cid}", headers=h or {}).json()
    if not runs:
        pytest.skip("Keine PlanRuns gefunden")
    run_id = runs[0]["id"]
    detail = client.get(f"/plan_runs/{run_id}", headers=h or {})
    assert detail.status_code == 200
    snap = detail.json()
    assert (snap.get("input_snapshot") or {}).get("eta_provider") == "manhattan"


def test_version_deltas_endpoint_returns_versions(monkeypatch):
    """Versions-Deltas liefert strukturierte Eintraege fuer die Tabelle."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    p1 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p1.status_code == 200, p1.text
    p2 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p2.status_code == 200, p2.text

    r = client.get(f"/companies/{cid}/version_deltas?date={today}", headers=h or {})
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 2
    assert "version" in rows[0]
    assert "changes" in rows[0]
    assert isinstance(rows[0]["changes"], list)


def test_version_deltas_detect_unassigned_change(monkeypatch):
    """Unassigned-Aenderung zwischen Versionen wird sichtbar."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    p1 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p1.status_code == 200, p1.text

    ships_r = client.get(f"/shipments?company_id={cid}&date={today}", headers=h or {})
    assert ships_r.status_code == 200, ships_r.text
    ships = ships_r.json()
    if not ships:
        pytest.skip("Keine Sendungen fuer Delta-Test")

    # Erzeuge absichtlich eine nicht planbare Sendung (zu hohe Nachfrage).
    sid = ships[0]["id"]
    upd = client.patch(f"/shipments/{sid}", json={"demand": 9999}, headers=h or {})
    assert upd.status_code == 200, upd.text

    p2 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p2.status_code == 200, p2.text

    deltas_r = client.get(f"/companies/{cid}/version_deltas?date={today}", headers=h or {})
    assert deltas_r.status_code == 200, deltas_r.text
    rows = deltas_r.json()
    assert len(rows) >= 2
    assert any(
        (isinstance(x.get("unassigned_delta"), int) and x.get("unassigned_delta") != 0)
        or any("Unassigned" in c for c in (x.get("changes") or []))
        for x in rows
    )


def test_version_deltas_detect_cost_change(monkeypatch):
    """Kosten-Aenderung zwischen zwei Versionen wird ausgewiesen."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")
    monkeypatch.setenv("EASYPLAN_DELTA_COST_THRESHOLD", "0")

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    p1 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p1.status_code == 200, p1.text
    tour_id = p1.json()["tour_id"]
    t_detail = client.get(f"/tours/{tour_id}", headers=h or {})
    assert t_detail.status_code == 200, t_detail.text
    stops = [s for s in t_detail.json().get("stops") or [] if s.get("shipment_id")]
    if not stops:
        pytest.skip("Keine Kundenstopps fuer Delta-Test")

    sid = stops[0]["shipment_id"]
    upd = client.patch(
        f"/shipments/{sid}",
        json={"location_x": 8000, "location_y": 8000},
        headers=h or {},
    )
    assert upd.status_code == 200, upd.text

    p2 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p2.status_code == 200, p2.text
    v2 = p2.json()["version"]

    deltas_r = client.get(f"/companies/{cid}/version_deltas?date={today}", headers=h or {})
    assert deltas_r.status_code == 200, deltas_r.text
    rows = deltas_r.json()
    row = next((x for x in rows if x.get("version") == v2), None)
    assert row is not None
    assert isinstance(row.get("cost_delta"), int)
    assert row["cost_delta"] != 0
    assert any("Kosten" in c for c in (row.get("changes") or []))


def test_version_deltas_detect_vehicle_assignment_change(monkeypatch):
    """Aenderung der verwendeten Fahrzeuge wird als Fahrzeugzuordnung erkannt."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    cname = "Delta Vehicles " + date.today().isoformat()
    cr = client.post("/companies", json={"name": cname}, headers=h or {})
    if cr.status_code != 200:
        pytest.skip("Company anlegen fehlgeschlagen")
    cid = cr.json()["id"]
    today = date.today().isoformat()

    v1 = client.post(
        "/vehicles",
        json={"company_id": cid, "name": "V1", "capacity": 10},
        headers=h or {},
    )
    assert v1.status_code == 200, v1.text

    for idx in range(3):
        sr = client.post(
            "/shipments",
            json={
                "company_id": cid,
                "name": f"S{idx+1}",
                "demand": 1,
                "location_x": 100 + idx * 10,
                "location_y": 100 + idx * 10,
                "window_start": 360,
                "window_end": 1200,
                "service_date": today,
            },
            headers=h or {},
        )
        assert sr.status_code == 200, sr.text

    p1 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p1.status_code == 200, p1.text
    ships_r = client.get(f"/shipments?company_id={cid}&date={today}", headers=h or {})
    assert ships_r.status_code == 200, ships_r.text
    ships = ships_r.json()
    if not ships:
        pytest.skip("Keine Sendungen fuer Fahrzeugwechsel-Test")

    v2 = client.post(
        "/vehicles",
        json={"company_id": cid, "name": "V2", "capacity": 10},
        headers=h or {},
    )
    assert v2.status_code == 200, v2.text
    v2_id = v2.json()["id"]

    p2 = client.post(
        f"/companies/{cid}/plan",
        json={
            "date": today,
            "auto_activate": False,
            "preassigned": {ships[0]["id"]: v2_id},
        },
        headers=h or {},
    )
    assert p2.status_code == 200, p2.text
    v2_version = p2.json()["version"]

    deltas_r = client.get(f"/companies/{cid}/version_deltas?date={today}", headers=h or {})
    assert deltas_r.status_code == 200, deltas_r.text
    rows = deltas_r.json()
    row = next((x for x in rows if x.get("version") == v2_version), None)
    assert row is not None
    assert any("Fahrzeugzuordnung" in c for c in (row.get("changes") or [])), row


def test_version_deltas_detect_stop_order_change(monkeypatch):
    """Geaenderte Stop-Reihenfolge wird im Delta ausgegeben."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")

    cname = "Delta Order " + date.today().isoformat()
    cr = client.post("/companies", json={"name": cname}, headers=h or {})
    if cr.status_code != 200:
        pytest.skip("Company anlegen fehlgeschlagen")
    cid = cr.json()["id"]
    today = date.today().isoformat()

    v1 = client.post(
        "/vehicles",
        json={"company_id": cid, "name": "V1", "capacity": 10},
        headers=h or {},
    )
    assert v1.status_code == 200, v1.text

    for idx in range(3):
        sr = client.post(
            "/shipments",
            json={
                "company_id": cid,
                "name": f"O{idx+1}",
                "demand": 1,
                "location_x": 200 + idx * 5,
                "location_y": 200 + idx * 5,
                "window_start": 360,
                "window_end": 1200,
                "service_date": today,
            },
            headers=h or {},
        )
        assert sr.status_code == 200, sr.text

    p1 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p1.status_code == 200, p1.text

    ships_r = client.get(f"/shipments?company_id={cid}&date={today}", headers=h or {})
    assert ships_r.status_code == 200, ships_r.text
    ships = ships_r.json()
    if not ships:
        pytest.skip("Zu wenige Sendungen fuer Reihenfolge-Test")

    upd = client.patch(
        f"/shipments/{ships[-1]['id']}",
        json={"demand": 9999},
        headers=h or {},
    )
    assert upd.status_code == 200, upd.text

    p2 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p2.status_code == 200, p2.text
    v2 = p2.json()["version"]

    deltas_r = client.get(f"/companies/{cid}/version_deltas?date={today}", headers=h or {})
    assert deltas_r.status_code == 200, deltas_r.text
    rows = deltas_r.json()
    row = next((x for x in rows if x.get("version") == v2), None)
    assert row is not None
    assert any("Stop-Reihenfolge" in c for c in (row.get("changes") or [])), row


def test_version_deltas_no_changes_for_identical_runs(monkeypatch):
    """Zwei identische Planlaeufe erzeugen keine wesentlichen Aenderungen."""
    h = _headers()
    if h is None and REQUIRE_AUTH:
        pytest.skip("Login fuer Test nicht moeglich")

    monkeypatch.setenv("EASYPLAN_ETA_PROVIDER", "manhattan")
    monkeypatch.setenv("EASYPLAN_DELTA_COST_THRESHOLD", "1")
    monkeypatch.setenv("EASYPLAN_DELTA_ETA_THRESHOLD", "5")

    demo = client.post("/demo/one-click", headers=h or {})
    if demo.status_code != 200:
        pytest.skip("Demo fehlgeschlagen")
    cid = demo.json()["company_id"]
    today = date.today().isoformat()

    p1 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p1.status_code == 200, p1.text

    p2 = client.post(
        f"/companies/{cid}/plan",
        json={"date": today, "auto_activate": False},
        headers=h or {},
    )
    assert p2.status_code == 200, p2.text
    v2 = p2.json()["version"]

    deltas_r = client.get(f"/companies/{cid}/version_deltas?date={today}", headers=h or {})
    assert deltas_r.status_code == 200, deltas_r.text
    rows = deltas_r.json()
    row = next((x for x in rows if x.get("version") == v2), None)
    assert row is not None
    assert row.get("changes") == []
