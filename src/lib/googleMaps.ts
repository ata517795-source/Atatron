/**
 * Google Maps JS API loader — entirely key-gated. Without
 * VITE_GOOGLE_MAPS_API_KEY the app never touches Google servers and
 * Street View mode falls back to photo-based exploration.
 */
import { Loader } from '@googlemaps/js-api-loader';

export const mapsKey: string | null =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || null;

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (!mapsKey) return Promise.reject(new Error('No Google Maps API key configured'));
  if (!loadPromise) {
    const loader = new Loader({ apiKey: mapsKey, version: 'weekly' });
    loadPromise = Promise.all([
      loader.importLibrary('maps'),
      loader.importLibrary('streetView'),
    ]).then(() => undefined);
  }
  return loadPromise;
}

/** Find the nearest outdoor panorama, widening the search radius step by step. */
export async function findPanorama(
  lat: number,
  lng: number,
  radii: number[] = [1_000, 10_000, 50_000, 200_000],
): Promise<google.maps.StreetViewPanoramaData | null> {
  const svc = new google.maps.StreetViewService();
  for (const radius of radii) {
    try {
      const { data } = await svc.getPanorama({
        location: { lat, lng },
        radius,
        source: google.maps.StreetViewSource.OUTDOOR,
        preference: google.maps.StreetViewPreference.NEAREST,
      });
      if (data?.location?.pano) return data;
    } catch {
      /* ZERO_RESULTS — widen and retry */
    }
  }
  return null;
}
