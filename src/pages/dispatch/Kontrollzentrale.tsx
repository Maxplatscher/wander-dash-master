import { useState } from 'react';
import { Mail, Package, Plus, Play, Loader2, Truck, User, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatch } from '@/lib/dispatch-context';
import { cn } from '@/lib/utils';

const statusBadge: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  processing: 'bg-amber-50 text-amber-700',
  ready: 'bg-emerald-50 text-emerald-700',
  error: 'bg-red-50 text-red-700',
};

export function Kontrollzentrale() {
  const { selectedDate, refreshKey } = useDispatch();
  const queryClient = useQueryClient();
  const dateStr = selectedDate.toISOString().split('T')[0];

  // Shipments query
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['shipments', dateStr, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipment')
        .select('*')
        .eq('service_date', dateStr)
        .order('email_received_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Demo-Builder state
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleCap, setVehicleCap] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
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
    } catch (e: any) {
      toast.error(e.message);
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
        capacity: vehicleCap ? parseInt(vehicleCap) : null,
        company_id: (await supabase.rpc('get_user_company_id')).data!,
      });
      if (error) throw error;
      toast.success(`Fahrzeug "${vehicleName}" hinzugefügt`);
      setVehicleName('');
      setVehicleCap('');
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e: any) {
      toast.error(e.message);
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
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDemoLoading(false);
    }
  };

  const startPlanning = async () => {
    setPlanLoading(true);
    try {
      const { error } = await supabase.functions.invoke('plan-tour');
      if (error) throw error;
      toast.success('Planung gestartet');
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email-Zugang */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Email-Zugang für Lieferscheine</CardTitle>
          </div>
          <CardDescription>
            Lieferscheine per Email empfangen — das System verarbeitet eingehende Emails automatisch und erstellt daraus Sendungen & Touren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground font-mono">lieferscheine@dispatch.example.com</p>
              <p className="text-xs text-muted-foreground mt-0.5">Platzhalter — Email-Integration wird konfiguriert</p>
            </div>
            <Badge variant="outline" className="shrink-0">Ausstehend</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Lieferscheine-Tabelle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Lieferscheine</CardTitle>
            </div>
            <Badge variant="secondary">{shipments?.length ?? 0} Einträge</Badge>
          </div>
          <CardDescription>Alle empfangenen Sendungen für {selectedDate.toLocaleDateString('de-DE')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {shipmentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !shipments?.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Keine Lieferscheine für dieses Datum vorhanden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Sendung</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead className="text-center">Gewicht</TableHead>
                  <TableHead className="text-center">Quelle</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name || '—'}</TableCell>
                    <TableCell>{s.customer_name || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{s.delivery_address || '—'}</TableCell>
                    <TableCell className="text-center">{s.weight_kg ? `${s.weight_kg} kg` : '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">{s.intake_source || 'manual'}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full', statusBadge[s.intake_status ?? 'new'] ?? statusBadge.new)}>
                        {s.intake_status || 'new'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Demo-Builder */}
      <Card className="border-dashed border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Demo & Testdaten</CardTitle>
          </div>
          <CardDescription>Erstelle manuell Testdaten oder lade ein komplettes Demo-Szenario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Driver */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Fahrer</label>
              <div className="flex gap-2">
                <Input placeholder="Name" value={driverName} onChange={e => setDriverName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Telefon" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="h-8 text-sm w-32" />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={addDriver} disabled={adding === 'driver' || !driverName.trim()} className="h-8">
              {adding === 'driver' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              <span className="ml-1">Hinzufügen</span>
            </Button>
          </div>

          {/* Add Vehicle */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Fahrzeug</label>
              <div className="flex gap-2">
                <Input placeholder="Name (z.B. LKW-03)" value={vehicleName} onChange={e => setVehicleName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Kapazität" type="number" value={vehicleCap} onChange={e => setVehicleCap(e.target.value)} className="h-8 text-sm w-24" />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={addVehicle} disabled={adding === 'vehicle' || !vehicleName.trim()} className="h-8">
              {adding === 'vehicle' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              <span className="ml-1">Hinzufügen</span>
            </Button>
          </div>

          <hr className="border-border" />

          {/* Scenario Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadDemo} disabled={demoLoading} variant="secondary">
              {demoLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Box className="w-4 h-4 mr-1.5" />}
              Komplettes Demo-Szenario laden
            </Button>
            <Button onClick={startPlanning} disabled={planLoading}>
              {planLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
              Planung starten
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
