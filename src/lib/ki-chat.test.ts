import { describe, expect, it } from 'vitest';
import { formatChatFooter, parseChatReply, toChatApiMessages } from './ki-chat';

describe('toChatApiMessages', () => {
  it('nimmt nur die letzten Einträge und streicht Leere', () => {
    const messages = [
      { role: 'disponent' as const, text: 'eins', at: '1' },
      { role: 'ki' as const, text: '  ', at: '2' },
      { role: 'disponent' as const, text: 'zwei', at: '3' },
    ];
    expect(toChatApiMessages(messages, 1)).toEqual([{ role: 'disponent', text: 'zwei' }]);
  });
});

describe('parseChatReply', () => {
  it('liest die Nachricht', () => {
    expect(parseChatReply({ message: '  Verstanden.  ' })).toBe('Verstanden.');
  });

  it('wirft bei Fehlerfeld', () => {
    expect(() => parseChatReply({ error: 'KI-Ratenlimit erreicht.' })).toThrow(/Ratenlimit/);
  });
});

describe('formatChatFooter', () => {
  it('zählt Disponenten-Nachrichten', () => {
    expect(
      formatChatFooter(
        [
          { role: 'disponent', text: 'a', at: '2026-08-26T16:40:00.000Z' },
          { role: 'ki', text: 'b', at: '2026-08-26T16:40:05.000Z' },
        ],
        new Date('2026-08-26T18:00:00.000Z'),
      ),
    ).toMatch(/^1 Nachricht · zuletzt heute /);
  });
});
