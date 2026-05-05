"""Umgebungsvariablen für IMAP/SMTP Lieferschein-Eingang."""
from __future__ import annotations

import os
import uuid
from dataclasses import dataclass


def _truthy(v: str | None) -> bool:
    if not v:
        return False
    return v.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class EmailIntakeConfig:
    enabled: bool
    imap_host: str
    imap_port: int
    imap_user: str
    imap_password: str
    imap_tls: bool
    poll_interval_ms: int
    default_company_id: uuid.UUID | None
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_from: str | None
    confirm_enabled: bool
    processed_folder: str | None
    error_folder: str | None


def load_email_intake_config() -> EmailIntakeConfig:
    cid_raw = os.environ.get("EMAIL_DEFAULT_COMPANY_ID", "").strip()
    default_company: uuid.UUID | None = None
    if cid_raw:
        try:
            default_company = uuid.UUID(cid_raw)
        except ValueError:
            default_company = None

    return EmailIntakeConfig(
        enabled=_truthy(os.environ.get("EMAIL_IMAP_ENABLED")),
        imap_host=os.environ.get("EMAIL_IMAP_HOST", "").strip(),
        imap_port=int(os.environ.get("EMAIL_IMAP_PORT", "993") or 993),
        imap_user=os.environ.get("EMAIL_IMAP_USER", "").strip(),
        imap_password=os.environ.get("EMAIL_IMAP_PASSWORD", "").strip(),
        imap_tls=_truthy(os.environ.get("EMAIL_IMAP_TLS", "true")),
        poll_interval_ms=int(os.environ.get("EMAIL_POLL_INTERVAL_MS", "120000") or 120000),
        default_company_id=default_company,
        smtp_host=os.environ.get("EMAIL_SMTP_HOST", "").strip() or None,
        smtp_port=int(os.environ.get("EMAIL_SMTP_PORT", "587") or 587),
        smtp_user=os.environ.get("EMAIL_SMTP_USER", "").strip() or None,
        smtp_password=os.environ.get("EMAIL_SMTP_PASSWORD", "").strip() or None,
        smtp_from=os.environ.get("EMAIL_SMTP_FROM", "").strip() or None,
        confirm_enabled=_truthy(os.environ.get("EMAIL_CONFIRM_ENABLED", "true")),
        processed_folder=os.environ.get("EMAIL_IMAP_PROCESSED_FOLDER", "").strip() or None,
        error_folder=os.environ.get("EMAIL_IMAP_ERROR_FOLDER", "").strip() or None,
    )


def config_is_runnable(cfg: EmailIntakeConfig) -> bool:
    if not cfg.enabled:
        return False
    if not cfg.imap_host or not cfg.imap_user or not cfg.imap_password:
        return False
    if not cfg.default_company_id:
        return False
    return True
