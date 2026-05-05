"""
ETA- / Fahrzeit-Provider-Abstraktion.

- Eingang: Koordinaten (x/y, int)
- Ausgang: Fahrzeitmatrix (int, Minuten)
- Provider: Manhattan (lokal) oder OSRM (HTTP), mit robustem Fallback.
"""

from __future__ import annotations

import math
import os
from typing import List, Sequence, Tuple

import httpx

# Aktuell verwendeter Provider (für Logging/Snapshots).
CURRENT_PROVIDER = "manhattan"


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _manhattan_matrix(coords: Sequence[Tuple[int, int]]) -> List[List[int]]:
    n = len(coords)
    matrix: List[List[int]] = [[0] * n for _ in range(n)]
    geo_mode = any(abs(x) > 1000 or abs(y) > 1000 for x, y in coords)
    for i in range(n):
        x1, y1 = coords[i]
        for j in range(n):
            if i == j:
                continue
            x2, y2 = coords[j]
            if geo_mode:
                # Fallback fuer geo-encodierte Koordinaten: Luftlinie -> Minutenapproximation.
                lon1, lat1 = _xy_to_lonlat(x1, y1)
                lon2, lat2 = _xy_to_lonlat(x2, y2)
                r = 6371.0
                phi1 = math.radians(lat1)
                phi2 = math.radians(lat2)
                dphi = math.radians(lat2 - lat1)
                dl = math.radians(lon2 - lon1)
                a = (
                    math.sin(dphi / 2) ** 2
                    + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
                )
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                km = r * c
                # konservative Fahrzeit-Approximation: 55 km/h mittlere Geschwindigkeit
                matrix[i][j] = max(1, int(math.ceil((km / 55.0) * 60.0)))
            else:
                # Legacy Grid-Modell: 1 Einheit ~= 1 Minute.
                matrix[i][j] = abs(x1 - x2) + abs(y1 - y2)
    return matrix


def _xy_to_lonlat(x: int, y: int) -> tuple[float, float]:
    """
    Lokale Demo-Koordinaten in geographische Koordinaten umrechnen.

    Standardmäßig entspricht dies der Frontend-Visualisierung:
    lon = center_lon + x * 0.005
    lat = center_lat + y * 0.005
    """
    # Modus A (legacy Demo-Grid): kleine Werte als Offsets rund um mapCenter.
    # Modus B (geo-encoded): große Werte sind echte Koordinaten * 10_000.
    if abs(x) > 1000 or abs(y) > 1000:
        lon = float(x) / 10000.0
        lat = float(y) / 10000.0
        return (lon, lat)

    center_lat = _env_float("EASYPLAN_OSRM_CENTER_LAT", 50.11)
    center_lon = _env_float("EASYPLAN_OSRM_CENTER_LON", 8.68)
    scale = _env_float("EASYPLAN_OSRM_GRID_SCALE", 0.005)
    return (center_lon + (x * scale), center_lat + (y * scale))


def _osrm_matrix(coords: Sequence[Tuple[int, int]]) -> List[List[int]]:
    """
    Matrix über OSRM /table erzeugen (Dauer in Minuten).
    """
    base = os.getenv("EASYPLAN_OSRM_URL", "https://router.project-osrm.org").strip().rstrip("/")
    timeout_s = _env_float("EASYPLAN_OSRM_TIMEOUT_S", 4.0)
    profile = os.getenv("EASYPLAN_OSRM_PROFILE", "driving").strip() or "driving"
    max_locs = _env_int("EASYPLAN_OSRM_MAX_LOCATIONS", 80)

    n = len(coords)
    if n == 0:
        return []
    if n > max_locs:
        raise ValueError(f"OSRM supports max {max_locs} locations in this setup (got {n})")

    parts = []
    for x, y in coords:
        lon, lat = _xy_to_lonlat(x, y)
        parts.append(f"{lon:.6f},{lat:.6f}")
    path = ";".join(parts)
    url = f"{base}/table/v1/{profile}/{path}"

    with httpx.Client(timeout=timeout_s) as client:
        res = client.get(url, params={"annotations": "duration"})
        res.raise_for_status()
        body = res.json()

    durations = body.get("durations")
    if not isinstance(durations, list) or len(durations) != n:
        raise ValueError("OSRM response missing durations matrix")

    matrix: List[List[int]] = [[0] * n for _ in range(n)]
    for i in range(n):
        row = durations[i]
        if not isinstance(row, list) or len(row) != n:
            raise ValueError("OSRM durations row has unexpected length")
        for j in range(n):
            if i == j:
                matrix[i][j] = 0
                continue
            sec = row[j]
            if sec is None:
                raise ValueError("OSRM returned unreachable pair (None duration)")
            # Sekunden -> Minuten, aufrunden für stabile Integer-Kosten.
            matrix[i][j] = max(1, int(math.ceil(float(sec) / 60.0)))
    return matrix


def get_current_provider() -> str:
    return CURRENT_PROVIDER


def get_travel_matrix(
    coords: Sequence[Tuple[int, int]],
) -> List[List[int]]:
    """
    Liefert eine N×N-Matrix: travel_time[i][j] in Minuten.
    """
    global CURRENT_PROVIDER

    configured = os.getenv("EASYPLAN_ETA_PROVIDER", "auto").strip().lower()
    use_osrm = configured in ("osrm", "auto")

    if use_osrm:
        try:
            matrix = _osrm_matrix(coords)
            CURRENT_PROVIDER = "osrm"
            return matrix
        except Exception as exc:
            # Für Demo-Stabilität niemals hart fehlschlagen; auf Manhattan zurückfallen.
            print(f"[eta_provider] OSRM failed, fallback to manhattan: {exc}")

    CURRENT_PROVIDER = "manhattan"
    return _manhattan_matrix(coords)
