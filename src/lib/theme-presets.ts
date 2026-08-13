export type ThemePreset = {
  name: string;
  primary: string;
  sidebarBg: string;
  sidebarPrimary: string;
  sidebarAccent: string;
  sidebarBorder: string;
  preview: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Teal (Standard)',
    primary: '174 62% 38%',
    sidebarBg: '210 25% 14%',
    sidebarPrimary: '174 62% 50%',
    sidebarAccent: '210 20% 20%',
    sidebarBorder: '210 15% 22%',
    preview: '#319795',
  },
  {
    name: 'Blau',
    primary: '217 91% 60%',
    sidebarBg: '222 47% 11%',
    sidebarPrimary: '217 91% 60%',
    sidebarAccent: '222 30% 18%',
    sidebarBorder: '222 25% 20%',
    preview: '#3B82F6',
  },
  {
    name: 'Violett',
    primary: '262 83% 58%',
    sidebarBg: '270 30% 12%',
    sidebarPrimary: '262 83% 58%',
    sidebarAccent: '270 20% 20%',
    sidebarBorder: '270 15% 22%',
    preview: '#8B5CF6',
  },
  {
    name: 'Orange',
    primary: '25 95% 53%',
    sidebarBg: '20 25% 12%',
    sidebarPrimary: '25 95% 53%',
    sidebarAccent: '20 20% 20%',
    sidebarBorder: '20 15% 22%',
    preview: '#F97316',
  },
  {
    name: 'Grün',
    primary: '142 71% 45%',
    sidebarBg: '150 25% 12%',
    sidebarPrimary: '142 71% 45%',
    sidebarAccent: '150 20% 20%',
    sidebarBorder: '150 15% 22%',
    preview: '#22C55E',
  },
  {
    name: 'Rot',
    primary: '0 72% 51%',
    sidebarBg: '0 25% 12%',
    sidebarPrimary: '0 72% 51%',
    sidebarAccent: '0 20% 20%',
    sidebarBorder: '0 15% 22%',
    preview: '#EF4444',
  },
];

export const THEME_STORAGE_KEY = 'dispatch-theme';
export const DEFAULT_THEME_NAME = 'Teal (Standard)';

export function applyTheme(t: ThemePreset) {
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--ring', t.primary);
  root.style.setProperty('--accent', t.primary.replace(/\d+%$/, '92%'));
  root.style.setProperty('--accent-foreground', t.primary.replace(/\d+%$/, '25%'));
  root.style.setProperty('--sidebar-background', t.sidebarBg);
  root.style.setProperty('--sidebar-primary', t.sidebarPrimary);
  root.style.setProperty('--sidebar-accent', t.sidebarAccent);
  root.style.setProperty('--sidebar-border', t.sidebarBorder);
  root.style.setProperty('--sidebar-ring', t.sidebarPrimary);
}

export function loadSavedThemeName(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_NAME;
}

export function saveThemeName(name: string) {
  localStorage.setItem(THEME_STORAGE_KEY, name);
}

export function getThemeByName(name: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.name === name) ?? THEME_PRESETS[0];
}

export function applySavedTheme() {
  applyTheme(getThemeByName(loadSavedThemeName()));
}
