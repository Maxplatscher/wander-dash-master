import { LegalLayout } from './LegalLayout';

export default function Datenschutz() {
  return (
    <LegalLayout title="Datenschutz">
      <p>
        Verantwortliche Stelle ist die Firma, die DispoCenter nutzt. Hosting (Supabase) ist
        Auftragsverarbeitung — ein AVV ist hier nicht hinterlegt.
      </p>
      <p>
        Verarbeitet werden Konten (E-Mail, Rolle), Dispositionsdaten (Sendungen, Adressen, Touren)
        und optionale Geräte-Einwilligungen. Es gibt keine gespeicherte Live-GPS-Historie.
      </p>
      <p>
        Standort auf dem Gerät nur nach Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Widerruf:
        Einstellungen → Einwilligungen, Fahrer zusätzlich unter Meine Tour.
      </p>
      <p>
        Empfänger je nach Konfiguration: Supabase, Google Maps/Geocoding, Nominatim, Gemini, Serper.
        Keine Weitergabe zu Werbezwecken.
      </p>
    </LegalLayout>
  );
}
