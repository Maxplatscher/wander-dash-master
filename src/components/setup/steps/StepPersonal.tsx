import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  OnboardingRole,
  PersonalStepData,
  ROLE_LABELS,
} from '@/lib/onboarding';
import { toast } from 'sonner';

type StepPersonalProps = {
  value: PersonalStepData;
  onChange: (next: PersonalStepData) => void;
  onBack: () => void;
  onContinue: (saved: PersonalStepData) => void;
};

export function StepPersonal({ value, onChange, onBack, onContinue }: StepPersonalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const metaName = typeof meta?.full_name === 'string' ? meta.full_name : '';
    const metaPhone = typeof meta?.phone === 'string' ? meta.phone : '';
    onChange({
      ...value,
      email: user.email,
      fullName: value.fullName || metaName,
      phone: value.phone || metaPhone,
    });
    // nur einmal beim Mount / User-Wechsel vorbefüllen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  const patch = (partial: Partial<PersonalStepData>) => onChange({ ...value, ...partial });

  const canContinue = value.fullName.trim().length > 1 && Boolean(value.email) && Boolean(value.role);

  const handleContinue = async () => {
    if (!canContinue || !user || saving) return;
    setSaving(true);

    try {
      const fullName = value.fullName.trim();
      const phone = value.phone.trim();

      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone },
      });
      if (metaError) throw new Error(metaError.message);

      // users-Tabelle hat aktuell kein name/phone — nur role aktualisieren
      const { error: usersError } = await supabase
        .from('users')
        .update({ role: value.role })
        .eq('id', user.id);

      if (usersError) {
        // Fallback: Match über E-Mail (ältere Datensätze)
        const { error: emailUpdateError } = await supabase
          .from('users')
          .update({ role: value.role })
          .eq('email', user.email ?? value.email);
        if (emailUpdateError) throw new Error(emailUpdateError.message);
      }

      // user_roles steuert get_my_role — RLS erlaubt Schreibzugriff oft nur Admins
      const { error: deleteRoleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);

      let roleSynced = !deleteRoleError;
      if (!deleteRoleError) {
        const { error: insertRoleError } = await supabase.from('user_roles').insert({
          user_id: user.id,
          role: value.role,
        });
        roleSynced = !insertRoleError;
        if (insertRoleError) {
          console.warn('user_roles insert blocked:', insertRoleError.message);
        }
      } else {
        console.warn('user_roles delete blocked:', deleteRoleError.message);
      }

      if (!roleSynced) {
        toast.message('Profil gespeichert', {
          description: 'Rolle in user_roles konnte nicht gesetzt werden (RLS). users.role ist aktualisiert.',
        });
      } else {
        toast.success('Persönliche Daten gespeichert');
      }

      onContinue({ ...value, fullName, phone, email: user.email ?? value.email });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Persönliche Daten</h2>
        <p className="text-sm text-muted-foreground">
          Name und Telefon für dein Profil. E-Mail kommt aus der Anmeldung.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full-name">Name</Label>
        <Input
          id="full-name"
          value={value.fullName}
          onChange={(e) => patch({ fullName: e.target.value })}
          placeholder="Max Mustermann"
          className="bg-white/5 border-white/10 rounded-xl"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          value={value.email}
          readOnly
          disabled
          className="bg-white/5 border-white/10 rounded-xl opacity-80"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefon</Label>
        <Input
          id="phone"
          value={value.phone}
          onChange={(e) => patch({ phone: e.target.value })}
          placeholder="+49 …"
          className="bg-white/5 border-white/10 rounded-xl"
          autoComplete="tel"
        />
      </div>

      <div className="space-y-2">
        <Label>Rolle</Label>
        <Select
          value={value.role}
          onValueChange={(v) => patch({ role: v as OnboardingRole })}
        >
          <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABELS) as OnboardingRole[]).map((key) => (
              <SelectItem key={key} value={key}>
                {ROLE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Als Ersteinrichter typischerweise Admin. Später in den Einstellungen anpassbar.
        </p>
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
          disabled={!canContinue || saving}
          onClick={() => void handleContinue()}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Speichern…
            </span>
          ) : (
            'Weiter'
          )}
        </Button>
      </div>
    </div>
  );
}
