"""
Regelbasierter Parser für Lieferschein-E-Mails (DE).
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date
from email.message import Message
from typing import Any

# Optional PDF
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None  # type: ignore[misc, assignment]


@dataclass
class ParsedLieferschein:
    customer: str | None = None
    address: str | None = None
    wish_date: date | None = None
    time_hint: str | None = None
    artikel_lines: list[str] = field(default_factory=list)
    weight_kg: int | None = None
    notes: str | None = None
    manual_review: bool = False
    missing: list[str] = field(default_factory=list)

    def compute_missing(self) -> None:
        self.missing = []
        if not self.address or len(self.address.strip()) < 8:
            self.missing.append("Lieferadresse")
        if not self.wish_date:
            self.missing.append("Wunschtermin")


def _strip_html(html: str) -> str:
    t = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    t = re.sub(r"(?is)<style.*?>.*?</style>", " ", t)
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</p\s*>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def _get_body_text(msg: Message) -> str:
    parts: list[str] = []

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition") or "")
            if "attachment" in disp.lower():
                continue
            if ctype == "text/plain":
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        parts.append(payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
                except Exception:
                    pass
            elif ctype == "text/html":
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        raw = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                        parts.append(_strip_html(raw))
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    text = _strip_html(text)
                parts.append(text)
        except Exception:
            pass

    return "\n\n".join(p for p in parts if p.strip())


def _extract_pdf_text(data: bytes) -> str:
    if not PdfReader or not data:
        return ""
    try:
        reader = PdfReader(io.BytesIO(data))
        out: list[str] = []
        for page in reader.pages[:5]:
            t = page.extract_text() or ""
            if t.strip():
                out.append(t)
        return "\n".join(out)
    except Exception:
        return ""


def collect_attachment_text(msg: Message) -> str:
    chunks: list[str] = []
    if not msg.is_multipart():
        return ""
    for part in msg.walk():
        disp = str(part.get("Content-Disposition") or "")
        if "attachment" not in disp.lower():
            continue
        fname = part.get_filename() or ""
        if fname.lower().endswith(".pdf"):
            try:
                data = part.get_payload(decode=True)
                if isinstance(data, bytes):
                    t = _extract_pdf_text(data)
                    if t:
                        chunks.append(t)
            except Exception:
                pass
    return "\n\n".join(chunks)


_LINE_PATTERNS = [
    (re.compile(r"(?im)^\s*(?:Kunde|Empfänger|Kundenname)\s*[:]\s*(.+)$"), "customer"),
    (re.compile(r"(?im)^\s*Lieferadresse\s*[:]\s*(.+)$"), "address"),
    (re.compile(r"(?im)^\s*(?:Wunschtermin|Lieferdatum|Termin|Liefertermin)\s*[:]\s*(.+)$"), "date"),
    (re.compile(r"(?im)^\s*(?:Uhrzeit|Zeitfenster)\s*[:]\s*(.+)$"), "time_hint"),
    (re.compile(r"(?im)^\s*Gesamtgewicht\s*[:]\s*(.+)$"), "weight"),
    (re.compile(r"(?im)^\s*Gewicht\s*[:]\s*(.+)$"), "weight"),
    (re.compile(r"(?im)^\s*Bemerkungen\s*[:]\s*(.+)$"), "notes"),
    (re.compile(r"(?im)^\s*Hinweise\s*[:]\s*(.+)$"), "notes"),
]

_DATE_RE = re.compile(
    r"\b(\d{1,2})[.](\d{1,2})[.](\d{2,4})\b"
)
_WEIGHT_RE = re.compile(
    r"(\d+)\s*(?:kg|KG|Kg)\b"
)


def _parse_date_line(s: str) -> date | None:
    m = _DATE_RE.search(s)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def _parse_weight_line(s: str) -> int | None:
    m = _WEIGHT_RE.search(s)
    if m:
        return int(m.group(1))
    return None


def _extract_artikel_block(text: str) -> list[str]:
    lines = text.splitlines()
    out: list[str] = []
    in_block = False
    for line in lines:
        stripped = line.strip()
        up = stripped.lower()
        if re.match(r"(?i)^Artikel\s*:\s*$", stripped) or re.match(
            r"(?i)^Positionen\s*:\s*$", stripped
        ):
            in_block = True
            continue
        if in_block:
            if not stripped:
                if out:
                    break
                continue
            if re.match(
                r"(?i)^(Kunde|Lieferadresse|Wunschtermin|Bemerkungen|Gesamtgewicht|Uhrzeit)\s*:",
                stripped,
            ):
                break
            if stripped.startswith("-") or stripped.startswith("•") or re.match(r"^\d+", stripped):
                out.append(stripped.lstrip("-• ").strip())
            elif out:
                out[-1] = out[-1] + " " + stripped
            else:
                out.append(stripped)
    return out[:50]


def parse_lieferschein_from_text(
    text: str,
    subject: str = "",
) -> ParsedLieferschein:
    result = ParsedLieferschein()
    full = (subject + "\n" + text).strip()
    if not full:
        result.manual_review = True
        result.missing = ["Leerer Inhalt"]
        return result

    for rx, kind in _LINE_PATTERNS:
        for m in rx.finditer(full):
            val = m.group(1).strip()
            if kind == "customer" and val:
                result.customer = val
            elif kind == "address" and val:
                result.address = val
            elif kind == "date" and val:
                d = _parse_date_line(val)
                if d:
                    result.wish_date = d
            elif kind == "time_hint" and val:
                result.time_hint = val
            elif kind == "weight" and val:
                w = _parse_weight_line(val)
                if w is not None:
                    result.weight_kg = w
            elif kind == "notes" and val:
                result.notes = (result.notes + "\n" if result.notes else "") + val

    result.artikel_lines = _extract_artikel_block(full)
    if not result.customer:
        subj_customer = re.match(r"(?i)lieferschein\s*[\u2013\-]\s*(.+)$", subject.strip())
        if subj_customer:
            result.customer = subj_customer.group(1).strip()

    # Heuristik: kein einziger bekannter Schlüssel → manuell
    has_signal = bool(
        result.customer
        or result.address
        or result.wish_date
        or result.artikel_lines
        or result.weight_kg
        or result.notes
    )
    if not has_signal:
        result.manual_review = True
        result.missing = ["Kein erkanntes Lieferschein-Format"]
        return result

    result.compute_missing()
    if result.manual_review:
        return result
    if result.missing:
        pass  # unvollständig
    return result


def parse_email_message(msg: Message) -> tuple[str, ParsedLieferschein]:
    """Gibt (kombinierter Rohtext, Parse-Ergebnis) zurück."""
    body = _get_body_text(msg)
    pdf_extra = collect_attachment_text(msg)
    combined = body
    if pdf_extra:
        combined = (body + "\n\n--- PDF ---\n" + pdf_extra).strip()
    subj = msg.get("Subject") or ""
    return combined, parse_lieferschein_from_text(combined, subject=subj)
