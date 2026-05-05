#!/usr/bin/env python3
"""
Weicher Demo-Reset: stellt den Demo-Mandanten „Easy Planning Demo“ per API wieder her
(entspricht POST /demo/one-click im Dashboard).

Kein DB-Vollreset – dafuer: docker compose down -v (siehe PILOT_READINESS.md).

Umgebung:
  EASYPLAN_BASE_URL   Standard http://127.0.0.1:8000
  EASYPLAN_SMOKE_TOKEN  Optional JWT, wenn EASYPLAN_REQUIRE_AUTH=1
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    base = os.environ.get("EASYPLAN_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    token = os.environ.get("EASYPLAN_SMOKE_TOKEN", "").strip()

    def get(path: str) -> tuple[int, str]:
        req = urllib.request.Request(base + path, method="GET")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            return e.code, body
        except urllib.error.URLError as e:
            print("FAIL:", e.reason, file=sys.stderr)
            return 0, ""

    def post(path: str, body: bytes = b"{}") -> tuple[int, str]:
        req = urllib.request.Request(
            base + path,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        if token:
            req.add_header("Authorization", "Bearer " + token)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            b = e.read().decode("utf-8", errors="replace")
            return e.code, b
        except urllib.error.URLError as e:
            print("FAIL:", e.reason, file=sys.stderr)
            return 0, ""

    code, _ = get("/health")
    if code != 200:
        print("Health check failed:", code, file=sys.stderr)
        return 1
    print("OK /health")

    code, text = post("/demo/one-click")
    if code != 200:
        print("POST /demo/one-click failed:", code, text[:500], file=sys.stderr)
        return 1
    try:
        data = json.loads(text)
        print("OK demo/one-click company_id=", data.get("company_id"), "date=", data.get("date"))
    except json.JSONDecodeError:
        print("OK demo/one-click (non-JSON body)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
