-- Periodischer IMAP-Abruf alle 15 Minuten, falls pg_net + pg_cron vorhanden sind.
-- Secret IMAP_CRON_SECRET muss als Edge-Secret gesetzt sein.
DO $$
DECLARE
  cron_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron fehlt — IMAP-Cron in der Dashboard-Schedule anlegen.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net fehlt — IMAP-Cron in der Dashboard-Schedule anlegen.';
    RETURN;
  END IF;

  cron_secret := current_setting('app.settings.imap_cron_secret', true);
  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE NOTICE 'Kein app.settings.imap_cron_secret — Edge Function fetch-imap manuell oder per Dashboard schedulen.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'fetch-imap-15m',
    '*/15 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := '%s/functions/v1/fetch-imap',
        headers := jsonb_build_object('x-cron-secret', %L, 'Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
      $cmd$,
      current_setting('app.settings.supabase_url', true),
      cron_secret
    )
  );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'IMAP-Cron nicht gesetzt: %', SQLERRM;
END;
$$;
