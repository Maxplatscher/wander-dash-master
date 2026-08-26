import { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Monitor,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DeviceOs,
  OS_LABELS,
  detectDeviceOs,
  requestDeviceLocation,
  writeConsent,
} from '@/lib/consent';
import { clearOnboardingDraft } from '@/lib/onboarding';
import { toast } from 'sonner';

type StepPermissionsProps = {
  onBack: () => void;
  onComplete: () => void;
};

export function StepPermissions({ onBack, onComplete }: StepPermissionsProps) {
  const { user } = useAuth();
  const suggestedOs = useMemo(() => detectDeviceOs(), []);

  const [timeAllowed, setTimeAllowed] = useState(true);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [deliveryAllowed, setDeliveryAllowed] = useState(false);
  const [os, setOs] = useState<DeviceOs>(suggestedOs);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleLocation = async (next: boolean) => {
    setLocationError(null);
    if (!next) {
      setLocationAllowed(false);
      return;
    }

    setLocationLoading(true);
    const result = await requestDeviceLocation();
    setLocationLoading(false);

    if (!result.ok) {
      setLocationAllowed(false);
      setLocationError(result.message);
      toast.error(result.message);
      return;
    }

    setLocationAllowed(true);
    toast.success('Standort erlaubt');
  };

  const finish = async () => {
    if (!user || saving) return;
    setSaving(true);

    try {
      writeConsent({
        time: timeAllowed,
        location: locationAllowed,
        deliveryFolder: deliveryAllowed,
        os,
      });

      const completedAt = new Date().toISOString();
      const { data: companyId, error: companyIdError } = await supabase.rpc('get_user_company_id');
      if (companyIdError || !companyId) {
        throw new Error('Kein Unternehmen zugeordnet — Einrichtung kann nicht abgeschlossen werden.');
      }

      const { error: companyError } = await supabase
        .from('company')
        .update({ onboarding_completed_at: completedAt })
        .eq('id', companyId);
      if (companyError) {
        throw new Error(
          `${companyError.message} — Migration company.onboarding_completed_at ggf. noch nicht ausgeführt.`,
        );
      }

      // Audit: welcher User den Wizard abgeschlossen hat. Die Weiche liest die Firma.
      await supabase
        .from('users')
        .update({ onboarding_completed_at: completedAt })
        .eq('id', user.id);

      clearOnboardingDraft();
      toast.success('Einrichtung abgeschlossen');
      onComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Abschluss fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Berechtigungen</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Einzelne Einwilligungen nach DSGVO Art. 6 Abs. 1 lit. a. Ablehnen ist möglich —
          DispoCenter bleibt nutzbar. Widerruf später in den Einstellungen.
        </p>
      </div>

      <PermissionToggle
        icon={Clock}
        title="Zeit & Datum"
        description="Für korrekte Zeitstempel in Touren und Sendungen."
        checked={timeAllowed}
        onCheckedChange={setTimeAllowed}
      />

      <PermissionToggle
        icon={MapPin}
        title="Standort"
        description="Für Distanzberechnung und Karten. Löst den Browser-Dialog aus."
        checked={locationAllowed}
        loading={locationLoading}
        error={locationError}
        onCheckedChange={(v) => void toggleLocation(v)}
      />

      <PermissionToggle
        icon={FileText}
        title="Lieferschein-Ordner"
        description="KI darf hochgeladene Lieferscheine automatisch auslesen."
        checked={deliveryAllowed}
        onCheckedChange={setDeliveryAllowed}
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <Monitor className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 space-y-1 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Betriebssystem</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Damit die KI passende lokale Upload-/Download-Pfade vorschlagen kann.
              Vorschlag: {OS_LABELS[suggestedOs]}
            </p>
            <div className="pt-1">
              <Label className="sr-only">Betriebssystem</Label>
              <Select value={os} onValueChange={(v) => setOs(v as DeviceOs)}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OS_LABELS) as DeviceOs[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {OS_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-xl border-white/15 bg-white/5"
          disabled={saving}
          onClick={onBack}
        >
          Zurück
        </Button>
        <Button
          type="button"
          className="flex-1 rounded-xl"
          disabled={saving}
          onClick={() => void finish()}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Abschließen…
            </span>
          ) : (
            'Einrichtung abschließen'
          )}
        </Button>
      </div>
    </div>
  );
}

function PermissionToggle({
  icon: Icon,
  title,
  description,
  checked,
  loading,
  error,
  onCheckedChange,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  loading?: boolean;
  error?: string | null;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {checked ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                  <Check className="w-3 h-3" /> An
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-white/5 border border-white/10 rounded-full px-1.5 py-0.5">
                  <X className="w-3 h-3" /> Aus
                </span>
              )}
            </div>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch checked={checked} onCheckedChange={onCheckedChange} />
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
