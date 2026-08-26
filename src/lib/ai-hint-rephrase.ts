export type HintMessage = {
  role: 'disponent' | 'ki';
  text: string;
  at: string;
};

function extractTime(text: string): string | null {
  const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

function extractKg(text: string): string | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return match ? match[1].replace(',', '.') : null;
}

export function rephraseDispatchHint(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const time = extractTime(trimmed);
  const kg = extractKg(trimmed);

  const neverBefore = /nie vor|nicht vor|frühestens|erst (ab|nach)/i.test(trimmed);
  if (time && neverBefore) {
    const target = trimmed
      .replace(/nie vor[^,.]*/i, '')
      .replace(/nicht vor[^,.]*/i, '')
      .replace(/,?\s*(die|der|das)\s+.+$/i, '')
      .replace(/^an\s+/i, '')
      .trim()
      .replace(/[.,]$/, '');
    const name = target || 'diese Adresse';
    return `Notiert. Sendungen an ${name} bekommen ab jetzt ein Zeitfenster ab ${time}, auch wenn der Lieferschein früher angibt.`;
  }

  const neverAfter = /nie nach|nicht nach|spätestens|nicht später/i.test(trimmed);
  if (time && neverAfter) {
    const target = trimmed
      .replace(/nie nach[^,.]*/i, '')
      .replace(/nicht nach[^,.]*/i, '')
      .replace(/spätestens[^,.]*/i, '')
      .replace(/,?\s*(die|der|das)\s+.+$/i, '')
      .replace(/^an\s+/i, '')
      .trim()
      .replace(/[.,]$/, '');
    const name = target || 'diese Adresse';
    return `Notiert. Sendungen an ${name} müssen bis ${time} angefahren sein.`;
  }

  const driverCap = /fährt keine|nicht mehr als|maximal|über \d/i.test(trimmed);
  if (kg && driverCap) {
    const nameMatch = trimmed.match(/^([A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+)?)/u);
    const name = nameMatch?.[1] ?? 'dieser Fahrer';
    const pronoun = /in\b|Sarah|Lisa|Anna|Frau/i.test(name) ? 'ihre' : 'seine';
    return `Übernommen als Fahrerregel. Bei der Planung wird ${pronoun} Kapazität auf ${kg} kg begrenzt, statt der Fahrzeugkapazität.`;
  }

  const rule = trimmed.replace(/[.,]$/, '');
  return `Notiert. Bei der Tourenplanung gilt künftig: ${rule}.`;
}

export function formatHintFooter(messages: HintMessage[], now = new Date()): string {
  const hints = messages.filter((item) => item.role === 'disponent');
  const last = messages.at(-1);
  const countLabel =
    hints.length === 1 ? '1 gespeicherter Hinweis' : `${hints.length} gespeicherte Hinweise`;
  if (!last) return `${countLabel}`;
  const at = new Date(last.at);
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  const time = at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? `${countLabel} · zuletzt heute ${time}`
    : `${countLabel} · zuletzt ${at.toLocaleDateString('de-DE')} ${time}`;
}
