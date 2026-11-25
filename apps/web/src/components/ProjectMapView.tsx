import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, apiErrorMessage } from '../lib/api';
import { useGeolocation } from '../lib/useGeolocation';
import { useToast } from './feedback/Toast';

interface GeoPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  detail?: string;
}

const projectIcon = L.divIcon({
  className: 'sitesafi-map-pin',
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ea580c;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const photoIcon = L.divIcon({
  className: 'sitesafi-map-photo',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#059669;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const NAIROBI: [number, number] = [-1.286389, 36.817223];

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && !bounds.isValid()) return;
    if (bounds) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 17 });
    } else {
      map.setView(NAIROBI, 11);
    }
  }, [map, bounds]);
  return null;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Project map — project pin, authorized geofences and recent geotagged
 * photo evidence on an OpenStreetMap base. The project pin is set from the
 * device GPS (or typed coordinates in project settings).
 */
export default function ProjectMapView({ projectId, canEdit = false }: { projectId: string; canEdit?: boolean }): React.JSX.Element {
  const [project, setProject] = useState<any | null>(null);
  const [geofences, setGeofences] = useState<any[]>([]);
  const [photos, setPhotos] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { request: requestGeo } = useGeolocation();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [pj, gf, diaries] = await Promise.all([
          api.get<any>(`/api/v1/projects/${projectId}`).catch(() => null),
          api.get<any>(`/api/v1/projects/${projectId}/geofences`).catch(() => null),
          api.get<any>(`/api/v1/projects/${projectId}/site-diaries`).catch(() => null),
        ]);
        if (cancelled) return;
        setProject(pj?.data ?? pj ?? null);
        setGeofences(gf?.geofences ?? gf?.data ?? []);
        const pts: GeoPoint[] = [];
        for (const d of diaries?.data ?? []) {
          for (const p of d.photos ?? []) {
            const la = toNum(p.gps_latitude);
            const lo = toNum(p.gps_longitude);
            if (la != null && lo != null) {
              pts.push({
                id: p.id,
                latitude: la,
                longitude: lo,
                label: p.caption || 'Site photo',
                detail: p.taken_at ? new Date(p.taken_at).toLocaleDateString() : undefined,
              });
            }
          }
        }
        pts.sort((a, b) => a.id.localeCompare(b.id));
        setPhotos(pts.slice(-200));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load the project map.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const projectPin = useMemo(() => {
    const la = toNum(project?.map_latitude ?? project?.mapLatitude);
    const lo = toNum(project?.map_longitude ?? project?.mapLongitude);
    return la != null && lo != null ? ([la, lo] as [number, number]) : null;
  }, [project]);

  const bounds = useMemo(() => {
    const pts: [number, number][] = [];
    if (projectPin) pts.push(projectPin);
    for (const g of geofences) {
      const la = toNum(g.centerLatitude ?? g.center_latitude);
      const lo = toNum(g.centerLongitude ?? g.center_longitude);
      if (la != null && lo != null) pts.push([la, lo]);
    }
    for (const p of photos) pts.push([p.latitude, p.longitude]);
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [projectPin, geofences, photos]);

  const boundsCenter = bounds ? ([bounds.getCenter().lat, bounds.getCenter().lng] as [number, number]) : null;
  const center: [number, number] = projectPin ?? boundsCenter ?? NAIROBI;

  const setProjectLocation = async () => {
    setLocating(true);
    try {
      const fix = await requestGeo();
      if (!fix) {
        toast.error(new Error('no-fix'), 'Could not get a location fix. Check location permission and try again.');
        return;
      }
      await api.patch(`/api/v1/projects/${projectId}`, {
        mapLatitude: fix.latitude,
        mapLongitude: fix.longitude,
      });
      setProject({ ...project, map_latitude: String(fix.latitude), map_longitude: String(fix.longitude) });
      toast.success(`Project pin set (${fix.accuracy != null ? `±${Math.round(fix.accuracy)} m` : 'GPS fix'})`);
    } catch (err) {
      toast.error(err, apiErrorMessage(err, 'Could not save the project location.'));
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">Loading project map…</div>;
  }
  if (error) {
    return <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-red-600">{error}</div>;
  }

  const hasAnything = projectPin || geofences.length > 0 || photos.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Project map</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Site pin, authorized work zones and geotagged photo evidence.
            {photos.length > 0 ? ` ${photos.length} geotagged photo${photos.length === 1 ? '' : 's'} shown.` : ''}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => void setProjectLocation()}
            disabled={locating}
            className="px-3.5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg"
          >
            {locating ? 'Locating…' : projectPin ? 'Reset pin to my location' : 'Set site location'}
          </button>
        )}
      </div>

      {!hasAnything ? (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">No location data yet.</p>
          <p className="text-xs text-slate-500">Set the site pin with your device GPS, or add geofences under Site → Attendance.</p>
          {canEdit && (
            <button type="button" onClick={() => void setProjectLocation()} disabled={locating}
              className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg">
              {locating ? 'Locating…' : 'Set site location'}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm" style={{ height: 'min(60vh, 560px)' }}>
          <MapContainer
            center={center}
            zoom={projectPin ? 16 : 12}
            scrollWheelZoom
            className="h-full w-full"
          >
            <FitBounds bounds={bounds} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {projectPin && (
              <Marker position={projectPin} icon={projectIcon}>
                <Popup>
                  <strong>{project?.name ?? 'Project site'}</strong>
                  <br />{project?.location ?? ''}
                </Popup>
              </Marker>
            )}
            {geofences.map((g) => {
              const la = toNum(g.centerLatitude ?? g.center_latitude);
              const lo = toNum(g.centerLongitude ?? g.center_longitude);
              const r = toNum(g.radiusMeters ?? g.radius_meters) ?? 100;
              if (la == null || lo == null) return null;
              return (
                <Circle
                  key={g.id}
                  center={[la, lo]}
                  radius={r}
                  pathOptions={{ color: '#0284c7', weight: 1.5, fillColor: '#0284c7', fillOpacity: 0.12 }}
                >
                  <Popup>
                    <strong>{g.geofenceName ?? g.geofence_name ?? 'Work zone'}</strong>
                    <br />Radius {Math.round(r)} m
                  </Popup>
                </Circle>
              );
            })}
            {photos.map((p) => (
              <Marker key={p.id} position={[p.latitude, p.longitude]} icon={photoIcon}>
                <Popup>
                  <strong>{p.label}</strong>
                  {p.detail ? <><br />{p.detail}</> : null}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
