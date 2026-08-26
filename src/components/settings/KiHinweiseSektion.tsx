import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiHints } from '@/hooks/useAiHints';
import { cn } from '@/lib/utils';
import { formatHintFooter, rephraseDispatchHint } from '@/lib/ai-hint-rephrase';

export function KiHinweiseSektion({ companyId }: { companyId: string | null }) {
  const { messages, setMessages, loading, error, setError, insert } = useAiHints(companyId, 'hint');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const now = new Date().toISOString();
    const kiText = rephraseDispatchHint(text);
    const kiAt = new Date(Date.parse(now) + 400).toISOString();
    setMessages((current) => [
      ...current,
      { role: 'disponent', text, at: now },
      { role: 'ki', text: kiText, at: kiAt },
    ]);
    setDraft('');
    try {
      await insert('disponent', text, now);
      await insert('ki', kiText, kiAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hinweis konnte nicht gespeichert werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <p className="card-title">Hinweise an die KI</p>
        <p className="meta-text mt-1">
          Beliebige Regeln: Zeitfenster, Reihenfolge, Kapazität, Meidungen oder freie Hinweise. Jeder
          Satz wird vollständig gespeichert und gilt beim nächsten Planungslauf.
        </p>
      </div>

      <div className="space-y-4 min-h-[120px]">
        {loading && messages.length === 0 ? (
          <p className="meta-text">Hinweise werden geladen…</p>
        ) : messages.length === 0 ? (
          <p className="meta-text">Noch keine Hinweise. Schreib, was die Planung wissen soll — nicht nur Zeiten.</p>
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
                    ? 'bg-white/[0.09] text-foreground'
                    : 'bg-white/[0.04] text-foreground',
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  {message.role === 'disponent' ? 'Disponent' : 'KI'}
                </p>
                <p className="text-[13.5px] leading-snug">{message.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z. B. Zeitfenster, Reihenfolge, Plane Pflicht, Depot Süd nicht nach 16:00"
          className="rounded-[4px] h-9"
          disabled={sending || !companyId}
        />
        <Button
          type="submit"
          className="rounded-[4px] h-9 font-semibold shrink-0"
          disabled={sending || !draft.trim() || !companyId}
        >
          Senden
        </Button>
      </form>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="meta-text">{formatHintFooter(messages)}</p>
    </div>
  );
}
