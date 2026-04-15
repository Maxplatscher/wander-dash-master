

# Fahrzeug-Bereich im Fahrer-Dialog nur bei vorhandenen Fahrzeugen anzeigen

## Was sich ändert

Der gesamte "Fahrzeug zuweisen"-Block (Zeilen 721-787) im Fahrer-Hinzufügen-Dialog wird nur noch angezeigt, wenn bereits manuell Fahrzeuge angelegt wurden (`existingVehicles.length > 0`). Wenn keine Fahrzeuge existieren, wird der Block komplett ausgeblendet.

Die Fahrzeug-Tabelle ist bereits leer — es sind keine Daten zu löschen.

## Technische Umsetzung

### Datei: `src/pages/dispatch/OperativeLage.tsx`

1. Den gesamten Fahrzeug-Block (Zeilen 721-787) in eine Bedingung wrappen: `{existingVehicles && existingVehicles.length > 0 && (...)}`.
2. Innerhalb nur die Select-Dropdown mit bestehenden Fahrzeugen + "Neues Fahrzeug anlegen" Option anzeigen (wie bisher).
3. Den Fallback-Block für "Noch kein Fahrzeug vorhanden" (Zeilen 765-786) entfernen, da der gesamte Block bei 0 Fahrzeugen ausgeblendet wird.
4. Die `handleAddDriver`-Logik für Fahrzeug-Erstellung bleibt erhalten, greift aber nur wenn ein Fahrzeug ausgewählt/angelegt wird.

