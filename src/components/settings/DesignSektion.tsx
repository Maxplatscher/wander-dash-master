import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ACCENTS,
  DENSITY_OPTIONS,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type AccentId,
  type Appearance,
  type DensityId,
} from '@/lib/appearance';

function persist(next: Appearance) {
  saveAppearance(next);
  applyAppearance(next);
  return next;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabledIds,
}: {
  options: { id: T; name: string }[];
  value: T;
  onChange: (id: T) => void;
  disabledIds?: readonly T[];
}) {
  return (
    <div className="inline-flex rounded-[4px] border border-hairline p-0.5 gap-0.5">
      {options.map((option) => {
        const active = option.id === value;
        const disabled = disabledIds?.includes(option.id) ?? false;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'h-8 px-3 text-[12.5px] font-semibold rounded-[4px] border transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:border-primary',
              disabled && 'cursor-not-allowed opacity-50 hover:border-transparent hover:text-muted-foreground',
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export function DesignSektion() {
  const [appearance, setAppearance] = useState<Appearance>(() => loadAppearance());
  const activeAccent = ACCENTS.find((item) => item.id === appearance.accent) ?? ACCENTS[0];

  const update = (partial: Partial<Appearance>) => {
    setAppearance((current) => persist({ ...current, ...partial, mode: 'dark' }));
  };

  return (
    <div className="glass-card p-5">
      <p className="card-title">Design</p>
      <p className="meta-text mt-1">
        Gilt für alle Ansichten und wird pro Benutzer gespeichert.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Akzentfarbe
          </p>
          <div className="mt-3 flex gap-2.5">
            {ACCENTS.map((accent) => {
              const selected = accent.id === appearance.accent;
              return (
                <button
                  key={accent.id}
                  type="button"
                  aria-label={accent.name}
                  aria-pressed={selected}
                  onClick={() => update({ accent: accent.id as AccentId })}
                  className="h-[38px] w-[38px] rounded-[4px] border-2"
                  style={{
                    backgroundColor: accent.hex,
                    borderColor: selected ? 'hsl(var(--foreground))' : 'transparent',
                  }}
                />
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">{activeAccent.name}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modus
          </p>
          <div className="mt-3">
            <Segmented
              options={[
                { id: 'dark', name: 'Dunkel' },
                { id: 'light', name: 'Hell' },
              ]}
              value="dark"
              disabledIds={['light']}
              onChange={() => update({ mode: 'dark' })}
            />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Hell: in Vorbereitung</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Informationsdichte
          </p>
          <div className="mt-3">
            <Segmented
              options={DENSITY_OPTIONS}
              value={appearance.density}
              onChange={(density: DensityId) => update({ density })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
