import { useState } from 'react';
import { Mail, Package, Plus, Play, Loader2, Truck, User, Box, MapPin, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatch } from '@/lib/dispatch-context';
import { formatDateLabel, toDateInputValue } from '@/lib/date-input';
import { cn } from '@/lib/utils';
import { ArticleReviewPanel } from '@/components/dispatch/ArticleReviewPanel';
import { parseMissingFields } from '@/lib/article-research';
import { useIntegrations } from '@/hooks/useIntegrations';
import { shouldShowDemoSetup } from '@/lib/demo-setup-access';

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
  const { selectedDate, refreshKey, selectedDepotId, selectedDepotLabel, refreshAll, companyId, navigateTo } = useDispatch();
  const queryClient = useQueryClient();
  const dateStr = toDateInputValue(selectedDate);
  const { integrations, loading: integrationsLoading } = useIntegrations(companyId);
  const { data: companyName } = useQuery({
    queryKey: ['company-name', companyId],
    enabled: Boolean(companyId),
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
  const imap = integrations.find((item) => item.system_type === 'email_imap');
  const imapHost =
    imap && typeof imap.config?.host === 'string' && imap.config.host.trim()
      ? imap.config.host.trim()
      : null;

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

  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleCap, setVehicleCap] = useState('');
  const [shipCustomer, setShipCustomer] = useState('');
  const [shipAddress, setShipAddress] = useState('');
  const [shipWeight, setShipWeight] = useState('');
  const [shipName, setShipName] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [fetchImapLoading, setFetchImapLoading] = useState(false);

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
      const companyId = (await supabase.rpc('get_user_company_id')).data!;
      const { data: inserted, error } = await supabase
        .from('vehicle')
        .insert({
          name: vehicleName.trim(),
          capacity: vehicleCap ? parseInt(vehicleCap, 10) : null,
          company_id: companyId,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { data: freeDrivers } = await supabase
        .from('driver')
        .select('id, name')
        .eq('company_id', companyId)
        .is('assigned_vehicle_id', null)
        .limit(2);

      if (inserted?.id && freeDrivers?.length === 1) {
        const { error: assignError } = await supabase
          .from('driver')
          .update({ assigned_vehicle_id: inserted.id })
          .eq('id', freeDrivers[0].id);
        if (assignError) throw assignError;
        toast.success(
          `Fahrzeug "${vehicleName}" hinzugefügt und ${freeDrivers[0].name ?? 'Fahrer'} zugeordnet`,
        );
      } else {
        toast.success(`Fahrzeug "${vehicleName}" hinzugefügt`);
      }
      setVehicleName('');
      setVehicleCap('');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setAdding(null);
    }
  };

  const addShipment = async () => {
    if (!shipCustomer.trim() || !shipAddress.trim()) return;
    setAdding('shipment');
    try {
      const { data: cid, error: cidError } = await supabase.rpc('get_user_company_id');
      if (cidError || !cid) throw new Error('Kein Unternehmen zugeordnet');
      const weight = shipWeight.trim() ? Number(shipWeight.replace(',', '.')) : null;
      if (shipWeight.trim() && (weight == null || !Number.isFinite(weight) || weight < 0)) {
        throw new Error('Gewicht muss eine Zahl sein');
      }
      const { error } = await supabase.from('shipment').insert({
        company_id: cid,
        customer_name: shipCustomer.trim(),
        delivery_address: shipAddress.trim(),
        name: shipName.trim() || null,
        weight_kg: weight,
        service_date: dateStr,
        depot_id: selectedDepotId,
        intake_source: 'manual',
        intake_status: 'new',
      });
      if (error) throw error;
      toast.success(`Sendung für ${shipCustomer.trim()} angelegt`);
      setShipCustomer('');
      setShipAddress('');
      setShipWeight('');
      setShipName('');
      refreshAll();
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sendung konnte nicht angelegt werden');
    } finally {
      setAdding(null);
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

  const geocodeAddresses = async () => {
    const { data, error } = await supabase.functions.invoke('geocode-shipments', {
      body: { date: dateStr },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { updated?: number; scanned?: number; provider?: string };
  };

  const fetchImapMails = async () => {
    setFetchImapLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-imap', {
        body: { date: dateStr, depot_id: selectedDepotId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const imported = Number(data?.imported ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const failed = Number(data?.failed ?? 0);
      if (imported === 0 && skipped === 0 && failed === 0) {
        toast.info('Keine ungelesenen Mails im Postfach');
      } else {
        toast.success(
          `${imported} Sendung(en) angelegt` +
            (skipped ? `, ${skipped} übersprungen` : '') +
            (failed ? `, ${failed} fehlgeschlagen` : ''),
        );
      }
      refreshAll();
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Mails konnten nicht abgerufen werden');
    } finally {
      setFetchImapLoading(false);
    }
  };

  const startPlanning = async () => {
    setPlanLoading(true);
    try {
      try {
        const geocoded = await geocodeAddresses();
        if ((geocoded.updated ?? 0) > 0) {
          toast.success(
            `${geocoded.updated} Adresse(n) geokodiert` +
              (geocoded.provider ? ` · ${geocoded.provider}` : ''),
          );
        }
      } catch (e: unknown) {
        toast.warning(
          e instanceof Error
            ? `Geokodierung übersprungen: ${e.message}`
            : 'Geokodierung übersprungen',
        );
      }

      const assignRes = await supabase.functions.invoke('assign-depot', {
        body: { date: dateStr, force: true },
      });
      if (assignRes.error) throw assignRes.error;
      if (assignRes.data?.error) throw new Error(assignRes.data.error);

      const { data, error } = await supabase.functions.invoke('plan-tour', {
        body: {
          date: dateStr,
          ...(selectedDepotId ? { depot_id: selectedDepotId } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Planung gestartet${data?.depot_source ? ` (Depot: ${data.depot_source})` : ''}`,
      );
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
          {formatDateLabel(selectedDate)}
          {selectedDepotId ? ` · ${selectedDepotLabel}` : ' · alle Depots'}
        </p>
      </div>

      {/* 1. E-Mail-Zugang — manueller IMAP-Abruf, kein Dauerabruf, keine erfundenen Adressen */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <p className="card-title">E-Mail-Zugang</p>
          </div>
          {imap?.is_active ? (
            <span className="shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm bg-success/15 text-success">
              IMAP aktiv
            </span>
          ) : (
            <span className="shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm bg-warning/15 text-warning">
              {imap ? 'IMAP deaktiviert' : 'Kein IMAP-Konto'}
            </span>
          )}
        </div>
        {integrationsLoading ? (
          <p className="meta-text">Integrationen werden geladen…</p>
        ) : imap ? (
          <>
            <p className="meta-text">
              Ungelesene Mails werden auf Knopfdruck geholt und als Sendung ohne
              erfundene Adresse angelegt. Es gibt noch keinen Dauerabruf. Einen
              Verkäuferordner legt ihr selbst an und verbindet ihn später unter
              Einstellungen.
            </p>
            <div className="sub-card px-3 py-2.5 flex items-center gap-3">
              <Mail className="w-3.5 h-3.5 text-dim shrink-0" />
              <code className="font-mono text-sm text-foreground truncate">
                {imapHost ?? imap.name}
              </code>
            </div>
          </>
        ) : (
          <p className="meta-text">
            Noch kein IMAP-Konto. Unter Einstellungen Host, Ordner und Zugangsdaten
            hinterlegen, danach hier Mails abrufen. Es gibt kein Systempostfach.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {imap?.is_active && (
            <Button
              size="sm"
              className="rounded font-semibold"
              onClick={() => void fetchImapMails()}
              disabled={fetchImapLoading}
            >
              {fetchImapLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Mails abrufen
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded"
            onClick={() => navigateTo('einstellungen')}
          >
            Einstellungen öffnen
          </Button>
        </div>
      </div>

      {/* 2. Manuelle Sendung — IMAP legt noch keine Adresse an */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <p className="card-title">Sendung manuell anlegen</p>
        </div>
        <p className="meta-text">
          Kunde und Lieferadresse reichen, damit Geokodierung und Planung greifen. IMAP
          legt Sendungen ohne Adresse an — die Adresse gehört deshalb hierher, nicht in
          den Demo-Bereich.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            placeholder="Kunde"
            value={shipCustomer}
            onChange={(e) => setShipCustomer(e.target.value)}
            className="h-8 text-sm rounded bg-white/[0.03] border-hairline"
          />
          <Input
            placeholder="Lieferschein-Nr. (optional)"
            value={shipName}
            onChange={(e) => setShipName(e.target.value)}
            className="h-8 text-sm rounded bg-white/[0.03] border-hairline"
          />
          <Input
            placeholder="Lieferadresse, z. B. Steinweg 1, 38100 Braunschweig"
            value={shipAddress}
            onChange={(e) => setShipAddress(e.target.value)}
            className="h-8 text-sm rounded bg-white/[0.03] border-hairline md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-2">
            <Input
              placeholder="Gewicht kg (optional)"
              type="number"
              value={shipWeight}
              onChange={(e) => setShipWeight(e.target.value)}
              className="h-8 text-sm rounded w-40 bg-white/[0.03] border-hairline"
            />
            <Button
              size="sm"
              className="h-8 rounded font-semibold"
              onClick={() => void addShipment()}
              disabled={adding === 'shipment' || !shipCustomer.trim() || !shipAddress.trim()}
            >
              {adding === 'shipment' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Plus className="w-3.5 h-3.5 mr-1.5" />
              )}
              Anlegen
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Lieferschein-Tabelle */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <p className="card-title">Lieferscheine</p>
          </div>
          <span className="meta-text text-dim">{shipments?.length ?? 0} Einträge</span>
        </div>

        {shipmentsLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !shipments?.length ? (
          <p className="text-center py-14 meta-text">
            Keine Lieferscheine für dieses Datum vorhanden.
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
                {shipments.map((s) => {
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

      {/* 4. Demo & Testdaten */}
      <div className="rounded-sm border border-dashed border-hairline bg-panel/60 p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-dim" />
            <p className="card-title">Demo & Testdaten</p>
          </div>
          <p className="meta-text mt-1">
            Dev-Bereich — manuell Testdaten anlegen oder Edge-Functions auslösen.
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
          {showDemoSetup && (
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
          )}
          <Button
            variant="outline"
            className="rounded"
            onClick={() => {
              void (async () => {
                setGeocodeLoading(true);
                try {
                  const geocoded = await geocodeAddresses();
                  toast.success(
                    `${geocoded.updated ?? 0} von ${geocoded.scanned ?? 0} Adressen geokodiert` +
                      (geocoded.provider ? ` · ${geocoded.provider}` : ''),
                  );
                  refreshAll();
                  queryClient.invalidateQueries();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Geokodierung fehlgeschlagen');
                } finally {
                  setGeocodeLoading(false);
                }
              })();
            }}
            disabled={geocodeLoading || planLoading}
          >
            {geocodeLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <MapPin className="w-4 h-4 mr-1.5" />
            )}
            Adressen geokodieren
          </Button>
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
      </div>
    </div>
  );
}
