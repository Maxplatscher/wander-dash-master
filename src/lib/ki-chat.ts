export type ChatRole = 'disponent' | 'ki';

export type ChatMessage = {
  role: ChatRole;
  text: string;
  at: string;
};

export const SETTINGS_CHAT_TYPE = 'settings_chat';

export function toChatApiMessages(messages: ChatMessage[], limit = 16) {
  return messages
    .filter((item) => item.text.trim().length > 0)
    .slice(-limit)
    .map((item) => ({
      role: item.role,
      text: item.text.trim(),
    }));
}

export function parseChatReply(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('Leere Antwort von der KI.');
  }
  const payload = data as { error?: unknown; message?: unknown };
  if (typeof payload.error === 'string' && payload.error.trim()) {
    throw new Error(payload.error);
  }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  throw new Error('Die KI hat keine lesbare Antwort geliefert.');
}

export function formatChatFooter(messages: ChatMessage[], now = new Date()): string {
  const turns = messages.filter((item) => item.role === 'disponent').length;
  const countLabel = turns === 1 ? '1 Nachricht' : `${turns} Nachrichten`;
  const last = messages.at(-1);
  if (!last) return countLabel;
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
