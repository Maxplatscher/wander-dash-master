import type { Libraries } from '@react-google-maps/api';

/** Ein gemeinsamer Loader-ID — sonst laden Komponenten Maps ohne Places und blockieren die Places-API. */
export const GOOGLE_MAPS_LOADER_ID = 'dispocenter-google-maps';

/** Places muss hier immer dabei sein (Onboarding-Autocomplete). */
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

export function getGoogleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
}
