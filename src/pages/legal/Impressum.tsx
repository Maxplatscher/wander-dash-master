import { LegalLayout } from './LegalLayout';

export default function Impressum() {
  return (
    <LegalLayout title="Impressum">
      <p>
        Anbieter: DispoCenter (Betrieb durch den jeweiligen Mandanten bzw. den Softwarebetreiber).
      </p>
      <p>Anschrift, Vertretung, Register und USt-IdNr. werden vor Veröffentlichung ergänzt.</p>
      <p>Kontakt über den Disponenten der jeweiligen Firma.</p>
      <p>
        Dieser Text erfüllt nicht die Pflichtangaben nach § 5 DDG, solange die Platzhalter stehen.
      </p>
    </LegalLayout>
  );
}
