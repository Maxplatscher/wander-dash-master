

# Redesign: Gradient Modern mit Teal-Akzent

## Überblick

Das gesamte Dashboard bekommt ein modernes "Gradient Modern"-Design: weiche Farbverläufe als Akzente, abgerundete Karten mit sanften Schatten, subtile Animationen und Micro-Interactions — alles in der bestehenden Teal-Farbpalette.

## Visuelle Änderungen

### Farbsystem (CSS-Variablen in `index.css`)
- **Hintergrund**: Leichter warmgrauer Ton statt kaltem Grau (`#F8FAFB`)
- **Karten**: Leichter Glaseffekt mit `backdrop-blur` und halbtransparentem Weiß
- **Sidebar**: Dunklerer, tieferer Gradient (von `#0F1A2E` nach `#162236`)
- **Primärfarbe bleibt Teal**, bekommt aber einen sanften Gradient-Bereich (`from-teal-500 to-cyan-400`)
- Neue CSS-Variable `--gradient-primary` für wiederverwendbare Gradients

### Sidebar (`DispatchSidebar.tsx`)
- Subtiler vertikaler Gradient-Hintergrund statt Flat-Color
- Aktiver Nav-Eintrag: leuchtender Teal-Gradient-Streifen links + leichter Glow-Effekt
- Hover: sanftes Aufleuchten mit `transition-all duration-200`
- Logo-Bereich: feiner Separator mit Gradient-Linie statt harter Border
- Collapse-Button: rundes Icon mit Hover-Glow

### Top-Bar (`DispatchDashboard.tsx` ContextBar)
- Leichter Glaseffekt: `bg-white/70 backdrop-blur-xl`
- Subtiler Schatten statt harter Border unten
- Inputs/Selects: abgerundeter, mit weichen Übergängen

### KPI-Karten (`KpiCard.tsx`)
- Subtiler Gradient-Hintergrund pro Variante (z.B. `from-white to-teal-50/30`)
- Größerer `border-radius` (xl → 2xl)
- Sanfter Box-Shadow mit Farbton der Variante
- Icon bekommt einen dezenten Gradient-Kreis statt Flat-Background
- Hover: leichtes "Aufheben" + Shadow-Verstärkung (bereits teilweise vorhanden)

### Tagesleitstelle (Startseite)
- Begrüßung: Gradient-Text für den Namen/Emoji-Bereich
- Tageszusammenfassung-Button: sanfterer, mehrstufiger Gradient mit Glow-Effekt
- Verkehrshinweise-Karte: feine Gradient-Linie oben
- Wetter-Widget: Gradient-Overlay passend zur Wetterlage

### Allgemeine Details
- **Trennlinien**: Gradient-Linien statt solider Borders (von transparent über Teal nach transparent)
- **Scrollbar**: Custom-styled, schmal und Teal-getönt
- **Buttons**: Primär-Buttons mit Gradient + dezenter Hover-Glow
- **Badges**: Leichter Glaseffekt mit halbtransparentem Hintergrund
- **Tabellen/Listen**: Zebra-Striping mit sehr sanften Teal-Tönen
- **Animationen**: Staggered fade-in bei Listen, smooth scale bei Hover auf Karten

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/index.css` | Neue CSS-Variablen, Custom Scrollbar, Gradient-Utilities |
| `tailwind.config.ts` | Neue Keyframes (shimmer, glow), erweiterte Farben |
| `src/components/dispatch/KpiCard.tsx` | Gradient-Hintergrund, verbesserter Hover |
| `src/components/dispatch/DispatchSidebar.tsx` | Gradient-Sidebar, Glow-Active-State |
| `src/pages/DispatchDashboard.tsx` | Glaseffekt-TopBar |
| `src/pages/dispatch/Tagesleitstelle.tsx` | Gradient-Texte, verfeinerte Karten |
| `src/components/dispatch/WeatherWidget.tsx` | Gradient-Overlay |
| `src/components/ui/button.tsx` | Gradient-Variante für Primary |
| `src/pages/dispatch/Probleme.tsx` | Angepasste Karten-Styles |

## Technische Details

- Alle Gradients nutzen Tailwind-Klassen (`bg-gradient-to-br`, `from-`, `to-`, `via-`)
- Glaseffekte via `backdrop-blur-xl` + `bg-white/70`
- Custom CSS-Properties für Theme-Konsistenz
- Bestehende Theme-Auswahl in Einstellungen wird erweitert um die neuen Gradient-Variablen
- Keine neuen Dependencies nötig — alles mit Tailwind + CSS

