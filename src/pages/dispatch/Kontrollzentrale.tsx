import { useState } from 'react';
import { Mail, Package, Plus, Play, Loader2, Truck, User, Box, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatch } from '@/lib/dispatch-context';
import { cn } from '@/lib/utils';
import { ArticleReviewPanel } from '@/components/dispatch/ArticleReviewPanel';
import { parseMissingFields } from '@/lib/article-research';

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
  const { selectedDate, refreshKey, selectedDepotId, selectedDepotLabel, refreshAll } = useDispatch();
  const queryClient = useQueryClient();
  const dateStr = selectedDate.toISOString().split('T')[0];

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
  const [adding, setAdding] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

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
        company_id: (await supabase.rpc('get_user_company_id')).data!,
      });
      if (error) throw error;
      toast.success(`Fahrzeug "${vehicleName}" hinzugefügt`);
      setVehicleName('');
      setVehicleCap('');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
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
    return data as { updated?: number; scanned?: number };
  };

  const startPlanning = async () => {
    setPlanLoading(true);
    try {
      try {
        const geocoded = await geocodeAddresses();
        if ((geocoded.updated ?? 0) > 0) {
          toast.success(`${geocoded.updated} Adresse(n) geokodiert`);
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
          <span className="shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm bg-warning/15 text-warning">
            Ausstehend
          </span>
        </div>
        <p className="meta-text">
          Lieferscheine per IMAP empfangen — eingehende Mails werden über die System-Integration
          verarbeitet und als Sendungen angelegt.
        </p>
        <div className="sub-card px-3 py-2.5 flex items-center gap-3">
          <Mail className="w-3.5 h-3.5 text-dim shrink-0" />
          <code className="font-mono text-sm text-foreground truncate">
            lieferscheine@dispatch.example.com
          </code>
        </div>
      </div>

      {/* 2. Lieferschein-Tabelle */}
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

      {/* 3. Demo & Testdaten */}
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
          <Button
            variant="outline"
            className="rounded"
            onClick={() => {
              void (async () => {
                setGeocodeLoading(true);
                try {
                  const geocoded = await geocodeAddresses();
                  toast.success(
                    `${geocoded.updated ?? 0} von ${geocoded.scanned ?? 0} Adressen geokodiert`,
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
