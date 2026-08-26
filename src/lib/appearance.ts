export type AccentId = 'cyan' | 'bernstein' | 'salbei' | 'stahlblau';
export type ColorMode = 'dark' | 'light';
export type DensityId = 'compact' | 'balanced' | 'airy';

export type Appearance = {
  accent: AccentId;
  mode: ColorMode;
  density: DensityId;
};

export const ACCENTS: {
  id: AccentId;
  name: string;
  hex: string;
  hsl: string;
  hover: string;
}[] = [
  { id: 'cyan', name: 'Cyan', hex: '#7ce8f5', hsl: '186 86% 72%', hover: '187 75% 64%' },
  { id: 'bernstein', name: 'Bernstein', hex: '#f0b95e', hsl: '37 83% 65%', hover: '37 75% 55%' },
  { id: 'salbei', name: 'Salbei', hex: '#6ee7a5', hsl: '147 71% 67%', hover: '147 60% 55%' },
  { id: 'stahlblau', name: 'Stahlblau', hex: '#5980a6', hsl: '209 30% 50%', hover: '209 30% 42%' },
];

export const DENSITY_OPTIONS: { id: DensityId; name: string }[] = [
  { id: 'compact', name: 'Kompakt' },
  { id: 'balanced', name: 'Ausgewogen' },
  { id: 'airy', name: 'Luftig' },
];

export const APPEARANCE_STORAGE_KEY = 'dispatch-appearance';

export const DEFAULT_APPEARANCE: Appearance = {
  accent: 'cyan',
  mode: 'dark',
  density: 'balanced',
};

function isAccentId(value: unknown): value is AccentId {
  return ACCENTS.some((item) => item.id === value);
}

function isDensityId(value: unknown): value is DensityId {
  return DENSITY_OPTIONS.some((item) => item.id === value);
}

export function getAccent(id: AccentId) {
  return ACCENTS.find((item) => item.id === id) ?? ACCENTS[0];
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return {
      accent: isAccentId(parsed.accent) ? parsed.accent : DEFAULT_APPEARANCE.accent,
      // Light theme is not shipped yet — always persist/apply dark.
      mode: 'dark',
      density: isDensityId(parsed.density) ? parsed.density : DEFAULT_APPEARANCE.density,
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(appearance: Appearance) {
  localStorage.setItem(
    APPEARANCE_STORAGE_KEY,
    JSON.stringify({ ...appearance, mode: 'dark' }),
  );
}

export function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  const accent = getAccent(appearance.accent);
  root.style.setProperty('--primary', accent.hsl);
  root.style.setProperty('--primary-glow', accent.hsl);
  root.style.setProperty('--primary-hover', accent.hover);
  root.style.setProperty('--ring', accent.hsl);
  root.style.setProperty('--accent', accent.hsl);
  root.style.setProperty('--info', accent.hsl);
  root.style.setProperty('--accent-cyan', accent.hsl);
  root.style.setProperty('--accent-blue', accent.hsl);
  root.style.setProperty('--sidebar-primary', accent.hsl);
  root.style.setProperty('--sidebar-ring', accent.hsl);
  root.dataset.density = appearance.density;
  root.dataset.colorMode = 'dark';
}

export function applySavedAppearance() {
  applyAppearance(loadAppearance());
}
