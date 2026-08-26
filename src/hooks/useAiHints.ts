import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseHintConstraint } from '@/lib/ai-hint-constraints';
import type { ChatMessage, ChatRole } from '@/lib/ki-chat';

export type AiHintSource = 'hint' | 'chat';

async function resolveCreatedBy(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) throw new Error('Nicht angemeldet.');
  return sessionData.user.id;
}

export function useAiHints(companyId: string | null, source: AiHintSource) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('ai_hint')
      .select('role, text, created_at')
      .eq('company_id', companyId)
      .eq('source', source)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setMessages(
      (data ?? []).map((row) => ({
        role: row.role === 'ki' ? 'ki' : 'disponent',
        text: row.text,
        at: row.created_at,
      })),
    );
    setLoading(false);
  }, [companyId, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const insert = useCallback(
    async (role: ChatRole, text: string, at = new Date().toISOString()) => {
      if (!companyId) throw new Error('Keine Company zugeordnet.');
      const createdBy = await resolveCreatedBy();
      const { error: insertError } = await supabase.from('ai_hint').insert({
        company_id: companyId,
        created_by: createdBy,
        role,
        text,
        source,
        created_at: at,
        parsed: parseHintConstraint(text),
      });
      if (insertError) throw new Error(insertError.message);
    },
    [companyId, source],
  );

  return { messages, setMessages, loading, error, setError, reload: load, insert };
}
