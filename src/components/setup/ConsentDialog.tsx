import { useMemo, useState } from 'react';
import { Clock, MapPin, ShieldCheck, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ConsentState,
  detectDeviceOs,
  readConsent,
  requestDeviceLocation,
  writeConsent,
} from '@/lib/consent';

type PermissionChoice = 'undecided' | 'allowed' | 'denied';

type ConsentDialogProps = {
  /** Wird aufgerufen, sobald beide Berechtigungen entschieden und gespeichert sind. */
  onComplete?: (state: ConsentState) => void;
  className?: string;
};

export function ConsentDialog({ onComplete, className }: ConsentDialogProps) {
  const existing = useMemo(() => readConsent(), []);
  const [timeChoice, setTimeChoice] = useState<PermissionChoice>(
    existing ? (existing.time ? 'allowed' : 'denied') : 'undecided',
  );
  const [locationChoice, setLocationChoice] = useState<PermissionChoice>(
    existing ? (existing.location ? 'allowed' : 'denied') : 'undecided',
  );
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bothDecided = timeChoice !== 'undecided' && locationChoice !== 'undecided';

  const allowTime = () => {
    setTimeChoice('allowed');
  };

  const denyTime = () => {
    setTimeChoice('denied');
  };

  const allowLocation = async () => {
    setLocationError(null);
    setLocationLoading(true);
    const result = await requestDeviceLocation();
    setLocationLoading(false);

    if (!result.ok) {
      setLocationChoice('denied');
      setLocationError(result.message);
      return;
    }

    setLocationChoice('allowed');
    setLocationError(null);
  };

  const denyLocation = () => {
    setLocationError(null);
    setLocationChoice('denied');
  };

  const finish = () => {
    if (!bothDecided) return;
    setSaving(true);
    const state = writeConsent({
      time: timeChoice === 'allowed',
      location: locationChoice === 'allowed',
      deliveryFolder: existing?.deliveryFolder ?? false,
      os: existing?.os ?? detectDeviceOs(),
    });
    setSaving(false);
    onComplete?.(state);
  };

  return (
    <div className={cn('w-full max-w-lg', className)}>
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">Datenschutz & Gerätezugriff</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              DispoCenter benötigt auf diesem Gerät Einwilligungen für Zeit/Datum und optional
              für den Standort — bevor die Disposition startet.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-left">
          <p className="text-xs font-medium text-foreground">Rechtsgrundlage</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Die Verarbeitung erfolgt auf Grundlage Ihrer Einwilligung gemäß DSGVO Art. 6 Abs. 1
            lit. a. Sie können die Einwilligung jederzeit in den Einstellungen widerrufen.
            Ohne Standort bleibt DispoCenter nutzbar (manuelle Depot-/Adresseingabe).
          </p>
        </div>

        {/* Zeit / Datum */}
        <PermissionCard
          icon={Clock}
          title="Zeit & Datum"
          description="Für korrekte Zeitstempel in Touren, Sendungen und Planungsläufen auf diesem Gerät."
          note="Keine Browser-Berechtigung nötig — nur Ihre Zustimmung zur Nutzung."
          choice={timeChoice}
          onAllow={allowTime}
          onDeny={denyTime}
        />

        {/* Standort */}
        <PermissionCard
          icon={MapPin}
          title="Standort"
          description="Für Distanzberechnung (Depot-Zuordnung) und Kartenanzeige nahe Ihrem Standort."
          note="Löst den nativen Browser-Dialog aus. Ablehnen möglich — dann manuelle Eingabe."
          choice={locationChoice}
          loading={locationLoading}
          error={locationError}
          onAllow={allowLocation}
          onDeny={denyLocation}
        />

        <Button
          className="w-full rounded-xl"
          disabled={!bothDecided || saving}
          onClick={finish}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Speichern…
            </span>
          ) : (
            'Weiter zu DispoCenter'
          )}
        </Button>

        {!bothDecided && (
          <p className="text-center text-xs text-muted-foreground">
            Bitte entscheiden Sie für beide Punkte — getrennt voneinander.
          </p>
        )}
      </div>
    </div>
  );
}

function PermissionCard({
  icon: Icon,
  title,
  description,
  note,
  choice,
  loading,
  error,
  onAllow,
  onDeny,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  note: string;
  choice: PermissionChoice;
  loading?: boolean;
  error?: string | null;
  onAllow: () => void | Promise<void>;
  onDeny: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {choice === 'allowed' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <Check className="w-3 h-3" /> Erlaubt
              </span>
            )}
            {choice === 'denied' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                <X className="w-3 h-3" /> Abgelehnt
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          <p className="text-[11px] text-muted-foreground/80">{note}</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 rounded-xl"
          disabled={loading || choice === 'allowed'}
          onClick={() => void onAllow()}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Anfragen…
            </span>
          ) : (
            'Erlauben'
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl border-white/15 bg-white/5 hover:bg-white/10"
          disabled={loading || choice === 'denied'}
          onClick={onDeny}
        >
          Ablehnen
        </Button>
      </div>
    </div>
  );
}
