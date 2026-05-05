"""
Vergleich benachbarter Plan-Versionen: konsistente Texte, fehlende Daten, Schwellen.
Konfiguration: EASYPLAN_DELTA_COST_THRESHOLD, EASYPLAN_DELTA_ETA_THRESHOLD (Minuten),
optional EASYPLAN_DELTA_CACHE_TTL (Sekunden, 0 = aus).
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# Cache: Key -> (expires_epoch, payload) — nur bei TTL>0
_cache: Dict[str, Tuple[float, Any]] = {}


@dataclass(frozen=True)
class DeltaThresholds:
    cost: int
    eta_minutes: int


def thresholds_from_env() -> DeltaThresholds:
    try:
        cost = int(os.environ.get("EASYPLAN_DELTA_COST_THRESHOLD", "1"))
    except ValueError:
        cost = 1
    try:
        eta = int(os.environ.get("EASYPLAN_DELTA_ETA_THRESHOLD", "5"))
    except ValueError:
        eta = 5
    cost = max(0, cost)
    eta = max(0, eta)
    return DeltaThresholds(cost=cost, eta_minutes=eta)


def cache_ttl_seconds() -> float:
    try:
        t = float(os.environ.get("EASYPLAN_DELTA_CACHE_TTL", "0"))
    except ValueError:
        t = 0.0
    return max(0.0, t)


def cache_get(key: str) -> Any:
    ttl = cache_ttl_seconds()
    if ttl <= 0:
        return None
    now = time.time()
    hit = _cache.get(key)
    if not hit:
        return None
    exp, payload = hit
    if now >= exp:
        del _cache[key]
        return None
    return payload


def cache_set(key: str, payload: Any) -> None:
    ttl = cache_ttl_seconds()
    if ttl <= 0:
        return
    _cache[key] = (time.time() + ttl, payload)


def compare_adjacent_versions(
    cur: Dict[str, Any],
    prev: Dict[str, Any],
    cur_v: int,
    prev_v: int,
    thresholds: DeltaThresholds,
) -> Tuple[
    List[str],
    List[str],
    Optional[int],
    Optional[int],
    Optional[int],
]:
    """
    Liefert (changes, quality_notes, cost_delta, unassigned_delta, eta_span_delta).
    changes = fachliche Delta-Chips (nur „wesentlich“ bzw. strukturell).
    quality_notes = fehlende Vergleichsdaten / Hinweise (nicht als „Änderung“ gewertet).
    """
    changes: List[str] = []
    quality_notes: List[str] = []
    cost_delta: Optional[int] = None
    unassigned_delta: Optional[int] = None
    eta_span_delta: Optional[int] = None

    cur_cost = cur.get("total_cost")
    prev_cost = prev.get("total_cost")
    if isinstance(cur_cost, int) and isinstance(prev_cost, int):
        cost_delta = cur_cost - prev_cost
        if abs(cost_delta) >= thresholds.cost:
            sign = "+" if cost_delta > 0 else ""
            changes.append(
                f"Kosten {sign}{cost_delta} ggü. V{prev_v} (≥{thresholds.cost})"
            )
    else:
        if cur_cost is None or prev_cost is None:
            quality_notes.append(
                "Kosten: nicht vergleichbar (fehlende Planwerte in einer Version)."
            )

    cur_un = cur.get("unassigned_count")
    prev_un = prev.get("unassigned_count")
    if isinstance(cur_un, int) and isinstance(prev_un, int):
        unassigned_delta = cur_un - prev_un
        if unassigned_delta != 0:
            sign = "+" if unassigned_delta > 0 else ""
            changes.append(
                f"Unassigned {sign}{unassigned_delta} Sendung(en) ggü. V{prev_v}"
            )
    else:
        if cur_un is None or prev_un is None:
            quality_notes.append(
                "Unassigned: nicht vergleichbar (PlanRun/Snapshot fehlt teilweise)."
            )

    sig_cur = cur.get("vehicle_signature") or ""
    sig_prev = prev.get("vehicle_signature") or ""
    if sig_cur != sig_prev:
        changes.append("Fahrzeugzuordnung geändert ggü. V" + str(prev_v))

    ord_cur = cur.get("order_signature") or ""
    ord_prev = prev.get("order_signature") or ""
    if ord_cur != ord_prev:
        changes.append("Stop-Reihenfolge geändert ggü. V" + str(prev_v))

    cur_eta = cur.get("eta_span")
    prev_eta = prev.get("eta_span")
    if isinstance(cur_eta, int) and isinstance(prev_eta, int):
        eta_span_delta = cur_eta - prev_eta
        if abs(eta_span_delta) >= thresholds.eta_minutes:
            sign = "+" if eta_span_delta > 0 else ""
            changes.append(
                f"ETA-Spanne {sign}{eta_span_delta} Min. ggü. V{prev_v} (≥{thresholds.eta_minutes})"
            )
    else:
        if cur_eta is None or prev_eta is None:
            quality_notes.append(
                "ETA-Spanne: nicht vergleichbar (keine oder unvollständige Stop-Zeiten)."
            )

    if not changes and not quality_notes:
        # explizit: kein fachlicher Unterschied oberhalb Schwellen / keine Strukturänderung
        pass

    return changes, quality_notes, cost_delta, unassigned_delta, eta_span_delta
