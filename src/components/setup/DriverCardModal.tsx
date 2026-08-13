import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  FleetDriverDraft,
  emptyFleetDriver,
} from '@/lib/onboarding';
import { cn } from '@/lib/utils';

export type VehicleOption = {
  key: string;
  label: string;
};

const NONE_VEHICLE = '__none__';

type DriverCardModalProps = {
  open: boolean;
  /** null = neuer Fahrer */
  initial: FleetDriverDraft | null;
  vehicles: VehicleOption[];
  onOpenChange: (open: boolean) => void;
  onSave: (draft: FleetDriverDraft) => void;
};

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function joinName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

export function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function DriverCardModal({
  open,
  initial,
  vehicles,
  onOpenChange,
  onSave,
}: DriverCardModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(() => emptyFleetDriver().key);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [personnelNumber, setPersonnelNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [assignedVehicleKey, setAssignedVehicleKey] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = initial ?? emptyFleetDriver();
    const { firstName: fn, lastName: ln } = splitName(base.name);
    setKey(base.key);
    setFirstName(fn);
    setLastName(ln);
    setPhone(base.phone);
    setPersonnelNumber(base.personnelNumber);
    setBirthDate(base.birthDate);
    setPhotoUrl(base.photoUrl);
    setAssignedVehicleKey(base.assignedVehicleKey);
    setNotes(base.notes);
  }, [open, initial]);

  const fullName = joinName(firstName, lastName);
  const canSave = fullName.length > 0;

  const onPickPhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      key,
      name: fullName,
      phone: phone.trim(),
      personnelNumber: personnelNumber.trim(),
      birthDate: birthDate.trim(),
      photoUrl,
      assignedVehicleKey,
      notes: notes.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border-white/10 bg-background/95 backdrop-blur-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {initial ? 'Fahrer bearbeiten' : 'Fahrer hinzufügen'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar / Foto */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              className={cn(
                'relative h-20 w-20 rounded-full overflow-hidden border border-white/15',
                'bg-white/5 flex items-center justify-center text-lg font-semibold text-foreground',
                'hover:border-primary/40 transition-colors',
              )}
              onClick={() => fileRef.current?.click()}
              title="Bild hinzufügen"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{driverInitials(fullName || '?')}</span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/50 py-0.5">
                <Camera className="w-3.5 h-3.5 text-white" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {photoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setPhotoUrl(null)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Foto entfernen
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Bild hinzufügen (optional)</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="driver-first">Vorname</Label>
              <Input
                id="driver-first"
                value={firstName}
                placeholder="Max"
                className="bg-white/5 border-white/10 rounded-xl"
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-last">Nachname</Label>
              <Input
                id="driver-last"
                value={lastName}
                placeholder="Mustermann"
                className="bg-white/5 border-white/10 rounded-xl"
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="driver-phone">Telefon</Label>
            <Input
              id="driver-phone"
              value={phone}
              placeholder="Optional"
              className="bg-white/5 border-white/10 rounded-xl"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="driver-personnel">Personalnummer</Label>
              <Input
                id="driver-personnel"
                value={personnelNumber}
                placeholder="Optional"
                className="bg-white/5 border-white/10 rounded-xl"
                onChange={(e) => setPersonnelNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-birth">Geburtsdatum</Label>
              <Input
                id="driver-birth"
                type="date"
                value={birthDate}
                className="bg-white/5 border-white/10 rounded-xl"
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Festes Fahrzeug</Label>
            <Select
              value={assignedVehicleKey ?? NONE_VEHICLE}
              onValueChange={(v) => setAssignedVehicleKey(v === NONE_VEHICLE ? null : v)}
            >
              <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                <SelectValue placeholder="Kein Fahrzeug" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VEHICLE}>Kein Fahrzeug</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="driver-notes">Sonstige Hinweise</Label>
            <Textarea
              id="driver-notes"
              value={notes}
              placeholder="Optional"
              rows={3}
              className="bg-white/5 border-white/10 rounded-xl resize-none"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-white/15 bg-white/5"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!canSave}
            onClick={handleSave}
          >
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
