"""
IMAP-Polling: ungelesene Lieferschein-Mails verarbeiten.
"""
from __future__ import annotations

import email
import hashlib
import imaplib
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr, parsedate_to_datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db import SessionLocal
from models import EmailLog
from services.email_auftrag import create_shipment_from_email, log_email
from services.email_confirm import (
    format_incomplete_mail,
    format_success_mail,
    send_intake_confirmation,
)
from services.email_intake_config import EmailIntakeConfig, config_is_runnable, load_email_intake_config
from services.lieferschein_parser import parse_email_message

# Dashboard /status
_last_poll_at: datetime | None = None
_last_success_at: datetime | None = None
_last_error: str | None = None
_consecutive_failures: int = 0


def get_poller_state() -> dict:
    return {
        "last_poll_at": _last_poll_at.isoformat() if _last_poll_at else None,
        "last_success_at": _last_success_at.isoformat() if _last_success_at else None,
        "last_error": _last_error,
        "consecutive_failures": _consecutive_failures,
        "alert": _consecutive_failures >= 3,
    }


def _decode_mime_header(s: str | None) -> str:
    if not s:
        return ""
    try:
        return str(make_header(decode_header(s)))
    except Exception:
        return s


def _stable_message_id(msg: email.message.Message, raw: bytes) -> str:
    mid = msg.get("Message-ID")
    if mid:
        return mid.strip().strip("<>")
    h = hashlib.sha256()
    h.update((msg.get("From") or "").encode("utf-8", errors="ignore"))
    h.update((msg.get("Date") or "").encode("utf-8", errors="ignore"))
    h.update((msg.get("Subject") or "").encode("utf-8", errors="ignore"))
    h.update(raw[:2000])
    return "gen-" + h.hexdigest()[:40]


def _imap_connect(cfg: EmailIntakeConfig) -> imaplib.IMAP4_SSL | imaplib.IMAP4:
    if cfg.imap_tls:
        m = imaplib.IMAP4_SSL(cfg.imap_host, cfg.imap_port, timeout=60)
    else:
        m = imaplib.IMAP4(cfg.imap_host, cfg.imap_port, timeout=60)
    m.login(cfg.imap_user, cfg.imap_password)
    return m


def _ensure_folder(mail: imaplib.IMAP4_SSL | imaplib.IMAP4, name: str) -> None:
    try:
        mail.create(name)
    except Exception:
        pass


def _move_or_copy(
    mail: imaplib.IMAP4_SSL | imaplib.IMAP4,
    uid: bytes,
    folder: str | None,
) -> None:
    if not folder:
        return
    _ensure_folder(mail, folder)
    try:
        mail.uid("COPY", uid, folder)
        mail.uid("STORE", uid, "+FLAGS", "\\Deleted")
        mail.expunge()
    except Exception:
        try:
            mail.uid("COPY", uid, folder)
        except Exception:
            pass


def process_one_raw_email(
    db: Session,
    cfg: EmailIntakeConfig,
    raw: bytes,
    mail: imaplib.IMAP4_SSL | imaplib.IMAP4 | None = None,
    uid: bytes | None = None,
    depot_x: int = 103533,
    depot_y: int = 523883,
) -> None:
    global _last_success_at, _last_error
    msg = email.message_from_bytes(raw)
    mid = _stable_message_id(msg, raw)
    subj = _decode_mime_header(msg.get("Subject"))
    from_raw = msg.get("From") or ""
    _, seller_addr = parseaddr(from_raw)
    seller_addr = seller_addr.strip() or None

    existing = db.execute(select(EmailLog).where(EmailLog.message_id == mid)).scalar_one_or_none()
    if existing:
        if mail and uid:
            try:
                mail.uid("STORE", uid, "+FLAGS", "\\Seen")
            except Exception:
                pass
        return

    combined, parsed = parse_email_message(msg)
    preview = combined[:4000] if combined else ""

    try:
        shipment = create_shipment_from_email(
            db,
            company_id=cfg.default_company_id,  # type: ignore[arg-type]
            parsed=parsed,
            seller_email=seller_addr,
            raw_text=combined,
            received_at=_parse_received_date(msg),
            depot_x=depot_x,
            depot_y=depot_y,
        )
        if parsed.manual_review:
            log_status = "manual_review"
        elif parsed.missing:
            log_status = "incomplete"
        else:
            log_status = "ok"
        log_email(
            db,
            message_id=mid,
            subject=subj,
            from_addr=from_raw[:500],
            status=log_status,
            shipment_id=shipment.id,
            body_preview=preview,
        )
        db.commit()
        _last_success_at = datetime.now(timezone.utc)
        _last_error = None

        if cfg.confirm_enabled and seller_addr:
            try:
                if shipment.intake_status:
                    s, b = format_incomplete_mail(list(parsed.missing or []))
                    send_intake_confirmation(cfg, seller_addr, s, b)
                else:
                    sd = str(shipment.service_date or "")
                    s, b = format_success_mail(shipment.name, sd, shipment.id)
                    send_intake_confirmation(cfg, seller_addr, s, b)
            except Exception:
                pass

        if mail and uid:
            try:
                mail.uid("STORE", uid, "+FLAGS", "\\Seen")
            except Exception:
                pass
            if parsed.manual_review and cfg.error_folder:
                _move_or_copy(mail, uid, cfg.error_folder)
            elif cfg.processed_folder:
                _move_or_copy(mail, uid, cfg.processed_folder)

    except IntegrityError:
        db.rollback()
        log_email(
            db,
            message_id=mid,
            subject=subj,
            from_addr=from_raw[:500],
            status="duplicate",
            body_preview=preview,
        )
        db.commit()
        if mail and uid:
            try:
                mail.uid("STORE", uid, "+FLAGS", "\\Seen")
            except Exception:
                pass
    except Exception as ex:
        db.rollback()
        try:
            log_email(
                db,
                message_id=mid,
                subject=subj,
                from_addr=from_raw[:500],
                status="error",
                error_detail=str(ex)[:4000],
                body_preview=preview,
            )
            db.commit()
        except Exception:
            db.rollback()
        if mail and uid:
            try:
                mail.uid("STORE", uid, "+FLAGS", "\\Seen")
            except Exception:
                pass
            _move_or_copy(mail, uid, cfg.error_folder)


def _parse_received_date(msg: email.message.Message) -> datetime | None:
    ds = msg.get("Date")
    if not ds:
        return None
    try:
        dt = parsedate_to_datetime(ds)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def poll_once(cfg: EmailIntakeConfig | None = None, depot_x: int = 103533, depot_y: int = 523883) -> None:
    global _last_poll_at, _consecutive_failures, _last_error
    cfg = cfg or load_email_intake_config()
    _last_poll_at = datetime.now(timezone.utc)
    if not config_is_runnable(cfg):
        return
    mail = None
    try:
        mail = _imap_connect(cfg)
        mail.select("INBOX", readonly=False)
        typ, data = mail.uid("SEARCH", None, "UNSEEN")
        if typ != "OK" or not data or not data[0]:
            _consecutive_failures = 0
            _last_error = None
            return
        uids = data[0].split()
        for uid in uids:
            t2, d2 = mail.uid("FETCH", uid, "(RFC822)")
            if t2 != "OK" or not d2:
                continue
            raw = None
            for part in d2:
                if isinstance(part, tuple) and len(part) >= 2:
                    raw = part[1]
                    break
            if not isinstance(raw, (bytes, bytearray)):
                continue
            db = SessionLocal()
            try:
                process_one_raw_email(
                    db, cfg, bytes(raw), mail=mail, uid=uid, depot_x=depot_x, depot_y=depot_y
                )
            finally:
                db.close()
        _consecutive_failures = 0
        _last_error = None
    except Exception as ex:
        _consecutive_failures += 1
        _last_error = str(ex)
        raise
    finally:
        try:
            if mail:
                mail.logout()
        except Exception:
            pass
