import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Truck, User } from 'lucide-react';
import { DriverCardModal, VehicleOption, driverInitials } from '@/components/setup/DriverCardModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import {
  FleetDriverDraft,
  FleetStepData,
  newDraftKey,
} from '@/lib/onboarding';
import { seedDefaultPackmittel } from '@/lib/packmittel-defaults';
import {
  fileFromDataUrl,
  uploadDriverPhoto,
} from '@/lib/driver-photo';
import { toast } from 'sonner';

const EXISTING_VEHICLE_PREFIX = 'existing:';

type StepFleetProps = {
  companyId: string | null;
  value: FleetStepData;
  onChange: (next: FleetStepData) => void;
  onBack: () => void;
  onContinue: (saved: FleetStepData) => void;
};

export function StepFleet({ companyId, value, onChange, onBack, onContinue }: StepFleetProps) {
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<FleetDriverDraft | null>(null);
  const [existingVehicles, setExistingVehicles] = useState<{ id: string; name: string }[]>([]);

  const patchDrivers = (drivers: FleetStepData['drivers']) => onChange({ ...value, drivers });
  const patchVehicles = (vehicles: FleetStepData['vehicles']) => onChange({ ...value, vehicles });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let cid = companyId;
      if (!cid) {
        const { data } = await supabase.rpc('get_user_company_id');
        cid = (data as string | null) ?? null;
      }
      if (!cid) return;
      const { data, error } = await supabase
        .from('vehicle')
        .select('id, name')
        .eq('company_id', cid)
        .order('name');
      if (cancelled || error || !data) return;
      setExistingVehicles(
        data
          .filter((v): v is { id: string; name: string } => Boolean(v.id && v.name))
          .map((v) => ({ id: v.id, name: v.name })),
      );
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const vehicleOptions: VehicleOption[] = useMemo(() => {
    const draftOpts = value.vehicles
      .filter((v) => v.name.trim().length > 0)
      .map((v) => ({ key: v.key, label: v.name.trim() }));
    const existingOpts = existingVehicles.map((v) => ({
      key: `${EXISTING_VEHICLE_PREFIX}${v.id}`,
      label: v.name,
    }));
    return [...draftOpts, ...existingOpts];
  }, [value.vehicles, existingVehicles]);

  const addVehicle = () => {
    patchVehicles([...value.vehicles, { key: newDraftKey('v'), name: '', capacity: '' }]);
  };

  const removeDriver = (key: string) => {
    patchDrivers(value.drivers.filter((d) => d.key !== key));
  };

  const removeVehicle = (key: string) => {
    const nextVehicles =
      value.vehicles.length <= 1
        ? [{ key: newDraftKey('v'), name: '', capacity: '' }]
        : value.vehicles.filter((v) => v.key !== key);
    const nextDrivers = value.drivers.map((d) =>
      d.assignedVehicleKey === key ? { ...d, assignedVehicleKey: null } : d,
    );
    onChange({ drivers: nextDrivers, vehicles: nextVehicles });
  };

  const openAddDriver = () => {
    setEditingDriver(null);
    setModalOpen(true);
  };

  const openEditDriver = (driver: FleetDriverDraft) => {
    setEditingDriver(driver);
    setModalOpen(true);
  };

  const saveDriverDraft = (draft: FleetDriverDraft) => {
    const exists = value.drivers.some((d) => d.key === draft.key);
    if (exists) {
      patchDrivers(value.drivers.map((d) => (d.key === draft.key ? draft : d)));
    } else {
      patchDrivers([...value.drivers, draft]);
    }
  };

  const filledDrivers = value.drivers.filter((d) => d.name.trim().length > 0);
  const filledVehicles = value.vehicles.filter((v) => v.name.trim().length > 0);

  const resolveCompanyId = async (): Promise<string> => {
    if (companyId) return companyId;
    const { data, error } = await supabase.rpc('get_user_company_id');
    if (error || !data) {
      throw new Error(error?.message ?? 'Keine company_id verfügbar — bitte Schritt 1 erneut speichern.');
    }
    return data as string;
  };

  const resolveAssignedVehicleId = (
    assignedVehicleKey: string | null,
    vehicleIdByDraftKey: Map<string, string>,
  ): string | null => {
    if (!assignedVehicleKey) return null;
    if (assignedVehicleKey.startsWith(EXISTING_VEHICLE_PREFIX)) {
      return assignedVehicleKey.slice(EXISTING_VEHICLE_PREFIX.length) || null;
    }
    return vehicleIdByDraftKey.get(assignedVehicleKey) ?? null;
  };

  const saveAndContinue = async () => {
    setSaving(true);
    try {
      const cid = await resolveCompanyId();
      const vehicleIdByDraftKey = new Map<string, string>();

      for (const v of filledVehicles) {
        const capacity = Number.parseInt(v.capacity.replace(/\D/g, ''), 10);
        const { data, error } = await supabase
          .from('vehicle')
          .insert({
            company_id: cid,
            name: v.name.trim(),
            capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Fahrzeuge: ${error.message}`);
        if (data?.id) vehicleIdByDraftKey.set(v.key, data.id);
      }

      for (const d of filledDrivers) {
        const assignedVehicleId = resolveAssignedVehicleId(
          d.assignedVehicleKey,
          vehicleIdByDraftKey,
        );
        const { data: created, error } = await supabase.from('driver').insert({
          company_id: cid,
          name: d.name.trim(),
          phone: d.phone.trim() || null,
          personnel_number: d.personnelNumber.trim() || null,
          birth_date: d.birthDate.trim() || null,
          photo_url: null,
          assigned_vehicle_id: assignedVehicleId,
          notes: d.notes.trim() || null,
          status: 'active',
          shift_start: '06:00',
          shift_end: '16:00',
        }).select('id').single();
        if (error) throw new Error(`Fahrer: ${error.message}`);

        const localPhoto =
          d.photoUrl?.startsWith('data:') ? fileFromDataUrl(d.photoUrl) : null;
        if (localPhoto && created?.id) {
          try {
            const path = await uploadDriverPhoto({
              companyId: cid,
              driverId: created.id,
              file: localPhoto,
            });
            const { error: photoError } = await supabase
              .from('driver')
              .update({ photo_url: path })
              .eq('id', created.id);
            if (photoError) throw photoError;
          } catch (photoError: unknown) {
            console.warn('Fahrerfoto:', photoError);
          }
        }
      }

      const packSeed = await seedDefaultPackmittel(supabase, cid);
      if (packSeed.error) {
        console.warn('Packmittel-Vorlagen:', packSeed.error);
      }

      if (filledDrivers.length || filledVehicles.length) {
        toast.success(
          `${filledDrivers.length} Fahrer, ${filledVehicles.length} Fahrzeug(e) gespeichert`,
        );
      } else if (packSeed.seeded) {
        toast.success('Standard-Packmittel angelegt');
      }

      onContinue(value);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      onContinue(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Fahrer & Fahrzeuge</h2>
        <p className="text-sm text-muted-foreground">
          Optional — kann übersprungen und später unter „Fahrer & Fahrzeuge“ ergänzt werden.
        </p>
      </div>

      {/* Drivers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-foreground">
            <User className="w-3.5 h-3.5 text-primary" />
            Fahrer
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-white/15 bg-white/5"
            onClick={openAddDriver}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Fahrer hinzufügen
          </Button>
        </div>

        {value.drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Noch keine Fahrer erfasst.</p>
        ) : (
          <div className="space-y-2">
            {value.drivers.map((d) => (
              <div
                key={d.key}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
              >
                <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center text-xs font-semibold text-foreground">
                  {d.photoUrl ? (
                    <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    driverInitials(d.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.personnelNumber.trim() || 'Keine Personalnummer'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => openEditDriver(d)}
                  title="Bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeDriver(d.key)}
                  title="Entfernen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vehicles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-foreground">
            <Truck className="w-3.5 h-3.5 text-primary" />
            Fahrzeuge
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-white/15 bg-white/5"
            onClick={addVehicle}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Fahrzeug hinzufügen
          </Button>
        </div>

        <div className="space-y-2">
          {value.vehicles.map((v, idx) => (
            <div key={v.key} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={v.name}
                  placeholder={`Name Fahrzeug ${idx + 1}`}
                  className="bg-white/5 border-white/10 rounded-xl"
                  onChange={(e) => {
                    patchVehicles(
                      value.vehicles.map((row) =>
                        row.key === v.key ? { ...row, name: e.target.value } : row,
                      ),
                    );
                  }}
                />
                <Input
                  value={v.capacity}
                  placeholder="Kapazität kg (optional)"
                  inputMode="numeric"
                  className="bg-white/5 border-white/10 rounded-xl"
                  onChange={(e) => {
                    patchVehicles(
                      value.vehicles.map((row) =>
                        row.key === v.key ? { ...row, capacity: e.target.value } : row,
                      ),
                    );
                  }}
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeVehicle(v.key)}
                title="Entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-white/15 bg-white/5 sm:flex-1"
          disabled={saving}
          onClick={onBack}
        >
          Zurück
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl text-muted-foreground sm:flex-1"
          disabled={saving}
          onClick={() => void skip()}
        >
          Überspringen
        </Button>
        <Button
          type="button"
          className="rounded-xl sm:flex-1"
          disabled={saving || (filledDrivers.length === 0 && filledVehicles.length === 0)}
          onClick={() => void saveAndContinue()}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Speichern…
            </span>
          ) : (
            'Speichern & Weiter'
          )}
        </Button>
      </div>

      <DriverCardModal
        open={modalOpen}
        initial={editingDriver}
        vehicles={vehicleOptions}
        onOpenChange={setModalOpen}
        onSave={saveDriverDraft}
      />
    </div>
  );
}
