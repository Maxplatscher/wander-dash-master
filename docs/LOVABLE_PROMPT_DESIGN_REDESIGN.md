# Lovable Prompt – Dark Glassmorphism Redesign für DispoCenter

> **So benutzt du das:** Lade das Pinterest-Bild zusätzlich in Lovable hoch (Drag & Drop) und füge danach diesen Text als Prompt ein. Lovable arbeitet mit Bild + Text deutlich genauer als nur mit Text.

---

## PROMPT ANFANG (alles ab hier in Lovable einfügen)

Ich möchte das komplette UI-Design meiner App auf das **dunkle Glassmorphism-Style** vom angehängten Pinterest-Screenshot umstellen. Das Design soll **1:1** übernommen werden, aber **alle bestehenden Funktionen, Komponenten, Datenflüsse, Routen, Auth und Supabase-Calls müssen unverändert weiterlaufen.** Es ist ein reines Visual-Redesign – kein Logik-Refactor.

### Was bleibt unverändert (BITTE NICHT ANFASSEN)

- Alle Dateien unter `src/integrations/supabase/`, `src/hooks/`, `src/lib/`
- Alle Datenabfragen mit `useQuery` / `supabase.from(...)` / `supabase.functions.invoke(...)`
- Auth-Flow (`src/pages/Auth.tsx`, `useAuth`-Hook, RoleGuard)
- Routing in `src/App.tsx` und das Section-Switching im `DispatchDashboard`
- Datenbank-Schema (Supabase) und Edge Functions (`supabase/functions/`)
- Der gesamte Ordner `legacy/` darf nicht modifiziert werden
- Phase-3-Integration-Funktionen (Confirm-Dialog beim Löschen, Test-Button, Vault-Logik)

Wenn du eine Komponente neu schreibst: behalte exakt dieselben Props, denselben State, dieselben Funktionsnamen, dieselben React-Query-Keys.

### Design-System (das wird die neue Source-of-Truth)

**Farben** – global in `src/index.css` als CSS-Variablen + in `tailwind.config.ts` als Tokens setzen:

```
--bg-base:          #0a0e1a   (tiefes Marineblau-Schwarz)
--bg-elevated:      #11172a   (Card-Untergrund opak)
--bg-glass:         rgba(255,255,255,0.04)   (Glasoberflächen)
--bg-glass-hover:   rgba(255,255,255,0.07)
--border-subtle:    rgba(255,255,255,0.08)
--border-glow:      rgba(99,179,237,0.25)    (blaue Akzent-Borders)
--text-primary:     #e8edf5
--text-secondary:   #8a94a8
--text-muted:       #5d6680
--accent-blue:      #4ea0ff   (Haupt-Akzent für Werte/Highlights)
--accent-blue-glow: rgba(78,160,255,0.35)
--accent-cyan:      #4ad8d8
--accent-amber:     #f5b94a   (Sonnen-/Warn-Akzent)
--success:          #4ade80
--danger:           #ff6b6b
```

**Hintergrund:** Body bekommt einen sehr dezenten Radial-Gradient von oben links (leichter blauer Schimmer) auf `--bg-base`, plus den vorhandenen `ParticleBackground` als sehr subtilen Layer (Opacity reduzieren, Partikelfarbe auf `--accent-blue` mit ~10% Alpha).

**Glassmorphism Card-Style** als wiederverwendbare Klasse:
```css
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05);
  transition: background 200ms ease, border-color 200ms ease;
}
.glass-card:hover { background: var(--bg-glass-hover); }
.glass-card-elevated { background: var(--bg-elevated); /* gleiche Border/Radius/Shadow */ }
```

**Typografie:**
- Sans-Serif (Inter via Google Fonts laden)
- Hero-Wert: `text-7xl font-light tracking-tight text-text-primary` (z.B. die große Temperatur-Anzeige im Original → bei mir: aktive Tour-Anzahl oder Tages-KPI)
- Section-Titel: `text-xs uppercase tracking-widest text-text-secondary font-medium`
- Body: `text-sm text-text-primary`
- Hilfstext: `text-xs text-text-muted`

**Radius-System:** außen `rounded-3xl` (24px) für Hauptcards, `rounded-2xl` für Sub-Cards, `rounded-xl` für Buttons, `rounded-full` für Avatare/Icon-Buttons.

**Spacing:** großzügig. Cards haben `p-6`, Sections haben `gap-5`, Page-Padding `p-6 md:p-8`.

### Layout: Sidebar + Main

**Sidebar** wird zur **schlanken Icon-Rail** wie im Pinterest-Design:
- Breite: 72px fix (kein Collapse mehr nötig – sie ist immer schmal)
- Höhe: 100vh, `position: sticky`
- Hintergrund: `--bg-elevated` mit dezenter Glas-Optik
- Top: Logo-Icon (das Gradient-Square aus `LayoutDashboard`)
- Mitte: vertikale Liste der 7 Sektionen, jede als 48×48 Icon-Button:
  - inaktiv: nur Icon, Farbe `--text-secondary`, Hover: `--bg-glass-hover` mit `--text-primary`
  - aktiv: Icon in `--accent-blue`, Hintergrund mit weichem blauen Glow (`box-shadow: 0 0 24px var(--accent-blue-glow)`), linker Indikator-Strich (4px breit, `--accent-blue`, vertikal zentriert, gerundet)
  - Tooltip rechts mit dem Section-Label beim Hover
- Bottom: kleiner runder Avatar (User-Initialen oder Bild), darunter Logout-Icon
- Mapping (Reihenfolge wie aktuell):
  1. `tagesleitstelle` → `LayoutDashboard`-Icon
  2. `operative-lage` → `Map`-Icon (wechseln, klarer Unterschied zu Tagesleitstelle)
  3. `kalender` → `Calendar`
  4. `kontrollzentrale` → `Package`
  5. `fahrer` → `Users`
  6. `probleme` → `AlertTriangle`
  7. `einstellungen` → `Settings`
- Die Section-IDs und `navigateTo`-Aufrufe bleiben **identisch**.

**Main-Area:**
- Top-Bar (Höhe 64px, kein Border, transparent über dem Body):
  - Links: aktueller Section-Label als großer leichter Titel (`text-2xl font-light`)
  - Mitte: Datepicker (`selectedDate`) und Tenant-Select – jeweils als Glass-Pill
  - Rechts: runder Search-Icon-Button (Icon-Button im Glass-Stil), runder Bell-Icon-Button mit kleinem Notification-Dot (rot) wenn Probleme > 0

### Section-für-Section Mapping

Ich übernehme das Bild **konzeptionell** auf die Operative Lage, aber dieselbe Glas-Sprache wendest du auf alle Sektionen an.

#### Operative Lage (`src/pages/dispatch/OperativeLage.tsx`)

Layout im Pinterest-Stil – grobe Aufteilung:

```
┌─────────────────────────────────────────────────────────────────┐
│  HERO-CARD (große Tages-KPI, links breit ~30%)                  │
│  + 3 KPI-CARDS (gleiche Höhe wie Hero, je ~20% breit)           │
├─────────────────────────────────────────────────────────────────┤
│  TOUREN-LISTE (links, ~40%)   │  LIVE-MAP (rechts, ~60%)        │
└─────────────────────────────────────────────────────────────────┘
```

- **Hero-Card** (entspricht der "28°C"-Card): zeigt das wichtigste KPI des Tages an. Ich schlage vor: aktive Touren heute als große Zahl, darunter Status-Label ("12 aktive Touren · 3 verspätet") und Datum. Optional: kleines Icon (Truck) oben links als animiertes Element analog zum Wetter-Icon.
- **3 KPI-Cards** rechts oben (wie Wind Status, UV Index, Sunrise & Sunset):
  1. **Auslieferungs-Quote heute** – große Zahl in % + Mini-Sparkline (recharts `<Sparkline>` über letzte 7 Tage)
  2. **Aktive Fahrer** – große Zahl + halbkreis-Gauge (Anteil aktiv/gesamt) – nutze `recharts` `RadialBarChart`
  3. **Probleme offen** – große Zahl + kleines Donut der Schweregrad-Verteilung
  - Jede Card ist klickbar und öffnet das passende `KpiDetailDialog` (existiert schon).
- **Touren-Liste** unten links (entspricht "7 days Forecast"): zeigt die nächsten 5–7 Touren des Tages, jede Zeile mit:
  - Fahrer-Avatar/Initiale (kleiner farbiger Kreis)
  - Tour-Beschreibung
  - Stops-Count + ETA
  - Mini-Trend-Pfeil (on-time / delayed)
  - Hover: subtle Highlight, Klick → `DriverDetailDialog`
- **Live-Map** unten rechts (entspricht "Weather condition map"):
  - Bestehende `LiveMap`-Komponente weiterverwenden
  - Tile-Style auf dunkel umstellen (z.B. CARTO `dark_all` oder Mapbox `dark-v11` falls dort genutzt)
  - Marker und Routen-Linien in `--accent-blue` mit Glow
  - Card-Wrapper bekommt `glass-card`-Style

#### Tagesleitstelle / Kalender / Kontrollzentrale / Fahrer / Probleme / Einstellungen

Gleiches Vokabular: Body auf `--bg-base`, alle bestehenden weißen Cards (`bg-white`, `border-gray-100`, `shadow-sm`) auf `glass-card` umstellen, alle Texte auf die neue Farbpalette mappen, alle Buttons in den Glass-Stil heben (`bg-glass border border-subtle hover:bg-glass-hover`).

**Wichtig für Einstellungen → Integrationen-Sektion:**
- Der `AlertDialog` (Confirm-Delete) bleibt funktional 1:1, aber Glas-Style: `bg-bg-elevated`, blauer Akzent-Button bleibt destructive (rotes Glow).
- Test-Button und Statusanzeige (`last_test_at`, `last_test_message`) im neuen Stil mit kleinem grünen/roten Status-Dot.

### Komponenten, die du anpasst (aber nicht ersetzt!)

- `src/components/dispatch/KpiCard.tsx` → Glas-Variant, behält Props (`title`, `value`, `subtitle`, `onClick`)
- `src/components/dispatch/KpiDetailDialog.tsx` → DialogContent auf Glas-Style
- `src/components/dispatch/DriverDetailDialog.tsx` → identisch, neuer Style
- `src/components/dispatch/LiveMap.tsx` → nur Tile-Style + Marker-Farben anpassen
- `src/components/dispatch/WeatherWidget.tsx` → in den neuen KPI-Card-Style integrieren
- `src/components/dispatch/ParticleBackground.tsx` → Partikelfarbe `--accent-blue`, Opacity reduzieren
- `src/components/ui/*` (shadcn) → globale Theme-Variablen reichen, keine einzeln editieren falls nicht nötig

### Animations & Micro-Interactions

- Alle Cards: `transition: all 200ms ease`
- Hover auf interaktive Elemente: leichtes Heben (`transform: translateY(-2px)` + intensiverer Shadow)
- Aktive Tour-Marker auf der Map: pulsing dot (CSS keyframes, 2s loop, blauer Glow)
- Section-Wechsel: `framer-motion` falls verfügbar, sonst CSS-Fade (150ms)
- Loader: ersetze die existierenden `Loader2`-Spinner durch eine dünne Glas-Variante (1px stroke, langsamere Rotation)

### Acceptance Criteria (das muss am Ende stimmen)

1. Login funktioniert wie vorher, Auth-Flow unverändert
2. Alle 7 Sektionen sind über die neue schmale Sidebar erreichbar, Section-IDs unverändert
3. Datenwerte in allen KPIs/Listen/Karten kommen weiter aus Supabase und stimmen
4. Integrationen-Sektion: Anlegen, Bearbeiten, Testen, Löschen mit Confirm-Dialog funktionieren
5. LiveMap zeigt Touren auf dunkler Karte mit blauen Routen
6. Mobile/responsive: ab 1024px wie beschrieben, darunter Sidebar wird zu Bottom-Bar oder kollabiert auf Burger
7. Keine TypeScript-Fehler beim Build (`npm run build`), keine ESLint-Errors
8. Bestehende Tests in `src/__tests__` (falls vorhanden) bleiben grün

### Reihenfolge der Implementierung

Bitte arbeite in dieser Reihenfolge, damit ich Schritt für Schritt prüfen kann:

1. CSS-Variablen + `tailwind.config.ts` Theme-Tokens
2. Body-Background, ParticleBackground anpassen
3. Sidebar auf Icon-Rail umbauen
4. Top-Bar + Page-Layout im DashboardLayout
5. KpiCard + alle KPI-Cards in OperativeLage
6. LiveMap-Tile + Marker-Style
7. Touren-Liste in OperativeLage
8. Restliche Sektionen (Tagesleitstelle, Kalender, Kontrollzentrale, Fahrer, Probleme, Einstellungen) auf neuen Style
9. Dialogs (KpiDetailDialog, DriverDetailDialog, AlertDialog) anpassen
10. Final Polish: Animations, Micro-Interactions, Loading-States

Nach jedem Schritt: kurz beschreiben was geändert wurde, damit ich verifizieren kann.

## PROMPT ENDE
