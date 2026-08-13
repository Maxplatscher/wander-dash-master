import { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { getGoogleMapsApiKey, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '@/lib/google-maps';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

const center = { lat: 51.1657, lng: 10.4515 };

const driverMarkers = [
  { name: 'Max M.', initials: 'MM', tourId: 'T-001', status: 'unterwegs', lat: 52.52, lng: 13.405 },
  { name: 'Lisa K.', initials: 'LK', tourId: 'T-002', status: 'unterwegs', lat: 48.1351, lng: 11.582 },
  { name: 'Tom B.', initials: 'TB', tourId: 'T-003', status: 'abgeschlossen', lat: 50.1109, lng: 8.6821 },
  { name: 'Sarah W.', initials: 'SW', tourId: 'T-005', status: 'geplant', lat: 53.5511, lng: 9.9937 },
];

const statusLabels: Record<string, string> = {
  unterwegs: '🟢 Unterwegs',
  abgeschlossen: '✅ Abgeschlossen',
  geplant: '⏳ Geplant',
};

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
  const [selected, setSelected] = useState<typeof driverMarkers[0] | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  const wrapperClass = fill ? 'w-full h-full' : 'aspect-[4/3]';

  if (!isLoaded) {
    return (
      <div className={`${wrapperClass} bg-muted flex items-center justify-center rounded-xl`}>
        <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
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
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: [
            { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#d4eef7' }] },
            { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#f0f4f0' }] },
          ],
        }}
      >
        {driverMarkers.map((d) => (
          <Marker
            key={d.tourId}
            position={{ lat: d.lat, lng: d.lng }}
            label={{ text: d.initials, color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
            onClick={() => setSelected(d)}
          />
        ))}

        {selected && (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="text-sm p-1">
              <p className="font-semibold">{selected.name}</p>
              <p className="text-xs text-muted-foreground">Tour {selected.tourId}</p>
              <p className="text-xs mt-1">{statusLabels[selected.status]}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
