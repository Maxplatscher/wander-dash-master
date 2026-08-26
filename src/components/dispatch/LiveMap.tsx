import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatch } from '@/lib/dispatch-context';
import { formatDateLabel } from '@/lib/date-input';
import {
  getCyanSquareMarkerIcon,
  getDarkMapOptions,
  getGoogleMapsApiKey,
  getGpsMarkerIcon,
  getOutlineSquareMarkerIcon,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
} from '@/lib/google-maps';
import {
  pickTourAnchor,
  shipmentCoordinates,
  type PositionStop,
  type TourAnchor,
} from '@/lib/tour-position';
import {
  formatGpsAge,
  gpsBadgeLabel,
  isUsableGpsFix,
  type GpsFix,
} from '@/lib/driver-gps';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

const containerStyle = { width: '100%', height: '100%' };

type TourPosition = {
  tourId: string;
  tourLabel: string;
  driverName: string | null;
  driverId: string | null;
  stopCount: number;
  confirmedCount: number;
  locatedStopCount: number;
  anchor: TourAnchor | null;
  gps: GpsFix | null;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function markerPosition(tour: TourPosition): { lat: number; lng: number } {
  if (tour.gps) return { lat: tour.gps.lat, lng: tour.gps.lng };
  if (tour.anchor) return tour.anchor.coordinates;
  throw new Error('Tour ohne darstellbare Position');
}

async function loadTourPositions(date: string): Promise<TourPosition[]> {
  const { data: tours, error: tourError } = await supabase
    .from('tour')
    .select('id, description, driver_id')
    .eq('date', date)
    .eq('is_active', true);

  if (tourError) throw new Error(`Touren konnten nicht geladen werden: ${tourError.message}`);
  if (!tours?.length) return [];

  const tourIds = tours.map((tour) => tour.id);
  const driverIds = [...new Set(tours.flatMap((tour) => (tour.driver_id ? [tour.driver_id] : [])))];

  const [driversResult, stopsResult, positionsResult] = await Promise.all([
    driverIds.length
      ? supabase.from('driver').select('id, name').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('tour_stop')
      .select('id, tour_id, shipment_id, stop_index, driver_completed, driver_completed_at')
      .in('tour_id', tourIds)
      .order('stop_index', { ascending: true }),
    driverIds.length
      ? supabase
          .from('driver_position')
          .select('driver_id, lat, lng, accuracy_m, recorded_at')
          .in('driver_id', driverIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResult.error) {
    throw new Error(`Fahrerdaten konnten nicht geladen werden: ${driversResult.error.message}`);
  }
  if (stopsResult.error) {
    throw new Error(`Stops konnten nicht geladen werden: ${stopsResult.error.message}`);
  }
  if (positionsResult.error) {
    throw new Error(`GPS-Positionen konnten nicht geladen werden: ${positionsResult.error.message}`);
  }

  const stopRows = stopsResult.data ?? [];
  const shipmentIds = [
    ...new Set(stopRows.flatMap((stop) => (stop.shipment_id ? [stop.shipment_id] : []))),
  ];

  const shipmentsResult = shipmentIds.length
    ? await supabase
        .from('shipment')
        .select('id, customer_name, name, delivery_address, location_x, location_y')
        .in('id', shipmentIds)
    : { data: [], error: null };

  if (shipmentsResult.error) {
    throw new Error(`Sendungsdaten konnten nicht geladen werden: ${shipmentsResult.error.message}`);
  }

  const drivers = new Map((driversResult.data ?? []).map((driver) => [driver.id, driver]));
  const shipments = new Map((shipmentsResult.data ?? []).map((shipment) => [shipment.id, shipment]));
  const gpsByDriver = new Map<string, GpsFix>();
  for (const row of positionsResult.data ?? []) {
    const fix: GpsFix = {
      lat: row.lat,
      lng: row.lng,
      accuracyM: row.accuracy_m,
      recordedAt: row.recorded_at,
    };
    if (isUsableGpsFix(fix)) gpsByDriver.set(row.driver_id, fix);
  }

  return tours.map((tour) => {
    const stops: PositionStop[] = stopRows
      .filter((stop) => stop.tour_id === tour.id)
      .map((stop, index) => {
        const shipment = stop.shipment_id ? shipments.get(stop.shipment_id) : null;
        return {
          id: stop.id,
          stopNumber: stop.stop_index ?? index + 1,
          confirmed: stop.driver_completed === true,
          confirmedAt: stop.driver_completed_at,
          customer: shipment?.customer_name ?? shipment?.name ?? 'Kunde nicht hinterlegt',
          address: shipment?.delivery_address ?? null,
          coordinates: shipment
            ? shipmentCoordinates(shipment.location_x, shipment.location_y)
            : null,
        };
      });

    const driver = tour.driver_id ? drivers.get(tour.driver_id) : null;

    return {
      tourId: tour.id,
      tourLabel: tour.description ?? `Tour ${tour.id.slice(0, 8)}`,
      driverName: driver?.name ?? null,
      driverId: tour.driver_id,
      stopCount: stops.length,
      confirmedCount: stops.filter((stop) => stop.confirmed).length,
      locatedStopCount: stops.filter((stop) => stop.coordinates !== null).length,
      anchor: pickTourAnchor(stops),
      gps: tour.driver_id ? gpsByDriver.get(tour.driver_id) ?? null : null,
    };
  });
}

interface LiveMapProps {
  fill?: boolean;
}

/**
 * Zeigt die letzte nachvollziehbare Lage einer Tour: eine frische GPS-Position des
 * Fahrers, sonst den letzten bestätigten bzw. nächsten geplanten Stop.
 * Veraltete GPS-Fixes und fehlende Koordinaten werden nicht als Live-Standort verkauft
 * (siehe `docs/KARTE_STANDORTQUELLE.md`).
 */
export function LiveMap({ fill = false }: LiveMapProps = {}) {
  const { selectedDate } = useDispatch();
  const date = formatLocalDate(selectedDate);
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const positionsQuery = useQuery({
    queryKey: ['tour-positions', date],
    queryFn: () => loadTourPositions(date),
    refetchInterval: 120_000,
  });
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((instance: google.maps.Map) => setMap(instance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const tours = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const located = useMemo(
    () =>
      tours.filter(
        (tour) => tour.gps !== null || tour.anchor !== null,
      ),
    [tours],
  );
  const unlocated = tours.filter((tour) => tour.gps === null && tour.anchor === null);
  const selected = located.find((tour) => tour.tourId === selectedTourId) ?? null;
  const gpsBadge = gpsBadgeLabel(tours.flatMap((tour) => (tour.gps ? [tour.gps] : [])));

  useEffect(() => {
    if (!map || located.length === 0) return;
    if (located.length === 1) {
      map.setCenter(markerPosition(located[0]));
      map.setZoom(12);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    located.forEach((tour) => bounds.extend(markerPosition(tour)));
    map.fitBounds(bounds, 48);
  }, [map, located]);

  const wrapperClass = fill
    ? 'flex h-full w-full flex-col overflow-hidden rounded-sm border border-hairline bg-[#101012]'
    : 'flex min-h-[420px] w-full flex-col overflow-hidden rounded-sm border border-hairline bg-[#101012]';

  const dateLabel = formatDateLabel(selectedDate, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

  const header = (
    <div className="shrink-0 border-b border-hairline px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-title">Tourposition</p>
          <h3 className="card-title mt-0.5">Fahrer-GPS oder letzter Stop</h3>
        </div>
        <span className="shrink-0 rounded-sm border border-hairline px-1.5 py-0.5 meta-text text-dim">
          {gpsBadge}
        </span>
      </div>
      <p className="meta-text mt-1">
        {dateLabel} · {tours.length} aktive {tours.length === 1 ? 'Tour' : 'Touren'} ·{' '}
        {located.length} mit Koordinaten
      </p>
    </div>
  );

  const unlocatedList = unlocated.length > 0 && (
    <div className="max-h-[42%] shrink-0 space-y-1.5 overflow-y-auto border-t border-hairline px-3 py-2.5">
      <p className="section-title">Ohne Koordinaten ({unlocated.length})</p>
      {unlocated.map((tour) => (
        <div key={tour.tourId} className="rounded-sm border border-hairline px-2 py-1.5">
          <p className="truncate text-[12.5px] text-foreground">
            {tour.driverName ?? 'Fahrer nicht zugeordnet'}
            <span className="text-dim"> · {tour.tourLabel}</span>
          </p>
          <p className="meta-text mt-0.5">
            {tour.stopCount === 0
              ? 'Tour ohne Stops — nichts zu verorten'
              : `${tour.confirmedCount}/${tour.stopCount} Stops bestätigt · Lieferadressen nicht in Koordinaten umgerechnet`}
          </p>
        </div>
      ))}
    </div>
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={wrapperClass}>
        {header}
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="meta-text text-center">
            VITE_GOOGLE_MAPS_API_KEY fehlt — Key in .env setzen und in Google Cloud per Referrer
            einschränken.
          </p>
        </div>
      </div>
    );
  }

  if (positionsQuery.isLoading) {
    return (
      <div className={wrapperClass}>
        {header}
        <div className="flex flex-1 items-center justify-center">
          <p className="meta-text">Tourpositionen werden geladen…</p>
        </div>
      </div>
    );
  }

  if (positionsQuery.isError) {
    return (
      <div className={wrapperClass}>
        {header}
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center">
          <p className="text-[12.5px] text-foreground">Tourpositionen konnten nicht geladen werden</p>
          <p className="meta-text">{(positionsQuery.error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className={wrapperClass}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
          <p className="text-[12.5px] text-foreground">Keine aktive Tour an diesem Tag</p>
          <p className="meta-text max-w-[42ch]">
            Für {dateLabel} ist keine aktive Tour disponiert. Sobald eine Tour angelegt ist,
            erscheint hier die Lage ihrer Stops.
          </p>
        </div>
      </div>
    );
  }

  if (located.length === 0) {
    return (
      <div className={wrapperClass}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
          <p className="text-[12.5px] text-foreground">Keine Position auf der Karte darstellbar</p>
          <p className="meta-text max-w-[46ch]">
            Zu den Lieferadressen der Sendungen sind keine Koordinaten hinterlegt — die Adressen
            wurden noch nicht geokodiert, und es liegt keine frische Fahrer-GPS-Position vor.
            Ohne Koordinaten kann die Karte keine Lage anzeigen. Die betroffenen Touren stehen unten.
          </p>
        </div>
        {unlocatedList}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={wrapperClass}>
        {header}
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="meta-text text-center">Die Karte konnte nicht geladen werden.</p>
        </div>
        {unlocatedList}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={wrapperClass}>
        {header}
        <div className="flex flex-1 items-center justify-center">
          <p className="meta-text">Karte wird geladen…</p>
        </div>
        {unlocatedList}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {header}
      <div className="min-h-[200px] flex-1">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={markerPosition(located[0])}
          zoom={10}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={getDarkMapOptions()}
        >
          {located.map((tour) => {
            const position = markerPosition(tour);
            const title = tour.gps
              ? `${tour.driverName ?? tour.tourLabel} · GPS ${formatGpsAge(tour.gps.recordedAt)}`
              : `${tour.driverName ?? tour.tourLabel} · ${
                  tour.anchor?.kind === 'confirmed'
                    ? 'letzter bestätigter Stop'
                    : 'nächster geplanter Stop'
                }`;
            return (
              <Fragment key={tour.tourId}>
                <Marker
                  position={position}
                  icon={
                    tour.gps
                      ? getGpsMarkerIcon()
                      : tour.anchor?.kind === 'confirmed'
                        ? getCyanSquareMarkerIcon()
                        : getOutlineSquareMarkerIcon()
                  }
                  onClick={() => setSelectedTourId(tour.tourId)}
                  title={title}
                />
                <OverlayView
                  position={position}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={() => ({ x: 10, y: -10 })}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTourId(tour.tourId)}
                    className="pointer-events-auto whitespace-nowrap rounded-sm border border-hairline px-1.5 py-0.5 text-[11.5px] text-foreground"
                    style={{ background: 'rgba(21, 21, 23, 0.92)' }}
                  >
                    {tour.driverName ?? tour.tourLabel}
                  </button>
                </OverlayView>
              </Fragment>
            );
          })}

          {selected && (
            <OverlayView
              position={markerPosition(selected)}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={() => ({ x: -80, y: -64 })}
            >
              <div
                className="min-w-[160px] max-w-[240px] rounded-sm border border-hairline px-2.5 py-2 text-[11.5px] shadow-none"
                style={{ background: 'rgba(21, 21, 23, 0.96)' }}
              >
                <p className="font-semibold text-foreground">
                  {selected.driverName ?? 'Fahrer nicht zugeordnet'}
                </p>
                <p className="mt-0.5 font-mono text-primary">{selected.tourLabel}</p>
                {selected.gps ? (
                  <p className="mt-1 text-muted-foreground">
                    GPS {formatGpsAge(selected.gps.recordedAt)}
                    {selected.gps.accuracyM != null
                      ? ` · ±${Math.round(selected.gps.accuracyM)} m`
                      : ''}
                  </p>
                ) : selected.anchor ? (
                  <>
                    <p className="mt-1 text-muted-foreground">
                      {selected.anchor.kind === 'confirmed'
                        ? `Stop ${selected.anchor.stop.stopNumber} bestätigt${
                            formatTime(selected.anchor.stop.confirmedAt)
                              ? ` um ${formatTime(selected.anchor.stop.confirmedAt)}`
                              : ''
                          }`
                        : `Stop ${selected.anchor.stop.stopNumber} disponiert, noch nicht bestätigt`}
                    </p>
                    <p className="mt-1 text-muted-foreground">{selected.anchor.stop.customer}</p>
                    {selected.anchor.stop.address && (
                      <p className="text-dim">{selected.anchor.stop.address}</p>
                    )}
                  </>
                ) : null}
                <p className="meta-text mt-1">
                  {selected.confirmedCount}/{selected.stopCount} Stops bestätigt
                  {selected.locatedStopCount < selected.stopCount &&
                    ` · ${selected.stopCount - selected.locatedStopCount} ohne Koordinaten`}
                </p>
                <button
                  type="button"
                  className="meta-text mt-1 text-dim underline"
                  onClick={() => setSelectedTourId(null)}
                >
                  Schließen
                </button>
              </div>
            </OverlayView>
          )}
        </GoogleMap>
      </div>

      <div className="shrink-0 border-t border-hairline px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 meta-text">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            Fahrer-GPS (mit Messalter)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 bg-primary" aria-hidden="true" />
            Letzter bestätigter Stop
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 border border-primary" aria-hidden="true" />
            Nächster geplanter Stop
          </span>
        </div>
      </div>

      {unlocatedList}
    </div>
  );
}
