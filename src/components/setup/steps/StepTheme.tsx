import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  THEME_PRESETS,
  applyTheme,
  loadSavedThemeName,
  saveThemeName,
} from '@/lib/theme-presets';
import { toast } from 'sonner';

type StepThemeProps = {
  value: string;
  onChange: (themeName: string) => void;
  onBack: () => void;
  onContinue: (themeName: string) => void;
};

export function StepTheme({ value, onChange, onBack, onContinue }: StepThemeProps) {
  const [active, setActive] = useState(value || loadSavedThemeName());

  const selectTheme = (name: string) => {
    const preset = THEME_PRESETS.find((t) => t.name === name);
    if (!preset) return;
    applyTheme(preset);
    saveThemeName(preset.name);
    setActive(preset.name);
    onChange(preset.name);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          Farbschema
        </h2>
        <p className="text-sm text-muted-foreground">
          Wähle eine Akzentfarbe für DispoCenter. Später jederzeit in den Einstellungen änderbar.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEME_PRESETS.map((t) => {
          const selected = active === t.name;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => selectTheme(t.name)}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition-all',
                selected
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-primary/40 hover:bg-white/[0.05]',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-5 h-5 rounded-full border-2 border-white/40 shrink-0"
                  style={{ backgroundColor: t.preview }}
                />
                <span className="text-xs font-medium text-foreground leading-tight">{t.name}</span>
              </div>
              <div className="flex gap-1 mt-2">
                <div className="h-2 flex-1 rounded" style={{ backgroundColor: t.preview }} />
                <div className="h-2 w-6 rounded bg-white/15" />
                <div className="h-2 w-4 rounded bg-white/10" />
              </div>
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-xl border-white/15 bg-white/5"
          onClick={onBack}
        >
          Zurück
        </Button>
        <Button
          type="button"
          className="flex-1 rounded-xl"
          onClick={() => {
            const name = active || loadSavedThemeName();
            saveThemeName(name);
            toast.success(`Theme „${name}“ übernommen`);
            onContinue(name);
          }}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}
