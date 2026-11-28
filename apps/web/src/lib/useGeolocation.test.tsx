import { describe, expect, it, beforeEach } from 'vitest';
import { requestGeoFix, type GeoFix } from './useGeolocation';

function mockGeolocation(mode: 'success' | 'denied' | 'timeout' | 'missing') {
  if (mode === 'missing') {
    delete (navigator as { geolocation?: unknown }).geolocation;
    return;
  }
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: (
        ok: (pos: { coords: { latitude: number; longitude: number; accuracy?: number } }) => void,
        err?: (e: { code: number }) => void,
      ) => {
        if (mode === 'success') {
          ok({ coords: { latitude: -1.2921, longitude: 36.8219, accuracy: 8.4 } });
        } else {
          err?.({ code: mode === 'denied' ? 1 : 3 });
        }
      },
    },
    configurable: true,
  });
}

describe('requestGeoFix', () => {
  beforeEach(() => mockGeolocation('success'));

  it('returns device coordinates with accuracy', async () => {
    const statuses: string[] = [];
    const fix: GeoFix | null = await requestGeoFix((s) => statuses.push(s));
    expect(fix).not.toBeNull();
    expect(fix!.latitude).toBeCloseTo(-1.2921, 4);
    expect(fix!.longitude).toBeCloseTo(36.8219, 4);
    expect(fix!.accuracy).toBeCloseTo(8.4, 1);
    expect(fix!.capturedAt).toBeTruthy();
    expect(statuses).toEqual(['requesting', 'ready']);
  });

  it('resolves null and reports denied on permission refusal', async () => {
    mockGeolocation('denied');
    const statuses: string[] = [];
    const fix = await requestGeoFix((s) => statuses.push(s));
    expect(fix).toBeNull();
    expect(statuses).toContain('denied');
  });

  it('resolves null and reports timeout on timeout', async () => {
    mockGeolocation('timeout');
    const statuses: string[] = [];
    const fix = await requestGeoFix((s) => statuses.push(s));
    expect(fix).toBeNull();
    expect(statuses).toContain('timeout');
  });

  it('resolves null and reports unavailable without the API', async () => {
    mockGeolocation('missing');
    const statuses: string[] = [];
    const fix = await requestGeoFix((s) => statuses.push(s));
    expect(fix).toBeNull();
    expect(statuses).toEqual(['unavailable']);
  });
});
