import type { Libraries } from '@react-google-maps/api';

/** Ein gemeinsamer Loader-ID — sonst laden Komponenten Maps ohne Places und blockieren die Places-API. */
export const GOOGLE_MAPS_LOADER_ID = 'dispocenter-google-maps';

/** Places muss hier immer dabei sein (Onboarding-Autocomplete). */
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

export function getGoogleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
}

/** Dunkles Schema passend zu #0d0d0f */
export const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#101012' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9a9aa4' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#26262b' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#151517' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b74' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#121814' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1b1b1e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#26262b' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9a9aa4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#222228' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#151517' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1014' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b74' }] },
];

export function getDarkMapOptions(
  overrides: google.maps.MapOptions = {},
): google.maps.MapOptions {
  return {
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
      position: typeof google !== 'undefined' ? google.maps.ControlPosition.RIGHT_BOTTOM : undefined,
    },
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    scrollwheel: false,
    gestureHandling: 'cooperative',
    styles: DARK_MAP_STYLES,
    backgroundColor: '#101012',
    ...overrides,
  };
}

/** 12px Cyan-Quadrat mit Soft-Ring (Symbol-Marker). Nur nach Maps-Load aufrufen. */
export function getCyanSquareMarkerIcon(): google.maps.Symbol {
  return {
    path: 'M -6,-6 L 6,-6 L 6,6 L -6,6 Z',
    fillColor: '#7ce8f5',
    fillOpacity: 1,
    strokeColor: 'rgba(124, 232, 245, 0.35)',
    strokeWeight: 3,
    scale: 1,
  };
}
