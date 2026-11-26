import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useGeolocation, type GeoStatus } from '../../lib/useGeolocation';
import { compressUploadFile } from '../../services/offline-sync';
import { PortalLinkNotice, PortalExpiryBanner, portalErrorKind, type PortalLinkKind } from './PortalErrorState';
import { formatDate } from '../../ui';

interface FieldPhoto {
  id: string;
  caption: string | null;
  takenAt: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  url: string;
}

interface FieldContext {
  project: { id: string; name: string; code: string; status: string };
  stakeholderName: string;
  stakeholderRole: string | null;
  entryDate: string;
  diary: { id: string; weather: string; siteStatus: string } | null;
  photos: FieldPhoto[];
}

const WEATHER_OPTIONS: { value: string; label: string }[] = [
  { value: 'SUNNY_CLEAR', label: 'Sunny' },
  { value: 'CLOUDY', label: 'Cloudy' },
  { value: 'LIGHT_RAIN', label: 'Light rain' },
  { value: 'HEAVY_RAIN', label: 'Heavy rain' },
  { value: 'RAIN_DELAY', label: 'Rain delay' },
  { value: 'DUST_STORM', label: 'Dust storm' },
  { value: 'HIGH_WIND', label: 'High wind' },
  { value: 'HIGH_TEMPERATURE', label: 'High temp' },
  { value: 'LOW_TEMPERATURE', label: 'Low temp' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'OPERATIONAL', label: 'Working' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'STOPPED', label: 'Stopped' },
];

const GEO_STATUS_TEXT: Record<GeoStatus, string> = {
  idle: '',
  requesting: 'Getting GPS…',
  ready: 'GPS locked',
  denied: 'Location off — photo saves without a pin',
  unavailable: 'No GPS on this device — photo saves without a pin',
  timeout: 'GPS timed out — photo saves without a pin',
};

export default function FieldPortalView({ token }: { token: string }): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<PortalLinkKind>('error');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ctx, setCtx] = useState<FieldContext | null>(null);
  const [caption, setCaption] = useState('');
  const [weather, setWeather] = useState('');
  const [siteStatus, setSiteStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { status: geoStatus, fix, request: requestGeo } = useGeolocation();

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setErrorKind('link');
      setErrorMessage('Missing portal token.');
      return;
    }
    try {
      const res = await api.get<{ data: FieldContext }>(`/api/v1/portals/field/${token}`);
      setCtx(res.data);
      setErrorKind('error');
      setErrorMessage(null);
    } catch (e: any) {
      setErrorKind(portalErrorKind(e));
      setErrorMessage(e?.message || null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const needsDayFiling = !!ctx && !ctx.diary;

  const onCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ctx) return;

    if (needsDayFiling && (!weather || !siteStatus)) {
      setNotice({ kind: 'error', text: 'Pick today\'s weather and site status first — they file the day\'s diary.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const geo = await requestGeo();
      const upload = await compressUploadFile(file);
      const fd = new FormData();
      fd.append('file', upload, upload.name || 'site-photo.jpg');
      const up = await api.post<{ data: { storageKey: string } }>(
        `/api/v1/portals/field/${token}/uploads`,
        fd,
      );
      const storageKey = up.data.storageKey;

      await api.post(`/api/v1/portals/field/${token}/photos`, {
        storageKey,
        caption: caption.trim() || null,
        takenAt: new Date().toISOString(),
        gpsLatitude: geo?.latitude ?? null,
        gpsLongitude: geo?.longitude ?? null,
        gpsAccuracyMeters: geo?.accuracy ?? null,
        ...(needsDayFiling ? { weather, siteStatus } : {}),
      });

      setCaption('');
      setNotice({
        kind: 'ok',
        text: needsDayFiling
          ? 'Photo saved — today\'s site diary filed.'
          : 'Photo added to today\'s site diary.',
      });
      await load();
    } catch (err: any) {
      setNotice({
        kind: 'error',
        text: err?.message || 'Could not save the photo. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto p-6 text-center text-sm text-slate-500" data-testid="field-portal-loading">
        Loading your site camera…
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="w-full max-w-md mx-auto p-6" data-testid="field-portal-error">
        <PortalLinkNotice kind={errorKind} message={errorMessage ?? undefined} onRetry={() => { setLoading(true); void load(); }} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4 pb-10" data-testid="field-portal-view">
      <PortalExpiryBanner />

      <header className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          Site camera
        </span>
        <h1 className="text-xl font-bold mt-2 text-slate-900">{ctx.project.name}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {ctx.stakeholderName}
          {ctx.stakeholderRole ? ` • ${ctx.stakeholderRole}` : ''} • {formatDate(ctx.entryDate)}
        </p>
        <p className="text-[11px] mt-2">
          {ctx.diary ? (
            <span className="text-emerald-700 font-semibold">Today&apos;s diary filed — {ctx.photos.length} photo{ctx.photos.length === 1 ? '' : 's'}</span>
          ) : (
            <span className="text-amber-700 font-semibold">First photo of the day — it files today&apos;s site diary</span>
          )}
        </p>
      </header>

      {needsDayFiling && (
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3" data-testid="field-day-filing">
          <p className="text-xs font-bold text-slate-600">Today on site</p>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Weather</p>
            <div className="flex flex-wrap gap-1.5">
              {WEATHER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={weather === o.value}
                  onClick={() => setWeather(o.value)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    weather === o.value
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Site status</p>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={siteStatus === o.value}
                  onClick={() => setSiteStatus(o.value)}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    siteStatus === o.value
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="field-camera-input"
          onChange={(e) => void onCapture(e)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          data-testid="field-capture-btn"
          className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-base flex items-center justify-center gap-2 transition"
        >
          {busy ? 'Saving…' : 'Take site photo'}
        </button>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={255}
          placeholder="Caption (optional) — e.g. Foundation pour, grid 4-C"
          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          data-testid="field-caption-input"
        />
        <p className="text-[11px] text-slate-500" data-testid="field-gps-status">
          {GEO_STATUS_TEXT[geoStatus] || 'Location is captured when you take the photo.'}
          {fix?.accuracy != null && geoStatus === 'ready' ? ` (±${Math.round(fix.accuracy)} m)` : ''}
        </p>
        {notice && (
          <p
            role="status"
            className={`text-xs font-semibold px-3 py-2 rounded-lg ${
              notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
            data-testid="field-notice"
          >
            {notice.text}
          </p>
        )}
      </section>

      {ctx.photos.length > 0 && (
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-600 mb-3">Today&apos;s photos ({ctx.photos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {ctx.photos.map((p) => (
              <figure key={p.id} className="space-y-1">
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img
                    src={p.url}
                    alt={p.caption || 'Site photo'}
                    className="w-full h-24 object-cover rounded-lg border border-slate-200"
                    loading="lazy"
                  />
                </a>
                <figcaption className="text-[10px] text-slate-500 leading-tight">
                  {p.caption || formatDate(p.takenAt)}
                  {p.gpsAccuracyMeters != null ? ` • ±${Math.round(p.gpsAccuracyMeters)}m` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
