import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function LegalDraftBanner() {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
      <p className="font-semibold">Entwurf — kein anwaltlich geprüfter Rechtstext.</p>
      <p className="mt-1 text-muted-foreground">
        Angaben und Formulierungen sind Platzhalter für den Piloten. Vor öffentlichem Betrieb
        finalisieren und einen AVV abschließen.
      </p>
    </div>
  );
}

export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">DispoCenter</p>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <LegalDraftBanner />
        <div className="space-y-4 text-sm leading-relaxed text-foreground">{children}</div>
        <p className="text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">
            Zur Anmeldung
          </Link>
        </p>
      </article>
    </div>
  );
}
