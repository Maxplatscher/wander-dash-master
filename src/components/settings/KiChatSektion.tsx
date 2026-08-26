import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiHints } from '@/hooks/useAiHints';
import { supabase } from '@/integrations/supabase/client';
import {
  SETTINGS_CHAT_TYPE,
  formatChatFooter,
  parseChatReply,
  toChatApiMessages,
} from '@/lib/ki-chat';
import { cn } from '@/lib/utils';

export function KiChatSektion({ companyId }: { companyId: string | null }) {
  const { messages, setMessages, loading, error, setError, insert } = useAiHints(companyId, 'chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const userAt = new Date().toISOString();
    const userMessage = { role: 'disponent' as const, text, at: userAt };
    const history = [...messages, userMessage];
    setMessages(history);
    setDraft('');
    setError(null);
    setSending(true);

    try {
      await insert('disponent', text, userAt);
      const { data, error: invokeError } = await supabase.functions.invoke('ai-resolve', {
        body: {
          type: SETTINGS_CHAT_TYPE,
          context: { messages: toChatApiMessages(history) },
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (invokeError) {
        const fromBody =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : null;
        throw new Error(fromBody || invokeError.message);
      }
      const reply = parseChatReply(data);
      const kiAt = new Date().toISOString();
      setMessages((current) => [...current, { role: 'ki', text: reply, at: kiAt }]);
      await insert('ki', reply, kiAt);
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
      const message = timedOut
        ? 'Die KI antwortet gerade nicht (Zeitüberschreitung). Bitte gleich nochmal senden.'
        : cause instanceof Error && cause.message.trim()
          ? cause.message
          : 'Die KI ist gerade nicht erreichbar.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <p className="card-title">KI-Chat</p>
        <p className="meta-text mt-1">
          Hier kannst du mit der KI sprechen, damit sie dazulernt. Jede Nachricht wird vollständig in
          der Datenbank gespeichert und fließt in den nächsten Planungslauf ein.
        </p>
      </div>

      <div ref={listRef} className="space-y-4 min-h-[160px] max-h-[360px] overflow-y-auto pr-1">
        {loading && messages.length === 0 ? (
          <p className="meta-text">Gespräch wird geladen…</p>
        ) : messages.length === 0 && !sending ? (
          <p className="meta-text">
            Noch kein Gespräch. Sag der KI, was sie besser machen soll — zum Beispiel eine unsinnige
            Stopp-Reihenfolge oder ein Kunde, den sie falsch einschätzt.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.at}-${index}`}
              className={cn('flex', message.role === 'disponent' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-[6px] px-3.5 py-2.5',
                  message.role === 'disponent'
                    ? 'bg-primary/20 text-foreground'
                    : 'bg-white/[0.04] text-foreground',
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-[0.14em] mb-1',
                    message.role === 'disponent' ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {message.role === 'disponent' ? 'Disponent' : 'KI'}
                </p>
                <p className="text-[13.5px] leading-snug whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-[6px] px-3.5 py-2.5 bg-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                KI
              </p>
              <p className="text-[13.5px] text-muted-foreground">schreibt …</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z. B. Tour 4 gestern: Müller hätte zuerst angefahren werden müssen"
          className="rounded-[4px] h-9"
          disabled={sending || !companyId}
        />
        <Button
          type="submit"
          className="rounded-[4px] h-9 font-semibold shrink-0"
          disabled={sending || !draft.trim() || !companyId}
        >
          {sending ? '…' : 'Senden'}
        </Button>
      </form>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="meta-text">{formatChatFooter(messages)}</p>
    </div>
  );
}
