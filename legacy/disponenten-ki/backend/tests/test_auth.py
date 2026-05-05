"""Tests für Auth: Login, /auth/me, Rollen, Status, Health.
Bei Dev-Modus (EASYPLAN_REQUIRE_AUTH nicht gesetzt) sind einige Auth-Tests optional.
Für volle Auth-Prüfung: EASYPLAN_REQUIRE_AUTH=1 setzen."""
import os
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
# Auth ist standardmäßig aktiv; für Tests EASYPLAN_DEV=1 setzen
REQUIRE_AUTH = not (os.environ.get("EASYPLAN_DEV", "").strip().lower() in ("1", "true", "yes") or os.environ.get("EASYPLAN_REQUIRE_AUTH", "1").strip().lower() in ("0", "false", "no"))


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "degraded")
    assert data.get("db") in ("ok", "error")
    assert "imap" in data
    assert "uptime_seconds" in data
    assert data.get("version")


def test_auth_status():
    r = client.get("/auth/status")
    assert r.status_code == 200
    data = r.json()
    assert "require_auth" in data
    assert isinstance(data["require_auth"], bool)


def test_companies_require_auth():
    """Erfordert EASYPLAN_REQUIRE_AUTH=1, sonst wird bei Dev-Modus 200 zurückgegeben."""
    r = client.get("/companies")
    if not REQUIRE_AUTH:
        pytest.skip("Dev-Modus: Auth nicht erzwungen (EASYPLAN_REQUIRE_AUTH=1 für diesen Test)")
    assert r.status_code == 401


def test_login_invalid():
    r = client.post(
        "/auth/login",
        json={"email": "nonexistent@test.de", "password": "wrong"},
    )
    assert r.status_code == 401


def test_register_then_login():
    r = client.post(
        "/auth/register",
        json={"email": "testadmin@example.com", "password": "secret123", "role": "admin"},
    )
    if r.status_code == 403:
        pytest.skip("Bereits User vorhanden, Registrierung deaktiviert")
    assert r.status_code == 200
    data = r.json()
    assert "email" in data
    assert data["email"] == "testadmin@example.com"
    assert data["role"] == "admin"

    r2 = client.post(
        "/auth/login",
        json={"email": "testadmin@example.com", "password": "secret123"},
    )
    assert r2.status_code == 200
    assert "access_token" in r2.json()
    assert r2.json()["user"]["email"] == "testadmin@example.com"

    token = r2.json()["access_token"]
    r3 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == 200
    assert r3.json()["email"] == "testadmin@example.com"

    r4 = client.get("/companies", headers={"Authorization": f"Bearer {token}"})
    assert r4.status_code == 200


def test_demo_one_click_returns_company():
    """One-Click-Demo liefert company_id (mit oder ohne Auth je nach EASYPLAN_REQUIRE_AUTH)."""
    r = client.post("/demo/one-click")
    if r.status_code == 401 and not REQUIRE_AUTH:
        pytest.skip("Dev-Modus erwartet, aber 401 – ggf. Auth aktiv?")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "company_id" in data
    assert "message" in data
