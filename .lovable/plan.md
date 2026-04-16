

# Projekt-Export für Claude erstellen

## Ziel

Alle relevanten Code-Dateien und Konfigurationen des Projekts in einem strukturierten Format sammeln und als herunterladbare Datei bereitstellen, die bei Claude eingefügt werden kann.

## Technischer Ansatz

### 1. Datei-Sammlung

**Zu exportierende Dateien:**
- Alle `.tsx`, `.ts`, `.jsx`, `.js` Dateien aus `src/`
- Komponenten aus `src/components/`
- Seiten aus `src/pages/`
- Hooks aus `src/hooks/`
- Utilities aus `src/lib/`
- Supabase-Konfiguration: `supabase/config.toml`, `supabase/functions/*/index.ts`
- Projekt-Konfiguration: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`
- Memory-Dateien aus `.lovable/`

**Ausgeschlossen:**
- `node_modules/`, `dist/`, `.git/`
- Lock-Dateien (`bun.lock`, `package-lock.json`)
- Build-Artefakte

### 2. Export-Format

Zwei Optionen werden erstellt:

**Option A: Strukturierte Markdown-Datei**
- Jede Datei als Code-Block mit Pfad-Header
- Übersichtliche Struktur mit Inhaltsverzeichnis
- Direkt kopierbar für Claude
- Datei: `/mnt/documents/projekt-export.md`

**Option B: ZIP-Archiv**
- Vollständige Ordnerstruktur beibehalten
- Alle Dateien einzeln enthalten
- Datei: `/mnt/documents/projekt-export.zip`

### 3. Umsetzung

```bash
# Markdown-Export erstellen
python3 /tmp/export_projekt.py > /mnt/documents/projekt-export.md

# ZIP-Archiv erstellen
cd /dev-server
zip -r /mnt/documents/projekt-export.zip \
  src/ \
  supabase/ \
  .lovable/ \
  package.json \
  tsconfig.json \
  vite.config.ts \
  tailwind.config.ts \
  -x "*.lock" "node_modules/*" "dist/*"
```

Das Python-Script durchläuft alle relevanten Verzeichnisse, sammelt Code-Dateien und formatiert sie als Markdown mit klarer Struktur.

## Ergebnis

Zwei downloadbare Dateien in `/mnt/documents/`:
1. `projekt-export.md` — Sofort kopierbar für Claude (empfohlen)
2. `projekt-export.zip` — Vollständiges Projekt-Archiv

