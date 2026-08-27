import { useState } from 'react';
import { Mail, Package, Plus, Play, Loader2, Truck, User, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatch } from '@/lib/dispatch-context';
import { cn } from '@/lib/utils';
import { ArticleReviewPanel } from '@/components/dispatch/ArticleReviewPanel';
import { useIntegrations } from '@/hooks/useIntegrations';
import { parseMissingFields } from '@/lib/article-research';
import { parseOptionalMm } from '@/lib/vehicle-volume';
import { shouldShowDemoSetup } from '@/lib/demo-setup-access';
import { matchesSearch } from '@/lib/dispatch-search';
import { geocodeThenPlanTour, planTourSuccessMessage } from '@/lib/start-planning';

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-primary/15 text-primary',
  processing: 'bg-warning/15 text-warning',
  ready: 'bg-success/15 text-success',
  error: 'bg-danger/15 text-danger',
};

const SOURCE_LABEL: Record<string, string> = {
  email_imap: 'email_imap',
  manual: 'manual',
  csv_import: 'csv_import',
  rest_api: 'rest_api',
};

export function Kontrollzentrale() {
  const { selectedDate, refreshKey, selectedDepotId, selectedDepotLabel, refreshAll, companyId, searchQuery } = useDispatch();
  const queryClient = useQueryClient();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { integrations } = useIntegrations(companyId);
  const imap = integrations.find((item) => item.system_type === 'email_imap' && item.is_active);
  const imapHost =
    imap && typeof imap.config?.host === 'string' && imap.config.host.trim()
      ? imap.config.host.trim()
      : null;

  const { data: companyName } = useQuery({
    queryKey: ['company-name', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company')
        .select('name')
        .eq('id', companyId!)
        .maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
  });
  const showDemoSetup = shouldShowDemoSetup(companyName);

  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['shipments', dateStr, selectedDepotId, refreshKey],
    queryFn: async () => {
      let query = supabase
        .from('shipment')
        .select('*')
        .eq('service_date', dateStr)
        .order('email_received_at', { ascending: false });
      if (selectedDepotId) query = query.eq('depot_id', selectedDepotId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const visibleShipments = (shipments ?? []).filter((s) =>
    matchesSearch(searchQuery, s.name, s.customer_name, s.delivery_address, s.id),
  );

  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleCap, setVehicleCap] = useState('');
  const [vehicleLengthMm, setVehicleLengthMm] = useState('');
  const [vehicleWidthMm, setVehicleWidthMm] = useState('');
  const [vehicleHeightMm, setVehicleHeightMm] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [imapLoading, setImapLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  const addDriver = async () => {
    if (!driverName.trim()) return;
    setAdding('driver');
    try {
      const { error } = await supabase.from('driver').insert({
        name: driverName.trim(),
        phone: driverPhone.trim() || null,
        status: 'verfügbar',
        company_id: (await supabase.rpc('get_user_company_id')).data!,
      });
      if (error) throw error;
      toast.success(`Fahrer "${driverName}" hinzugefügt`);
      setDriverName('');
      setDriverPhone('');
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setAdding(null);
    }
  };

  const addVehicle = async () => {
    if (!vehicleName.trim()) return;
    setAdding('vehicle');
    try {
      const { error } = await supabase.from('vehicle').insert({
        name: vehicleName.trim(),
        capacity: vehicleCap ? parseInt(vehicleCap, 10) : null,
        length_mm: parseOptionalMm(vehicleLengthMm),
        width_mm: parseOptionalMm(vehicleWidthMm),
        height_mm: parseOptionalMm(vehicleHeightMm),
        company_id: (await supabase.rpc('get_user_company_id')).data!,
      });
      if (error) throw error;
      toast.success(`Fahrzeug "${vehicleName}" hinzugefügt`);
      setVehicleName('');
      setVehicleCap('');
      setVehicleLengthMm('');
      setVehicleWidthMm('');
      setVehicleHeightMm('');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setAdding(null);
    }
  };

  const fetchImap = async () => {
    setImapLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-imap');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `${data?.created ?? 0} Sendung(en) aus dem Postfach übernommen` +
          (data?.cron ? ' · Cron' : ''),
      );
      refreshAll();
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'IMAP-Abruf fehlgeschlagen');
    } finally {
      setImapLoading(false);
    }
  };

  const loadDemo = async () => {
    setDemoLoading(true);
    try {
      const { error } = await supabase.functions.invoke('demo-setup');
      if (error) throw error;
      toast.success('Demo-Szenario geladen');
      refreshAll();
      queryClient.invalidateQueries();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setDemoLoading(false);
    }
  };

  const startPlanning = async () => {
    setPlanLoading(true);
    try {
      const result = await geocodeThenPlanTour({
        date: dateStr,
        depotId: selectedDepotId,
      });
      toast.success(planTourSuccessMessage(result));
      if (result.geocodeWarning) {
        toast.warning(`Geokodierung unvollständig: ${result.geocodeWarning}`);
      }
      refreshAll();
      queryClient.invalidateQueries();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="section-title">Lieferscheine</p>
        <h2 className="page-title mt-1">Eingang & Disposition</h2>
        <p className="meta-text mt-1">
          {selectedDate.toLocaleDateString('de-DE')}
          {selectedDepotId ? ` · ${selectedDepotLabel}` : ' · alle Depots'}
        </p>
      </div>

      {/* 1. E-Mail-Zugang */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <p className="card-title">E-Mail-Zugang</p>
          </div>
          <span className={cn(
            'shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm',
            imapHost ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}>
            {imapHost ? 'verbunden' : 'Ausstehend'}
          </span>
        </div>
        <p className="meta-text">
          {imapHost
            ? `Ungelesene Mails werden manuell oder alle 15 Minuten von ${imapHost} geholt. Adressen werden nur gesetzt, wenn sie im Text stehen.`
            : 'Noch kein IMAP-Konto. Unter Einstellungen Host, Ordner und Zugangsdaten hinterlegen, danach hier Mails abrufen.'}
        </p>
        {imapHost && (
          <Button
            variant="outline"
            className="rounded"
            onClick={() => void fetchImap()}
            disabled={imapLoading}
          >
            {imapLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
            Mails abrufen
          </Button>
        )}
      </div>

      {/* 2. Lieferschein-Tabelle */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <p className="card-title">Lieferscheine</p>
          </div>
          <span className="meta-text text-dim">
            {visibleShipments.length}
            {searchQuery.trim() && shipments?.length ? ` / ${shipments.length}` : ''} Einträge
          </span>
        </div>

        {shipmentsLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !visibleShipments.length ? (
          <p className="text-center py-14 meta-text">
            {shipments?.length
              ? 'Keine Lieferscheine passen zur Suche.'
              : 'Keine Lieferscheine für dieses Datum vorhanden.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {['Sendung', 'Kunde', 'Adresse', 'Gewicht', 'Quelle', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-dim"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleShipments.map((s) => {
                  const status = s.intake_status ?? 'new';
                  const source = s.intake_source || 'manual';
                  const pendingArticles =
                    parseMissingFields(s.missing_fields).unknown_articles?.filter(
                      (a) => a.status === 'pending',
                    ).length ?? 0;
                  return (
                    <tr key={s.id} className="border-b border-white/[0.04]">
                      <td className="px-5 py-3 font-mono text-xs text-primary whitespace-nowrap">
                        {s.name || s.id.slice(0, 8)}
                        {pendingArticles > 0 && (
                          <span className="ml-2 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-warning/15 text-warning align-middle">
                            {pendingArticles} Artikel
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">
                        {s.customer_name || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground max-w-[220px] truncate">
                        {s.delivery_address || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm whitespace-nowrap">
                        {s.weight_kg != null ? `${s.weight_kg} kg` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <code className="font-mono text-[11.5px] text-muted-foreground">
                          {SOURCE_LABEL[source] ?? source}
                        </code>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'inline-block text-[10.5px] font-semibold px-1.5 py-0.5 rounded-sm',
                            STATUS_BADGE[status] ?? STATUS_BADGE.new,
                          )}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shipments && shipments.length > 0 && (
        <ArticleReviewPanel shipments={shipments} dateStr={dateStr} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          className="rounded font-semibold"
          onClick={() => void startPlanning()}
          disabled={planLoading}
        >
          {planLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Play className="w-4 h-4 mr-1.5" />
          )}
          Planung starten · plan-tour
        </Button>
      </div>

      {showDemoSetup && (
      <div className="rounded-sm border border-dashed border-hairline bg-panel/60 p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-dim" />
            <p className="card-title">Demo & Testdaten</p>
          </div>
          <p className="meta-text mt-1">
            Nur interne Demo-Mandanten. Fahrer und Fahrzeuge für Kunden unter „Fahrer & Fahrzeuge“.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wide text-dim font-semibold flex items-center gap-1">
              <User className="w-3 h-3" /> Fahrer
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="h-8 text-sm rounded bg-white/[0.03] border-hairline"
              />
              <Input
                placeholder="Telefon"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="h-8 text-sm rounded w-32 bg-white/[0.03] border-hairline"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void addDriver()}
                disabled={adding === 'driver' || !driverName.trim()}
                className="h-8 rounded shrink-0"
              >
                {adding === 'driver' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wide text-dim font-semibold flex items-center gap-1">
              <Truck className="w-3 h-3" /> Fahrzeug
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Name"
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                className="h-8 text-sm rounded bg-white/[0.03] border-hairline"
              />
              <Input
                placeholder="Kapazität kg"
                type="number"
                value={vehicleCap}
                onChange={(e) => setVehicleCap(e.target.value)}
                className="h-8 text-sm rounded w-28 bg-white/[0.03] border-hairline"
              />
              <Input
                placeholder="L mm"
                type="number"
                value={vehicleLengthMm}
                onChange={(e) => setVehicleLengthMm(e.target.value)}
                className="h-8 text-sm rounded w-20 bg-white/[0.03] border-hairline"
              />
              <Input
                placeholder="B mm"
                type="number"
                value={vehicleWidthMm}
                onChange={(e) => setVehicleWidthMm(e.target.value)}
                className="h-8 text-sm rounded w-20 bg-white/[0.03] border-hairline"
              />
              <Input
                placeholder="H mm"
                type="number"
                value={vehicleHeightMm}
                onChange={(e) => setVehicleHeightMm(e.target.value)}
                className="h-8 text-sm rounded w-20 bg-white/[0.03] border-hairline"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void addVehicle()}
                disabled={adding === 'vehicle' || !vehicleName.trim()}
                className="h-8 rounded shrink-0"
              >
                {adding === 'vehicle' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-hairline pt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded"
            onClick={() => void loadDemo()}
            disabled={demoLoading}
          >
            {demoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Box className="w-4 h-4 mr-1.5" />
            )}
            Demo-Szenario laden · demo-setup
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
