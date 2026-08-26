import { useEffect, useState } from 'react';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { DesignSektion } from '@/components/settings/DesignSektion';
import { IntegrationenSektion } from '@/components/settings/IntegrationenSektion';
import { KiChatSektion } from '@/components/settings/KiChatSektion';
import { KiHinweiseSektion } from '@/components/settings/KiHinweiseSektion';
import { LieferscheinOrdnerSektion } from '@/components/settings/LieferscheinOrdnerSektion';

export function Einstellungen() {
  const { companyId } = useDispatch();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!companyId) {
        const { data } = await supabase.rpc('get_user_company_id');
        if (!cancelled) setResolvedCompanyId((data as string | null) ?? null);
      } else {
        setResolvedCompanyId(companyId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <p className="section-title">Einstellungen</p>
        <h2 className="page-title mt-1">Darstellung und Anbindungen</h2>
      </div>

      <DesignSektion />

      <LieferscheinOrdnerSektion companyId={resolvedCompanyId} />

      <KiHinweiseSektion companyId={resolvedCompanyId} />

      <div className="glass-card p-5 space-y-4">
        <div>
          <p className="card-title">System-Integrationen</p>
          <p className="meta-text mt-1">
            ERP, Telematik, REST und Recherchequellen. Lieferschein-Ordner liegen im Block darüber.
          </p>
        </div>
        <IntegrationenSektion companyId={resolvedCompanyId} />
      </div>

      <KiChatSektion companyId={resolvedCompanyId} />
    </div>
  );
}
