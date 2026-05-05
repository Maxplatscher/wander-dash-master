"""Bestätigungs-E-Mails (SMTP, analog nodemailer)."""
from __future__ import annotations

import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.email_intake_config import EmailIntakeConfig


def send_intake_confirmation(
    cfg: EmailIntakeConfig,
    to_addr: str,
    subject: str,
    body_text: str,
) -> None:
    if not cfg.confirm_enabled or not cfg.smtp_host or not cfg.smtp_from:
        return
    user = cfg.smtp_user or cfg.imap_user
    password = cfg.smtp_password or cfg.imap_password
    if not user or not password:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg.smtp_from
    msg["To"] = to_addr
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=30) as server:
        try:
            server.starttls()
        except smtplib.SMTPException:
            pass
        server.login(user, password)
        server.sendmail(cfg.smtp_from, [to_addr], msg.as_string())


def format_success_mail(customer: str, service_date: str, shipment_id: uuid.UUID) -> tuple[str, str]:
    subj = f"✅ Lieferschein eingegangen – {customer} am {service_date}"
    body = (
        f"Hallo,\n\n"
        f"dein Lieferschein wurde erfolgreich erfasst und wartet auf Zuweisung in der Tourenplanung.\n"
        f"Auftrags-ID: {shipment_id}\n"
        f"Kunde: {customer}\n"
        f"Wunschtermin (Datum): {service_date}\n\n"
        f"Bei Rückfragen wende dich an die Disposition.\n"
    )
    return subj, body


def format_release_mail(
    customer: str,
    service_date: str,
    dispatcher_label: str,
    supplemented: list[str],
) -> tuple[str, str]:
    sup = ", ".join(supplemented) if supplemented else "–"
    subj = f"✅ Lieferschein freigegeben – {customer}, {service_date}"
    body = (
        f"Hallo,\n\n"
        f"dein Lieferschein für {customer} (Liefertermin: {service_date})\n"
        f"wurde geprüft und für die Tourenplanung freigegeben.\n\n"
        f"Ergänzte / geprüfte Felder: {sup}\n"
        f"Freigegeben von: {dispatcher_label}\n\n"
        f"Bei Rückfragen wende dich an die Disposition.\n"
    )
    return subj, body


def format_incomplete_mail(missing: list[str]) -> tuple[str, str]:
    fields = ", ".join(missing) if missing else "unbekannt"
    subj = "⚠️ Lieferschein unvollständig – bitte prüfen"
    body = (
        f"Hallo,\n\n"
        f"folgende Pflichtangaben konnten nicht zuverlässig erkannt werden: {fields}.\n"
        f"Bitte sende die E-Mail erneut mit der Vorlage oder wende dich an die Disposition.\n\n"
        f"Die Nachricht wurde dennoch zur manuellen Bearbeitung gespeichert.\n"
    )
    return subj, body
