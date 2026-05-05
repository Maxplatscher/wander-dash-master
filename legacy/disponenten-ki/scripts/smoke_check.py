#!/usr/bin/env python3
"""
Automatisierter Smoke-Check (pytest): Demo -> Plan -> Deltas -> Aktivieren -> Driver-View.

Aufruf vom Projektroot:
  python scripts/smoke_check.py
  python scripts/smoke_check.py --all-tests   # gesamtes backend/tests/

Umgebung: Backend-DB muss erreichbar sein (wie bei lokalen pytest-Laeufen).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _venv_python() -> Path:
    if sys.platform == "win32":
        return ROOT / "backend" / ".venv" / "Scripts" / "python.exe"
    return ROOT / "backend" / ".venv" / "bin" / "python"


def main() -> int:
    p = argparse.ArgumentParser(description="Easy Planning – Smoke-Tests")
    p.add_argument(
        "--all-tests",
        action="store_true",
        help="Alle Tests unter backend/tests/ ausfuehren (nicht nur Smoke).",
    )
    args = p.parse_args()

    vpy = _venv_python()
    py = str(vpy) if vpy.is_file() else sys.executable

    if args.all_tests:
        target = str(ROOT / "backend" / "tests")
    else:
        target = str(ROOT / "backend" / "tests" / "test_smoke.py")

    cmd = [py, "-m", "pytest", target, "-v", "--tb=short"]
    print("Running:", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=str(ROOT))


if __name__ == "__main__":
    raise SystemExit(main())
