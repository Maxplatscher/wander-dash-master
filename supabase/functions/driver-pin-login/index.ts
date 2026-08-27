/**
 * Fahrer-Login mit Vorname + Nachname + PIN.
 *
 * Session: bestehender Auth-User über users.driver_id, sonst Schatten-User
 * `pin.{driverId}@drivers.dispocenter.invalid`. Session kommt über
 * admin.generateLink + verifyOtp — das Passwort des (optionalen) E-Mail-Logins
 * bleibt unverändert, damit bestehende Testfahrer über den Dispo-Tab weitergehen.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import { isValidLoginCode, loginNameKey } from "../_shared/driver-name.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const IP_SPRAY_MAX = 25;
const GENERIC_FAIL = "Name oder Code falsch.";
const LOCK_MSG = "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff.slice(0, 64);
  return "unknown";
}

function pinEmail(driverId: string): string {
  return `pin.${driverId}@drivers.dispocenter.invalid`;
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return `Pin-${btoa(raw).replace(/[+/=]/g, "").slice(0, 28)}!a1`;
}

async function logAttempt(
  admin: SupabaseClient,
  row: { name_normalized: string; ip: string; success: boolean; driver_id?: string | null },
) {
  await admin.from("driver_login_attempt").insert({
    name_normalized: row.name_normalized,
    ip: row.ip,
    success: row.success,
    driver_id: row.driver_id ?? null,
  });
}

async function readThrottle(admin: SupabaseClient, name: string, ip: string) {
  const { data } = await admin
    .from("driver_login_throttle")
    .select("failed_attempts, window_started_at, locked_until")
    .eq("name_normalized", name)
    .eq("ip", ip)
    .maybeSingle();
  return data;
}

async function ipSprayCount(admin: SupabaseClient, ip: string): Promise<number> {
  const since = new Date(Date.now() - LOCK_MS).toISOString();
  const { count } = await admin
    .from("driver_login_attempt")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("created_at", since);
  return count ?? 0;
}

async function bumpThrottle(admin: SupabaseClient, name: string, ip: string): Promise<boolean> {
  const now = new Date();
  const existing = await readThrottle(admin, name, ip);
  let failed = 1;
  let windowStarted = now.toISOString();
  if (existing) {
    const windowAge = now.getTime() - new Date(existing.window_started_at).getTime();
    if (windowAge < LOCK_MS) {
      failed = (existing.failed_attempts ?? 0) + 1;
      windowStarted = existing.window_started_at;
    }
  }
  const locked = failed >= MAX_FAILURES;
  await admin.from("driver_login_throttle").upsert(
    {
      name_normalized: name,
      ip,
      failed_attempts: failed,
      window_started_at: windowStarted,
      locked_until: locked ? new Date(now.getTime() + LOCK_MS).toISOString() : null,
    },
    { onConflict: "name_normalized,ip" },
  );
  return locked;
}

async function ensureDriverSession(
  admin: SupabaseClient,
  anon: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  driver: { id: string; company_id: string; name: string | null },
) {
  const { data: profile } = await admin
    .from("users")
    .select("id, email, company_id")
    .eq("driver_id", driver.id)
    .maybeSingle();

  let email = profile?.email ?? "";
  if (!email) {
    email = pinEmail(driver.id);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: driver.name ?? "", role: "driver" },
    });
    if (createError) {
      const lookup = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      );
      const payload = await lookup.json().catch(() => null);
      const existingId = payload?.users?.[0]?.id ?? payload?.id;
      if (!existingId) throw new Error(createError.message);
      await bindDriverUser(admin, existingId, email, driver);
    } else if (created.user?.id) {
      await bindDriverUser(admin, created.user.id, email, driver);
    }
  } else {
    await bindDriverUser(admin, profile!.id, email, driver);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;
  const tokenHash = link.properties?.hashed_token;
  if (!tokenHash) throw new Error("Session konnte nicht erzeugt werden.");

  const { data: otp, error: otpError } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpError) throw otpError;
  if (!otp.session) throw new Error("Keine Session vom Login.");
  return otp.session;
}

async function bindDriverUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
  driver: { id: string; company_id: string },
) {
  const { error: profileError } = await admin.from("users").upsert(
    {
      id: userId,
      email,
      company_id: driver.company_id,
      driver_id: driver.id,
      role: "driver",
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;
  await admin.from("user_roles").delete().eq("user_id", userId).neq("role", "driver");
  const { error: roleError } = await admin.from("user_roles").upsert(
    { user_id: userId, role: "driver" },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const firstName = typeof body.first_name === "string" ? body.first_name : "";
    const lastName = typeof body.last_name === "string" ? body.last_name : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const nameKey = loginNameKey(firstName, lastName);
    const ip = clientIp(req);

    if (!nameKey || !isValidLoginCode(code)) {
      return json({ error: GENERIC_FAIL }, 401);
    }

    const spray = await ipSprayCount(admin, ip);
    if (spray >= IP_SPRAY_MAX) {
      await logAttempt(admin, { name_normalized: nameKey, ip, success: false });
      return json({ error: LOCK_MSG, locked: true }, 429);
    }

    const throttle = await readThrottle(admin, nameKey, ip);
    if (throttle?.locked_until && new Date(throttle.locked_until).getTime() > Date.now()) {
      await logAttempt(admin, { name_normalized: nameKey, ip, success: false });
      return json({ error: LOCK_MSG, locked: true }, 429);
    }

    const { data: matchedRows, error: listError } = await admin.rpc(
      "drivers_by_normalized_name",
      { p_name: nameKey },
    );
    if (listError) throw listError;
    const nameMatches = (matchedRows ?? []) as {
      id: string;
      name: string | null;
      company_id: string;
    }[];

    const now = Date.now();
    const secretsByDriver = new Map<string, {
      code_hash: string;
      failed_attempts: number;
      locked_until: string | null;
    }>();
    if (nameMatches.length > 0) {
      const { data: secrets } = await admin
        .from("driver_login_secret")
        .select("driver_id, code_hash, failed_attempts, locked_until")
        .in("driver_id", nameMatches.map((d) => d.id));
      for (const s of secrets ?? []) {
        secretsByDriver.set(s.driver_id, s);
      }
    }

    const unlocked = nameMatches.filter((d) => {
      const secret = secretsByDriver.get(d.id);
      if (!secret) return false;
      if (secret.locked_until && new Date(secret.locked_until).getTime() > now) return false;
      return true;
    });

    const hits = unlocked.filter((d) => {
      const secret = secretsByDriver.get(d.id)!;
      return bcrypt.compareSync(code, secret.code_hash);
    });

    if (hits.length > 1) {
      const lockUntil = new Date(now + LOCK_MS).toISOString();
      for (const hit of hits) {
        await admin.from("driver_login_secret").update({
          failed_attempts: MAX_FAILURES,
          locked_until: lockUntil,
        }).eq("driver_id", hit.id);
      }
      await bumpThrottle(admin, nameKey, ip);
      await logAttempt(admin, { name_normalized: nameKey, ip, success: false, driver_id: hits[0].id });
      return json({ error: GENERIC_FAIL }, 401);
    }

    if (hits.length === 1) {
      const driver = hits[0];
      await admin.from("driver_login_secret").update({
        failed_attempts: 0,
        locked_until: null,
      }).eq("driver_id", driver.id);
      await admin.from("driver_login_throttle").upsert({
        name_normalized: nameKey,
        ip,
        failed_attempts: 0,
        window_started_at: new Date().toISOString(),
        locked_until: null,
      }, { onConflict: "name_normalized,ip" });
      await logAttempt(admin, {
        name_normalized: nameKey,
        ip,
        success: true,
        driver_id: driver.id,
      });

      const session = await ensureDriverSession(admin, anon, supabaseUrl, serviceKey, driver);
      return json({
        success: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
        user: session.user,
      });
    }

    const lockUntil = new Date(now + LOCK_MS).toISOString();
    for (const match of nameMatches) {
      const secret = secretsByDriver.get(match.id);
      if (!secret) continue;
      const nextFails = (secret.failed_attempts ?? 0) + 1;
      await admin.from("driver_login_secret").update({
        failed_attempts: nextFails,
        locked_until: nextFails >= MAX_FAILURES ? lockUntil : secret.locked_until,
      }).eq("driver_id", match.id);
    }

    const lockedNow = await bumpThrottle(admin, nameKey, ip);
    await logAttempt(admin, { name_normalized: nameKey, ip, success: false });
    if (lockedNow) return json({ error: LOCK_MSG, locked: true }, 429);
    const allNameLocked = nameMatches.length > 0 && unlocked.length === 0;
    if (allNameLocked) return json({ error: LOCK_MSG, locked: true }, 429);
    return json({ error: GENERIC_FAIL }, 401);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
