

# Animated Particles/Grid Hintergrund

## Konzept
Ein animiertes Partikel-Netzwerk im Hintergrund des Dashboards: Langsam schwebende Punkte, die sich mit feinen Linien verbinden, wenn sie nah beieinander sind. Navy-Blau/Cyan-Farbtöne. Subtil, performant, lebendig.

## Umsetzung

### 1. Neue Komponente: `src/components/dispatch/ParticleBackground.tsx`
- Canvas-basierte Partikel-Animation mit `requestAnimationFrame`
- ~60 Partikel, die langsam schweben und bei Nähe Linien zueinander ziehen
- Farben: halbdurchsichtige Cyan/Blau-Punkte auf dem dunklen Navy-Hintergrund
- Fixiert hinter dem Content (`position: fixed`, `z-index: 0`)
- Performant: reines Canvas 2D, kein Three.js nötig

### 2. Integration in `src/pages/DispatchDashboard.tsx`
- `<ParticleBackground />` als erstes Kind im Layout rendern
- Content bekommt `position: relative; z-index: 1`

### 3. Subtile Glow-Akzente in `src/index.css`
- 2-3 weiche radiale Gradient-Spots (Blau/Cyan, ~10% Opacity) über `.bg-dashboard` layern, damit der Hintergrund auch ohne Animation Tiefe hat
- Karten bekommen einen leichten `backdrop-filter: blur()` für Glaseffekt

### Technische Details
- Keine neuen Dependencies nötig (reines Canvas API)
- `devicePixelRatio`-aware für scharfes Rendering
- `resize`-Listener für responsive Canvas-Größe
- Animation pausiert wenn Tab nicht sichtbar (`visibilitychange`)

