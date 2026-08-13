import { Fragment, useCallback, useState } from 'react';
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from '@react-google-maps/api';
import {
  getCyanSquareMarkerIcon,
  getDarkMapOptions,
  getGoogleMapsApiKey,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
} from '@/lib/google-maps';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

const center = { lat: 51.1657, lng: 10.4515 };

const driverMarkers = [
  { name: 'Max M.', tourId: 'T-001', status: 'unterwegs', lat: 52.52, lng: 13.405 },
  { name: 'Lisa K.', tourId: 'T-002', status: 'unterwegs', lat: 48.1351, lng: 11.582 },
  { name: 'Tom B.', tourId: 'T-003', status: 'abgeschlossen', lat: 50.1109, lng: 8.6821 },
  { name: 'Sarah W.', tourId: 'T-005', status: 'geplant', lat: 53.5511, lng: 9.9937 },
];

const containerStyle = { width: '100%', height: '100%' };

interface LiveMapProps {
  fill?: boolean;
}

export function LiveMap({ fill = false }: LiveMapProps = {}) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [selected, setSelected] = useState<(typeof driverMarkers)[0] | null>(null);
  const [, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const wrapperClass = fill
    ? 'w-full h-full rounded-sm border border-hairline overflow-hidden bg-[#101012]'
    : 'aspect-[4/3] rounded-sm border border-hairline overflow-hidden bg-[#101012]';

  if (!isLoaded) {
    return (
      <div className={`${wrapperClass} flex items-center justify-center`}>
        <p className="meta-text">Karte wird geladen…</p>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`${wrapperClass} flex items-center justify-center p-4`}>
        <p className="meta-text text-center">
          VITE_GOOGLE_MAPS_API_KEY fehlt — Key in .env setzen und in Google Cloud per Referrer einschränken.
        </p>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={6}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={getDarkMapOptions()}
      >
        {driverMarkers.map((d) => (
          <Fragment key={d.tourId}>
            <Marker
              position={{ lat: d.lat, lng: d.lng }}
              icon={getCyanSquareMarkerIcon()}
              onClick={() => setSelected(d)}
              title={`${d.name} · ${d.tourId}`}
            />
            <OverlayView
              position={{ lat: d.lat, lng: d.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={() => ({ x: 10, y: -10 })}
            >
              <button
                type="button"
                onClick={() => setSelected(d)}
                className="pointer-events-auto whitespace-nowrap px-1.5 py-0.5 text-[11.5px] text-foreground rounded-sm border border-hairline"
                style={{ background: 'rgba(21, 21, 23, 0.92)' }}
              >
                {d.name} · {d.tourId}
              </button>
            </OverlayView>
          </Fragment>
        ))}

        {selected && (
          <OverlayView
            position={{ lat: selected.lat, lng: selected.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={() => ({ x: -60, y: -48 })}
          >
            <div
              className="rounded-sm border border-hairline px-2.5 py-2 text-[11.5px] shadow-none min-w-[120px]"
              style={{ background: 'rgba(21, 21, 23, 0.96)' }}
            >
              <p className="font-semibold text-foreground">{selected.name}</p>
              <p className="text-primary font-mono mt-0.5">{selected.tourId}</p>
              <p className="text-muted-foreground mt-1 capitalize">{selected.status}</p>
              <button
                type="button"
                className="meta-text text-dim mt-1 underline"
                onClick={() => setSelected(null)}
              >
                Schließen
              </button>
            </div>
          </OverlayView>
        )}
      </GoogleMap>
    </div>
  );
}
