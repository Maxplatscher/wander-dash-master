

# KPI-Karten: Farbe nur bei Werten > 0

## Änderung

In `src/pages/dispatch/Tagesleitstelle.tsx` (Zeilen 129-130): Die `variant` für "Unzugewiesen" und "Konflikte" wird dynamisch gesetzt — `warning`/`destructive` nur wenn der Wert > 0, sonst `default`.

```ts
// Zeile 129: variant wird konditionell
{ ..., variant: (kpis?.unassigned ?? 0) > 0 ? 'warning' : 'default' as const },
// Zeile 130: variant wird konditionell  
{ ..., variant: (kpis?.conflicts ?? 0) > 0 ? 'destructive' : 'default' as const },
```

Eine minimale Änderung — nur 2 Zeilen betroffen.

