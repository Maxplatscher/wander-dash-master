# Zwei Browserprofile für den Piloten

Eine Auth-Session gilt für alle Tabs derselben Origin (`localhost:8080` bzw. die Host-Domain). Wer den Fahrer anmeldet, überschreibt den Dispatcher in jedem offenen Tab.

**Für den Testkunden und intern:**

1. Profil **Disposition** — nur Dispatcher-Login, Kontrollzentrale, Planung, Karte.
2. Profil **Fahrer** — nur Fahrer-Login, Meine Tour, Standort teilen, Stop abschließen.

In Chrome/Edge: Profil hinzufügen, oder ein Fenster im Gastmodus nur für den Fahrer. In Safari: ein privates Fenster für die zweite Rolle.

Nicht in demselben Profil zwischen den Rollen hin- und herwechseln, solange die App keine getrennten Sessions hat.
