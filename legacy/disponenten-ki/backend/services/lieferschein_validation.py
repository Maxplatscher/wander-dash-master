"""
Zentrale Pflichtfeld-Prüfung für Lieferschein-Freigabe (Block 13).
Gleiche Logik wie nach E-Mail-Import – einheitliche Feld-Schlüssel.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any, Mapping

# Logische Namen (API / Fehlerliste) → passen zu Freigabe-Body
PFLICHTFELDER = [
    "customer_name",
    "delivery_address",
    "requested_date",
]

OPTIONALE_FELDER = [
    "weight_kg",
    "positionen",
    "email_notes",
]


def _str_ok(v: Any, min_len: int = 1) -> bool:
    if v is None:
        return False
    s = str(v).strip()
    return len(s) >= min_len


def _address_ok(v: Any) -> bool:
    """Mindestens Straße + PLZ/Ort erkennbar (heuristisch)."""
    if not _str_ok(v, min_len=8):
        return False
    s = str(v).strip()
    if re.search(r"\b\d{4,5}\b", s):
        return True
    # Fallback: längere Freitextadresse ohne erkennbare PLZ
    return len(s) >= 12


def _date_ok(v: Any) -> bool:
    return isinstance(v, date)


def validate_shipment_for_release(shipment: Mapping[str, Any]) -> list[str]:
    """
    Gibt die Liste fehlender Pflichtfelder (logische Schlüssel) zurück.
    Leere Liste = freigabefähig.
    `requested_date` entspricht dem Service-/Wunschtermin (Datum).
    """
    missing: list[str] = []

    if not _str_ok(shipment.get("customer_name"), min_len=2):
        missing.append("customer_name")
    if not _address_ok(shipment.get("delivery_address")):
        missing.append("delivery_address")
    rd = shipment.get("requested_date")
    if rd is None and shipment.get("service_date") is not None:
        rd = shipment.get("service_date")
    if not _date_ok(rd):
        missing.append("requested_date")

    return missing


def shipment_row_to_validation_dict(row: Any) -> dict[str, Any]:
    """ORM-Shipment oder ähnliches → flaches Dict für validate_shipment_for_release."""
    return {
        "customer_name": getattr(row, "customer_name", None) or getattr(row, "name", None),
        "delivery_address": getattr(row, "delivery_address", None),
        "requested_date": getattr(row, "service_date", None),
        "service_date": getattr(row, "service_date", None),
        "weight_kg": getattr(row, "weight_kg", None),
        "positionen": getattr(row, "positionen", None),
        "email_notes": getattr(row, "email_notes", None),
    }
