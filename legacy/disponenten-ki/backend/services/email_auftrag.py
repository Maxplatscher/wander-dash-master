"""Shipment aus Parser-Ergebnis erzeugen (inkl. Platzhalter-Koordinaten)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from models import EmailLog, Shipment
from services.lieferschein_parser import ParsedLieferschein
from services.lieferschein_validation import (
    shipment_row_to_validation_dict,
    validate_shipment_for_release,
)


def coords_from_address(address: str, depot_x: int, depot_y: int) -> tuple[int, int]:
    if not address or len(address.strip()) < 4:
        return depot_x + 17, depot_y + 29
    h = abs(hash(address.strip()))
    return depot_x + (h % 800), depot_y + (h % 600)


def windows_from_time_hint(hint: str | None) -> tuple[int, int]:
    if not hint:
        return 0, 1439
    h = hint.lower()
    if "vormittag" in h or "vor 12" in h or "vor 10" in h:
        return 360, 720
    if "nachmittag" in h or "nach 12" in h:
        return 720, 1140
    return 480, 1200


def build_positionen_json(lines: list[str]) -> list[dict[str, str]]:
    return [{"text": ln[:500]} for ln in lines[:40]]


def create_shipment_from_email(
    db: Session,
    *,
    company_id: uuid.UUID,
    parsed: ParsedLieferschein,
    seller_email: str | None,
    raw_text: str,
    received_at: datetime | None,
    depot_x: int,
    depot_y: int,
) -> Shipment:
    name_src = (parsed.customer or "Lieferschein (E-Mail)")[:200]
    wish = parsed.wish_date or date.today()
    ws, we = windows_from_time_hint(parsed.time_hint)
    demand = 1
    if parsed.weight_kg and parsed.weight_kg > 0:
        demand = max(1, min(200, parsed.weight_kg // 25 + 1))
    lx, ly = coords_from_address(parsed.address or "", depot_x, depot_y)
    now = datetime.now(timezone.utc)

    sh = Shipment(
        company_id=company_id,
        name=name_src,
        demand=demand,
        location_x=lx,
        location_y=ly,
        window_start=ws,
        window_end=we,
        service_date=wish,
        intake_source="email",
        intake_status=None,
        customer_name=(parsed.customer or name_src)[:300] if parsed.customer else name_src[:300],
        delivery_address=(parsed.address or "")[:2000] or None,
        email_notes=(parsed.notes or None),
        seller_email=(seller_email or None),
        raw_email=raw_text[:50000] if raw_text else None,
        positionen=build_positionen_json(parsed.artikel_lines) if parsed.artikel_lines else None,
        weight_kg=parsed.weight_kg,
        email_received_at=received_at,
        email_processed_at=now,
        missing_fields=None,
    )
    missing = validate_shipment_for_release(shipment_row_to_validation_dict(sh))
    if parsed.manual_review and parsed.missing == ["Kein erkanntes Lieferschein-Format"]:
        sh.intake_status = "manuell_prüfen"
        sh.missing_fields = missing if missing else ["customer_name", "delivery_address", "requested_date"]
    elif missing:
        sh.intake_status = "unvollständig"
        sh.missing_fields = missing
    else:
        sh.intake_status = None
        sh.missing_fields = None
    db.add(sh)
    db.flush()
    return sh


def log_email(
    db: Session,
    *,
    message_id: str | None,
    subject: str | None,
    from_addr: str | None,
    status: str,
    error_detail: str | None = None,
    shipment_id: uuid.UUID | None = None,
    body_preview: str | None = None,
) -> EmailLog:
    row = EmailLog(
        id=uuid.uuid4(),
        message_id=message_id[:900] if message_id else None,
        subject=(subject or "")[:500] or None,
        from_addr=(from_addr or "")[:500] or None,
        status=status,
        error_detail=error_detail,
        shipment_id=shipment_id,
        body_preview=(body_preview or "")[:8000] if body_preview else None,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(row)
    return row
