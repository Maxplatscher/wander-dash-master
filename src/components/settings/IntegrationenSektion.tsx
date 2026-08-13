import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, PlugZap, TestTube2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrations } from '@/hooks/useIntegrations';
import {
  CONFIG_FIELDS,
  CREDENTIAL_FIELDS,
  SystemIntegration,
  SystemType,
  TYPE_ICONS,
  TYPE_LABELS,
} from '@/types/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type DepotOption = {
  id: string;
  name: string;
};

type TestResult = {
  success: boolean;
  message: string;
  latency_ms?: number;
};

type FormState = {
  id: string;
  name: string;
  system_type: SystemType;
  depot_id: string | null;
  config: Record<string, string>;
  credentials: Record<string, string>;
  is_active: boolean;
};

const DEFAULT_TYPE: SystemType = 'rest_api';

const generateId = (): string => {
  // Bevorzugt: nativer kryptographischer UUID-Generator (alle modernen Browser, ab Safari 15.4 / Chrome 92).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: getRandomValues + RFC4122-v4-Layout (kryptographisch sicher, deutlich besser als Math.random).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

function buildInitialForm(integration?: SystemIntegration): FormState {
  return {
    id: integration?.id ?? generateId(),
    name: integration?.name ?? '',
    system_type: integration?.system_type ?? DEFAULT_TYPE,
    depot_id: integration?.depot_id ?? null,
    config: integration?.config ?? {},
    credentials: {},
    is_active: integration?.is_active ?? true,
  };
}

export function IntegrationenSektion({ companyId }: { companyId: string | null }) {
  const { integrations, loading, error, save, remove } = useIntegrations(companyId);
  const [depots, setDepots] = useState<DepotOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SystemIntegration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SystemIntegration | null>(null);
  const [form, setForm] = useState<FormState>(buildInitialForm());

  useEffect(() => {
    const loadDepots = async () => {
      if (!companyId) {
        setDepots([]);
        return;
      }

      const { data, error: depotsError } = await supabase
        .from('depot')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');

      if (depotsError) {
        toast.error(`Depot-Liste konnte nicht geladen werden: ${depotsError.message}`);
        return;
      }

      setDepots(data ?? []);
    };

    loadDepots();
  }, [companyId]);

  const configFields = useMemo(() => CONFIG_FIELDS[form.system_type], [form.system_type]);
  const credentialFields = useMemo(() => CREDENTIAL_FIELDS[form.system_type], [form.system_type]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(buildInitialForm());
    setDialogOpen(true);
  };

  const openEditDialog = (integration: SystemIntegration) => {
    setEditing(integration);
    setForm(buildInitialForm(integration));
    setDialogOpen(true);
  };

  const updateConfigValue = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const updateCredentialValue = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name darf nicht leer sein');
      return;
    }

    const hasConfigValue = configFields.some((key) => (form.config[key] ?? '').trim() !== '');
    if (!hasConfigValue) {
      toast.error('Bitte mindestens ein Konfigurationsfeld ausfüllen');
      return;
    }

    const filteredConfig = Object.fromEntries(
      Object.entries(form.config).filter(([, value]) => value.trim() !== '')
    );
    const filteredCredentials = Object.fromEntries(
      Object.entries(form.credentials).filter(([, value]) => value.trim() !== '')
    );

    setSaving(true);
    try {
      await save({
        id: form.id,
        depot_id: form.depot_id,
        system_type: form.system_type,
        name: form.name.trim(),
        config: filteredConfig,
        credentials: filteredCredentials,
        is_active: form.is_active,
      });
      toast.success(editing ? 'Integration aktualisiert' : 'Integration angelegt');
      setDialogOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Speichern fehlgeschlagen';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (integration: SystemIntegration) => {
    setConfirmDelete(integration);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeletingId(target.id);
    try {
      await remove(target.id);
      toast.success('Integration gelöscht');
      setConfirmDelete(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Löschen fehlgeschlagen';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (integration: SystemIntegration) => {
    setTestingId(integration.id);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<TestResult>('test-integration', {
        body: { integration_id: integration.id },
      });

      if (invokeError) throw new Error(invokeError.message);
      if (!data) throw new Error('Leere Antwort vom Verbindungstest');

      const result = data;
      if (result.success) {
        const latency = result.latency_ms ? ` (${result.latency_ms} ms)` : '';
        toast.success(`${result.message}${latency}`);
      } else {
        toast.error(result.message);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Verbindungstest fehlgeschlagen';
      toast.error(message);
    } finally {
      setTestingId(null);
    }
  };

  if (error) {
    return <div className="p-4 text-sm text-danger">Fehler beim Laden: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="meta-text">
          Verbinde externe Systeme pro Standort oder global für alle Standorte.
        </p>
        <Button size="sm" className="rounded font-semibold" onClick={openCreateDialog} disabled={!companyId}>
          <Plus className="w-4 h-4 mr-1.5" />
          Integration hinzufügen
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 meta-text py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Integrationen werden geladen…
        </div>
      ) : integrations.length === 0 ? (
        <div className="rounded-sm border border-dashed border-hairline px-4 py-8 text-center meta-text">
          Noch keine Integrationen vorhanden.
        </div>
      ) : (
        <div className="grid gap-3">
          {integrations.map((integration) => {
            const isTesting = testingId === integration.id;
            const isDeleting = deletingId === integration.id;
            const depotLabel = integration.depot_id
              ? depots.find((d) => d.id === integration.depot_id)?.name ?? 'Standort'
              : 'Alle Standorte (global)';
            const configEntries = Object.entries(integration.config ?? {});
            const credKeys = CREDENTIAL_FIELDS[integration.system_type] ?? [];

            return (
              <div key={integration.id} className="sub-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground truncate">
                      {integration.name}
                    </p>
                    <code className="font-mono text-[11.5px] text-muted-foreground">
                      {integration.system_type}
                    </code>
                    <p className="meta-text mt-0.5">{depotLabel}</p>
                  </div>
                  <span
                    className={
                      integration.is_active
                        ? 'shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm bg-success/15 text-success'
                        : 'shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm bg-white/10 text-muted-foreground'
                    }
                  >
                    {integration.is_active ? 'aktiv' : 'inaktiv'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {configEntries.map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <code className="font-mono text-dim">{key}</code>
                      <span className="text-foreground truncate text-right">{value || '—'}</span>
                    </div>
                  ))}
                  {credKeys.map((key) => (
                    <div key={key} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <code className="font-mono text-dim">{key}</code>
                      <span className="font-mono text-primary truncate text-right">
                        {integration.vault_secret_id ? `${key.slice(0, 2)}••••••••` : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-hairline">
                  <p className="meta-text">
                    Letzter Test — manuell auslösen
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded h-8" onClick={() => openEditDialog(integration)}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Bearbeiten
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded h-8"
                      disabled={isTesting}
                      onClick={() => void handleTest(integration)}
                    >
                      {isTesting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <TestTube2 className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Verbindung testen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded h-8 text-danger border-danger/30 hover:bg-danger/10"
                      disabled={isDeleting}
                      onClick={() => requestDelete(integration)}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Löschen
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-hairline bg-panel sm:rounded">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <PlugZap className="w-4 h-4 text-primary" />
              {editing ? 'Integration bearbeiten' : 'Neue Integration'}
            </DialogTitle>
            <DialogDescription>
              Sensible Zugangsdaten werden serverseitig im Vault abgelegt.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. SAP ERP Hauptsystem"
              />
            </div>

            <div className="space-y-2">
              <Label>Systemtyp</Label>
              <Select
                value={form.system_type}
                onValueChange={(value) => setForm(prev => ({ ...prev, system_type: value as SystemType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as SystemType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Depot</Label>
              <Select
                value={form.depot_id ?? '__global__'}
                onValueChange={(value) => setForm(prev => ({ ...prev, depot_id: value === '__global__' ? null : value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">Alle Standorte (global)</SelectItem>
                  {depots.map((depot) => (
                    <SelectItem key={depot.id} value={depot.id}>
                      {depot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {configFields.map((field) => (
              <div className="space-y-2" key={`cfg-${field}`}>
                <Label>{field}</Label>
                <Input
                  value={form.config[field] ?? ''}
                  onChange={(e) => updateConfigValue(field, e.target.value)}
                  placeholder={field}
                />
              </div>
            ))}

            {credentialFields.map((field) => (
              <div className="space-y-2" key={`cred-${field}`}>
                <Label>{field}</Label>
                <Input
                  type="password"
                  value={form.credentials[field] ?? ''}
                  onChange={(e) => updateCredentialValue(field, e.target.value)}
                  placeholder="••••••• (bleibt gespeichert wenn leer gelassen)"
                />
              </div>
            ))}

            <div className="md:col-span-2 flex items-center justify-between sub-card px-3 py-2">
              <div>
                <p className="text-sm font-medium">Aktiv</p>
                <p className="meta-text">Nur aktive Integrationen werden im Betrieb verwendet</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button className="rounded font-semibold" onClick={() => void handleSave()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Integration unwiderruflich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete ? (
                <>
                  „<strong>{confirmDelete.name}</strong>" und das zugehörige Vault-Secret werden
                  endgültig entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteAction();
              }}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId !== null && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
