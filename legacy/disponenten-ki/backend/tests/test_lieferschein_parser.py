"""Parser für Lieferschein-E-Mails."""
from datetime import date

from services.lieferschein_parser import parse_lieferschein_from_text


def test_parser_full_template():
    text = """
Kunde: Müller GmbH
Lieferadresse: Hauptstr. 5, 30159 Hannover
Wunschtermin: 28.03.2026
Uhrzeit: Vormittags (vor 12 Uhr)

Artikel:
- 3x Palette Zement
- 2x Sack Kalk

Gesamtgewicht: 200 kg
Bemerkungen: Bitte klingeln
"""
    p = parse_lieferschein_from_text(text, subject="Lieferschein – Müller GmbH")
    assert p.customer == "Müller GmbH"
    assert "Hannover" in (p.address or "")
    assert p.wish_date == date(2026, 3, 28)
    assert p.weight_kg == 200
    assert not p.missing


def test_parser_incomplete_missing_address():
    text = """
Kunde: Test
Wunschtermin: 01.04.2026
"""
    p = parse_lieferschein_from_text(text)
    assert "Lieferadresse" in p.missing
