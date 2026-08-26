import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

/**
 * End-to-End-Test des Fahrerablaufs gegen die echte Remote-Supabase-Instanz.
 *
 * Läuft nur über `npm run test:integration`. Ohne Zugangsdaten in der
 * gitignorierten `.env.test` überspringt sich die Suite selbst, damit CI und
 * Entwickler ohne Testaccount nicht rot laufen.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const DRIVER_EMAIL = process.env.E2E_DRIVER_EMAIL ?? "";
const DRIVER_PASSWORD = process.env.E2E_DRIVER_PASSWORD ?? "";
const EXPECTED_DRIVER_ID = process.env.E2E_DRIVER_ID ?? "";
const EXPECTED_STOP_COUNT = Number(process.env.E2E_DRIVER_TOUR_STOP_COUNT ?? "3");

const credentialsAvailable = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && DRIVER_EMAIL && DRIVER_PASSWORD && EXPECTED_DRIVER_ID,
);

// Eine UUID, die garantiert zu keinem eigenen Stop gehört – für die Negativprüfung.
const FOREIGN_STOP_ID = "00000000-0000-4000-8000-000000000000";

type Client = SupabaseClient<Database>;

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TOUR_DATE = process.env.E2E_DRIVER_TOUR_DATE || localDate(new Date());

/** Frischer Client ohne Session-Persistenz – garantiert keine Antwort aus einem Cache. */
async function signInAsDriver(): Promise<Client> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: DRIVER_EMAIL,
    password: DRIVER_PASSWORD,
  });
  if (error) throw new Error(`Fahrer-Login fehlgeschlagen: ${error.message}`);
  return client;
}

describe.skipIf(!credentialsAvailable)("Fahrer-Login und Tourablauf (Remote-Supabase)", () => {
  let driver: Client;
  let authUserId = "";
  let tourId = "";
  let completedStopId: string | null = null;

  beforeAll(async () => {
    driver = await signInAsDriver();
  });

  afterAll(async () => {
    if (completedStopId) {
      // Der Fahrer darf tour_stop bewusst nicht direkt schreiben, ein Reset mit
      // Fahrerrechten ist deshalb nicht möglich. Wiederholbar bleibt der Test
      // trotzdem, weil complete_my_tour_stop idempotent ist. Ein echter Reset
      // erfolgt mit Dispatcher-/Admin-Rechten:
      //   UPDATE public.tour_stop
      //      SET driver_completed = FALSE, driver_completed_at = NULL
      //    WHERE id = '<stop-id>';
      const { error } = await driver
        .from("tour_stop")
        .update({ driver_completed: false, driver_completed_at: null })
        .eq("id", completedStopId);
      const { data: afterReset } = await driver
        .from("tour_stop")
        .select("driver_completed")
        .eq("id", completedStopId)
        .maybeSingle();
      if (error || afterReset?.driver_completed) {
        console.warn(
          `[cleanup] Stop ${completedStopId} bleibt abgeschlossen – Reset erfordert Dispatcher-/Admin-Rechte. ` +
            "SQL: UPDATE public.tour_stop SET driver_completed = FALSE, driver_completed_at = NULL WHERE id = '<stop-id>';",
        );
      }
    }
    await driver?.auth.signOut();
  });

  it("meldet den Fahrer an und liefert eine Session mit auth.uid()", async () => {
    const { data, error } = await driver.auth.getSession();
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    expect(data.session?.user.id).toBeTruthy();

    const { data: userData, error: userError } = await driver.auth.getUser();
    expect(userError).toBeNull();
    expect(userData.user?.id).toBe(data.session?.user.id);
    authUserId = userData.user?.id ?? "";
    expect(authUserId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("weist dem Konto die Rolle driver zu", async () => {
    const { data, error } = await driver
      .from("user_roles")
      .select("role")
      .eq("user_id", authUserId);

    expect(error).toBeNull();
    const roles = data?.map((row) => row.role) ?? [];
    expect(roles).toContain("driver");
    expect(roles).not.toContain("dispatcher");
    expect(roles).not.toContain("admin");
  });

  it("löst über public.users.driver_id den erwarteten Fahrer auf", async () => {
    const { data: profile, error: profileError } = await driver
      .from("users")
      .select("id, driver_id, company_id, is_active")
      .eq("id", authUserId)
      .maybeSingle();

    expect(profileError).toBeNull();
    expect(profile?.driver_id).toBe(EXPECTED_DRIVER_ID);
    expect(profile?.is_active).toBe(true);
    expect(profile?.company_id).toBeTruthy();

    const { data: driverRow, error: driverError } = await driver
      .from("driver")
      .select("id, name, company_id")
      .eq("id", EXPECTED_DRIVER_ID)
      .maybeSingle();

    expect(driverError).toBeNull();
    expect(driverRow?.id).toBe(EXPECTED_DRIVER_ID);
    expect(driverRow?.company_id).toBe(profile?.company_id);
  });

  it("lädt die aktive Tour des Fahrers für den Testtag", async () => {
    const { data: tour, error } = await driver
      .from("tour")
      .select("id, date, description, driver_id, is_active")
      .eq("driver_id", EXPECTED_DRIVER_ID)
      .eq("date", TOUR_DATE)
      .eq("is_active", true)
      .maybeSingle();

    expect(error).toBeNull();
    expect(tour, `Keine aktive Tour für ${TOUR_DATE} gefunden`).not.toBeNull();
    expect(tour?.driver_id).toBe(EXPECTED_DRIVER_ID);
    expect(tour?.date).toBe(TOUR_DATE);
    tourId = tour?.id ?? "";
  });

  it("liefert die Stops in korrekter Reihenfolge inklusive Shipment-Daten", async () => {
    const { data: stops, error } = await driver
      .from("tour_stop")
      .select("id, stop_index, shipment_id, driver_completed")
      .eq("tour_id", tourId)
      .order("stop_index", { ascending: true });

    expect(error).toBeNull();
    expect(stops).toHaveLength(EXPECTED_STOP_COUNT);

    const indices = (stops ?? []).map((stop) => stop.stop_index);
    expect(indices).toEqual([...indices].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(new Set(indices).size).toBe(indices.length);

    const shipmentIds = (stops ?? []).flatMap((stop) => (stop.shipment_id ? [stop.shipment_id] : []));
    expect(shipmentIds).toHaveLength(EXPECTED_STOP_COUNT);

    const { data: shipments, error: shipmentError } = await driver
      .from("shipment")
      .select("id, customer_name, delivery_address, weight_kg, window_start, window_end")
      .in("id", shipmentIds);

    expect(shipmentError).toBeNull();
    expect(shipments).toHaveLength(EXPECTED_STOP_COUNT);

    for (const shipment of shipments ?? []) {
      expect(shipment.delivery_address, `Adresse fehlt für ${shipment.id}`).toBeTruthy();
      expect(typeof shipment.weight_kg).toBe("number");
      expect(shipment.weight_kg ?? 0).toBeGreaterThan(0);
      expect(shipment.window_start, `Zeitfensterstart fehlt für ${shipment.id}`).toBeTruthy();
      expect(shipment.window_end, `Zeitfensterende fehlt für ${shipment.id}`).toBeTruthy();
      expect(new Date(shipment.window_end ?? "").getTime()).toBeGreaterThan(
        new Date(shipment.window_start ?? "").getTime(),
      );
    }
  });

  it("schließt einen Stop per RPC ab und der Abschluss bleibt dauerhaft gesetzt", async () => {
    const { data: stops } = await driver
      .from("tour_stop")
      .select("id, stop_index, driver_completed")
      .eq("tour_id", tourId)
      .order("stop_index", { ascending: true });

    // Auf frischen Testdaten trifft es den ersten offenen Stop und prüft damit den
    // echten Übergang offen -> erledigt. Ist aus einem früheren Lauf noch ein Stop
    // abgeschlossen, wird genau dieser wiederverwendet: die RPC ist idempotent und
    // der Testlauf frisst sich so nicht Stop für Stop durch die Tour.
    const target = (stops ?? []).find((stop) => stop.driver_completed === true) ?? stops?.[0];
    expect(target?.id).toBeTruthy();
    const stopId = target!.id;

    const { data: rpcResult, error: rpcError } = await driver.rpc("complete_my_tour_stop", {
      p_tour_stop_id: stopId,
    });

    expect(rpcError).toBeNull();
    expect(rpcResult).toHaveLength(1);
    expect(rpcResult?.[0].id).toBe(stopId);
    expect(rpcResult?.[0].driver_completed).toBe(true);
    expect(rpcResult?.[0].driver_completed_at).toBeTruthy();
    completedStopId = stopId;

    // Frischer Client mit eigener Session – der Abschluss muss aus der Datenbank
    // kommen und nicht aus einem lokalen Zustand des ersten Clients.
    const secondClient = await signInAsDriver();
    const { data: reloaded, error: reloadError } = await secondClient
      .from("tour_stop")
      .select("id, driver_completed, driver_completed_at")
      .eq("id", stopId)
      .maybeSingle();
    await secondClient.auth.signOut();

    expect(reloadError).toBeNull();
    expect(reloaded?.driver_completed).toBe(true);
    expect(reloaded?.driver_completed_at).toBeTruthy();
  });

  it("verweigert den Abschluss eines fremden Stops", async () => {
    const { data, error } = await driver.rpc("complete_my_tour_stop", {
      p_tour_stop_id: FOREIGN_STOP_ID,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("zeigt dem Fahrer ausschließlich eigene Touren und Stops", async () => {
    const { data: tours, error: tourError } = await driver.from("tour").select("id, driver_id");
    expect(tourError).toBeNull();
    expect(tours?.length ?? 0).toBeGreaterThan(0);
    for (const tour of tours ?? []) {
      expect(tour.driver_id).toBe(EXPECTED_DRIVER_ID);
    }

    const { data: foreignTours, error: foreignError } = await driver
      .from("tour")
      .select("id")
      .neq("driver_id", EXPECTED_DRIVER_ID);
    expect(foreignError).toBeNull();
    expect(foreignTours).toEqual([]);

    const ownTourIds = new Set((tours ?? []).map((tour) => tour.id));
    const { data: allStops, error: stopError } = await driver
      .from("tour_stop")
      .select("id, tour_id");
    expect(stopError).toBeNull();
    for (const stop of allStops ?? []) {
      expect(ownTourIds.has(stop.tour_id)).toBe(true);
    }
  });

  it("lässt den Fahrer tour_stop nicht direkt schreiben", async () => {
    const { data: stops } = await driver
      .from("tour_stop")
      .select("id, driver_completed")
      .eq("tour_id", tourId)
      .order("stop_index", { ascending: true });
    const stop = stops?.[0];
    expect(stop?.id).toBeTruthy();
    const before = stop!.driver_completed;

    const { error } = await driver
      .from("tour_stop")
      .update({ driver_completed: !before })
      .eq("id", stop!.id)
      .select("id");

    const { data: after } = await driver
      .from("tour_stop")
      .select("driver_completed")
      .eq("id", stop!.id)
      .maybeSingle();

    // Entweder blockt die Policy hart (Fehler) oder still (0 betroffene Zeilen) –
    // in beiden Fällen darf sich der gespeicherte Zustand nicht ändern.
    expect(after?.driver_completed ?? null).toBe(before ?? null);
    if (error) expect(error.code).toBeTruthy();
  });
});
