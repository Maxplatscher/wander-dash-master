import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SystemIntegration, SystemType } from '@/types/integrations';

export function useIntegrations(companyId: string | null) {
  const [integrations, setIntegrations] = useState<SystemIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!companyId) {
      setIntegrations([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('system_integrations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setIntegrations((data as SystemIntegration[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function save(params: {
    id: string;
    depot_id: string | null;
    system_type: SystemType;
    name: string;
    config: Record<string, string>;
    credentials: Record<string, string>;
    is_active: boolean;
  }) {
    if (!companyId) throw new Error('Keine company_id verfügbar');

    // Credentials nur an Edge Function — nie an RPC / Klartext-Spalten
    const { data, error: invokeError } = await supabase.functions.invoke('upsert-integration', {
      body: {
        id: params.id,
        depot_id: params.depot_id,
        system_type: params.system_type,
        name: params.name,
        config: params.config,
        credentials: params.credentials,
        is_active: params.is_active,
      },
    });

    if (invokeError) throw new Error(invokeError.message);
    if (data?.error) throw new Error(data.error);

    await load();
  }

  async function remove(id: string) {
    const { error: deleteError } = await supabase.rpc('delete_integration_with_secret', {
      p_id: id,
    });

    if (deleteError) throw new Error(deleteError.message);
    await load();
  }

  return { integrations, loading, error, save, remove, reload: load };
}
