import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readConsent, requestDeviceLocation, writeConsent, detectDeviceOs } from "@/lib/consent";

const SHARE_KEY = "dc_driver_gps_share";
const MIN_REPORT_GAP_MS = 30_000;

function readShareIntent(): boolean {
  try {
    return localStorage.getItem(SHARE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeShareIntent(on: boolean) {
  try {
    if (on) localStorage.setItem(SHARE_KEY, "1");
    else localStorage.removeItem(SHARE_KEY);
  } catch {
    // ignore
  }
}

export function useDriverGpsShare(tourId: string | null, enabled: boolean) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const lastSentRef = useRef(0);
  const tourIdRef = useRef(tourId);
  tourIdRef.current = tourId;

  const report = useCallback(async (lat: number, lng: number, accuracy: number | null) => {
    const now = Date.now();
    if (now - lastSentRef.current < MIN_REPORT_GAP_MS) return;
    const { error: rpcError } = await supabase.rpc("report_my_position", {
      p_lat: lat,
      p_lng: lng,
      p_accuracy_m: accuracy,
      p_tour_id: tourIdRef.current,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    lastSentRef.current = now;
    setError(null);
    setLastAt(new Date().toISOString());
  }, []);

  const start = useCallback(async () => {
    const existing = readConsent();
    writeConsent({
      time: existing?.time ?? true,
      location: true,
      deliveryFolder: existing?.deliveryFolder ?? false,
      os: existing?.os ?? detectDeviceOs(),
    });
    const result = await requestDeviceLocation();
    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }
    writeShareIntent(true);
    setSharing(true);
    await report(result.coords.lat, result.coords.lng, null);
    toast.success("Standort wird mit der Disposition geteilt");
  }, [report]);

  const stop = useCallback(() => {
    writeShareIntent(false);
    setSharing(false);
    toast.message("Standortfreigabe beendet");
  }, []);

  useEffect(() => {
    if (!enabled || !tourId) return;
    if (readShareIntent()) setSharing(true);
  }, [enabled, tourId]);

  useEffect(() => {
    if (!sharing || !enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        void report(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null);
      },
      (err) => {
        setError(err.message || "Standort konnte nicht ermittelt werden.");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharing, enabled, report]);

  return { sharing, error, lastAt, start, stop };
}
