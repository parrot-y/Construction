import { useCallback, useState } from 'react';

export interface GeoFix {
  latitude: number;
  longitude: number;
  /** Device-reported accuracy radius in metres (null when unavailable). */
  accuracy: number | null;
  capturedAt: string;
}

export type GeoStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'timeout';

interface GeolocationLike {
  getCurrentPosition: (
    success: (pos: { coords: { latitude: number; longitude: number; accuracy?: number } }) => void,
    error?: (err: { code?: number }) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ) => void;
}

function browserGeolocation(): GeolocationLike | null {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;
  return navigator.geolocation as unknown as GeolocationLike;
}

/**
 * One device fix. Resolves null on any failure — never throws. `status`
 * out-param reports why (denied / timeout / unavailable).
 */
export function requestGeoFix(
  onStatus?: (s: Exclude<GeoStatus, 'idle'>) => void,
): Promise<GeoFix | null> {
  const geo = browserGeolocation();
  if (!geo) {
    onStatus?.('unavailable');
    return Promise.resolve(null);
  }
  onStatus?.('requesting');
  return new Promise<GeoFix | null>((resolve) => {
    const done = (f: GeoFix | null, s: Exclude<GeoStatus, 'idle'>) => {
      onStatus?.(s);
      resolve(f);
    };
    geo.getCurrentPosition(
      (pos) => {
        const c = pos.coords;
        done(
          {
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy: typeof c.accuracy === 'number' && Number.isFinite(c.accuracy) ? c.accuracy : null,
            capturedAt: new Date().toISOString(),
          },
          'ready',
        );
      },
      (err) => {
        const code = err?.code;
        done(null, code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

/**
 * Shared device-location hook. Components call `request()` when the user
 * captures evidence (photo, clock-in, pin) so the coordinates describe the
 * moment of capture, not modal-open time.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [fix, setFix] = useState<GeoFix | null>(null);

  const request = useCallback((): Promise<GeoFix | null> => {
    return requestGeoFix(setStatus).then((f) => {
      if (f) setFix(f);
      return f;
    });
  }, []);

  return { status, fix, request };
}
