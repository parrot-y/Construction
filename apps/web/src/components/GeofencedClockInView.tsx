import React, { useEffect, useState} from 'react';
import { queueOfflineMutation} from '../services/offline-sync';

export interface GeofenceItem {
  id: string;
  geofenceName: string;
  centerLatitude: string;
  centerLongitude: string;
  radiusMeters: string;
  isActive: boolean;
  createdAt?: string;
}

export interface WorkerClockEventItem {
  id: string;
  workerName: string;
  workerCode: string;
  tradeCategory?: string;
  clockType: 'CLOCK_IN' | 'CLOCK_OUT';
  eventTimestamp: string;
  calculatedDistanceMeters: string;
  verificationStatus: 'WITHIN_GEOFENCE' | 'OUTSIDE_GEOFENCE_FLAGGED';
  photoSelfieUrl?: string | null;
}

interface GeofencedClockInViewProps {
  projectId?: string;
  projectName?: string;
  geofences?: GeofenceItem[];
  clockEvents?: WorkerClockEventItem[];
  onRecordClockIn?: (data: any) => Promise<any>;
  onCreateGeofence?: (data: any) => Promise<any>;
}

interface SiteLaborerOption {
  id: string;
  fullName: string;
  workerCode: string;
  tradeCategory?: string | null;
}

export const GeofencedClockInView: React.FC<GeofencedClockInViewProps> = ({
  projectId = '',
  projectName = 'Upper Hill Commercial Tower',
  geofences: initialGeofences,
  clockEvents: initialEvents,
  onRecordClockIn,
  onCreateGeofence,
}) => {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);
  const [laborers, setLaborers] = useState<SiteLaborerOption[]>([]);
  const [selectedLaborerId, setSelectedLaborerId] = useState<string>('');

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const [geoRes, evtRes, labRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/geofences`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/clock-events`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/laborers`, { credentials: 'include'}),
      ]);
      if (geoRes.ok) {
        const gj = await geoRes.json();
        const list = (gj.geofences || []) as GeofenceItem[];
        setGeofences(list);
}
      if (evtRes.ok) {
        const ej = await evtRes.json();
        const list = (ej.events || []) as WorkerClockEventItem[];
        setClockEvents(list);
}
      if (labRes.ok) {
        const lj = await labRes.json();
        const list = (lj.laborers || lj.data || []) as any[];
        const mapped: SiteLaborerOption[] = list.map((l) => ({
          id: l.id,
          fullName: l.fullName ?? l.full_name ?? '',
          workerCode: l.workerCode ?? l.worker_code ?? '',
          tradeCategory: l.tradeCategory ?? l.trade_category ?? null,
}));
        setLaborers(mapped);
        setSelectedLaborerId((prev) => prev || mapped[0]?.id || '');
}
} catch { /* keep demo */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const [geofences, setGeofences] = useState<GeofenceItem[]>(
    initialGeofences || [
      {
        id: 'geo-01',
        geofenceName: 'Site Main Gate & Perimeter Compound',
        centerLatitude: '-1.292100',
        centerLongitude: '36.821900',
        radiusMeters: '150.00',
        isActive: true,
},
    ]
);

  const [clockEvents, setClockEvents] = useState<WorkerClockEventItem[]>(
    initialEvents || [
      {
        id: 'clk-01',
        workerName: 'Juma Otieno Ochieng',
        workerCode: 'WKR-102',
        tradeCategory: 'MASON',
        clockType: 'CLOCK_IN',
        eventTimestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        calculatedDistanceMeters: '14.20',
        verificationStatus: 'WITHIN_GEOFENCE',
        photoSelfieUrl: 'https://storage.example.com/selfies/wkr102_in.jpg',
},
      {
        id: 'clk-02',
        workerName: 'Dennis Kiprono',
        workerCode: 'WKR-108',
        tradeCategory: 'STEEL_FIXER',
        clockType: 'CLOCK_IN',
        eventTimestamp: new Date(Date.now() - 3600000 * 2.8).toISOString(),
        calculatedDistanceMeters: '1840.50',
        verificationStatus: 'OUTSIDE_GEOFENCE_FLAGGED',
        photoSelfieUrl: 'https://storage.example.com/selfies/wkr108_flag.jpg',
},
      {
        id: 'clk-03',
        workerName: 'Francis Mwangi',
        workerCode: 'WKR-115',
        tradeCategory: 'CARPENTER',
        clockType: 'CLOCK_IN',
        eventTimestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
        calculatedDistanceMeters: '42.80',
        verificationStatus: 'WITHIN_GEOFENCE',
},
    ]
);

  // Clock In Simulator State
  const [selectedWorker, setSelectedWorker] = useState('');
  const [clockType, setClockType] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [capturedLat, setCapturedLat] = useState('');
  const [capturedLng, setCapturedLng] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Geofence Modal State
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [geoName, setGeoName] = useState('Tower Footprint & Hoarding Zone');
  const [geoLat, setGeoLat] = useState('-1.292100');
  const [geoLng, setGeoLng] = useState('36.821900');
  const [geoRadius, setGeoRadius] = useState('150.00');

  const activeGeofence = geofences.find((g) => g.isActive) || geofences[0];

  // Haversine calculation helper for preview
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

  const previewDistance = activeGeofence
    ? calculateDistance(
        parseFloat(activeGeofence.centerLatitude),
        parseFloat(activeGeofence.centerLongitude),
        parseFloat(capturedLat) || 0,
        parseFloat(capturedLng) || 0
)
    : 0;

  const isWithinRadius = activeGeofence ? previewDistance<= parseFloat(activeGeofence.radiusMeters) : false;

  const setLocationPreset = (preset: 'GATE' | 'PERIMETER' | 'OFFSITE') => {
    if (preset === 'GATE') {
      setCapturedLat('-1.292120');
      setCapturedLng('36.821910');
} else if (preset === 'PERIMETER') {
      setCapturedLat('-1.292900');
      setCapturedLng('36.822300');
} else {
      setCapturedLat('-1.312000');
      setCapturedLng('36.835000');
}
};

  const handleClockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    try {
      const payload = {
        laborerId: selectedLaborerId,
        clockType,
        capturedLatitude: capturedLat,
        capturedLongitude: capturedLng,
        photoSelfieUrl: selfieUrl,
};

      let dist = previewDistance.toFixed(2);
      let status = isWithinRadius ? 'WITHIN_GEOFENCE' : 'OUTSIDE_GEOFENCE_FLAGGED';

      if (isOffline) {
        await queueOfflineMutation(projectName || 'project-site', `/api/v1/projects/${isLive ? projectId : 'active'}/clock-in`, payload);
} else if (isLive) {
        if (!selectedLaborerId) {
          throw new Error('No registered site laborer selected — register laborers first.');
}
        const res = await fetch(`/api/v1/projects/${projectId}/clock-in`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            laborerId: selectedLaborerId,
            clockType,
            capturedLatitude: capturedLat,
            capturedLongitude: capturedLng,
            photoSelfieUrl: selfieUrl || null,
            deviceUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
}),
});
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.message || `Clock-in failed (${res.status})`);
}
        const created = await res.json();
        dist = created.calculatedDistanceMeters ?? dist;
        status = created.verificationStatus ?? status;
        await reload();
} else if (onRecordClockIn) {
        await onRecordClockIn(payload);
}

      if (!isLive) {
        const newEvent: WorkerClockEventItem = {
          id: `clk-${Date.now()}`,
          workerName: selectedWorker.split(' (')[0] || selectedWorker,
          workerCode: selectedWorker.split('(')[1]?.replace(')', '') || 'WKR-NEW',
          tradeCategory: 'ARTISAN',
          clockType,
          eventTimestamp: new Date().toISOString(),
          calculatedDistanceMeters: dist,
          verificationStatus: status as WorkerClockEventItem['verificationStatus'],
          photoSelfieUrl: selfieUrl,
};
        setClockEvents([newEvent, ...clockEvents]);
}
      const offlineSuffix = isOffline ? ' (Stored locally in IndexedDB offline queue)' : '';
      setFeedback(
        status === 'WITHIN_GEOFENCE'
          ? ` Verified On-Site Attendance: ${selectedWorker} clocked in at ${dist}m from centroid.${offlineSuffix}`
          : ` Off-Site Warning Flagged: ${selectedWorker} is ${dist}m away (exceeds ${activeGeofence?.radiusMeters}m radius).${offlineSuffix}`
);
} catch (err: any) {
      setFeedback(`Error: ${err.message}`);
} finally {
      setIsSubmitting(false);
}
};

  const handleCreateGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLive) {
        const res = await fetch(`/api/v1/projects/${projectId}/geofences`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            geofenceName: geoName,
            centerLatitude: geoLat,
            centerLongitude: geoLng,
            radiusMeters: geoRadius,
}),
});
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.message || `Geofence save failed (${res.status})`);
}
        await reload();
        setShowGeofenceModal(false);
        return;
}
      if (onCreateGeofence) {
        await onCreateGeofence({
          geofenceName: geoName,
          centerLatitude: geoLat,
          centerLongitude: geoLng,
          radiusMeters: geoRadius,
});
}
      const newG: GeofenceItem = {
        id: `geo-${Date.now()}`,
        geofenceName: geoName,
        centerLatitude: geoLat,
        centerLongitude: geoLng,
        radiusMeters: geoRadius,
        isActive: true,
};
      setGeofences([newG, ...geofences]);
      setShowGeofenceModal(false);
} catch (err: any) {
      alert(`Geofence error: ${err.message}`);
}
};

  const totalEvents = clockEvents.length;
  const verifiedCount = clockEvents.filter((c) => c.verificationStatus === 'WITHIN_GEOFENCE').length;
  const flaggedCount = clockEvents.filter((c) => c.verificationStatus === 'OUTSIDE_GEOFENCE_FLAGGED').length;

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading geofence attendance…</div>;
}

  return (
<div className="space-y-6">
      {/* Header Banner */}
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-3">
<h2 className="text-xl font-bold text-slate-800">Project Geofencing & Biometric Attendance</h2>
<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              GEOFENCE ENFORCED
</span>
</div>
<p className="text-sm text-slate-500 mt-1">
            Site: {projectName} | GPS Haversine Centroid Radius Validation & Biometric Mobile Clock-In (Milestone M23)
</p>
</div>
<button
          onClick={() => setShowGeofenceModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
        >
<span>Configure Geofence Perimeter</span>
</button>
</div>

      {/* Metric Cards */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Perimeter Centroid</p>
<p className="text-sm font-mono font-bold text-slate-800 mt-1">
            {activeGeofence ? `${activeGeofence.centerLatitude}, ${activeGeofence.centerLongitude}` : 'None'}
</p>
<p className="text-xs text-slate-500 mt-1">Radius: {activeGeofence?.radiusMeters} meters</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Total Clock Events</p>
<p className="text-xl font-bold text-slate-800 mt-1">{totalEvents}</p>
<p className="text-xs text-slate-400 mt-1">Today's site muster roll</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-emerald-600 ">Verified On-Site</p>
<p className="text-xl font-bold text-emerald-700 mt-1">{verifiedCount}</p>
<p className="text-xs text-emerald-600 mt-1">Within authorized boundary</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-rose-600 ">Flagged Violations</p>
<p className="text-xl font-bold text-rose-700 mt-1">{flaggedCount}</p>
<p className="text-xs text-rose-500 mt-1">Off-site clock-in attempts</p>
</div>
</div>

      {/* Simulator Section */}
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="border-b border-slate-100 pb-3">
<h3 className="font-bold text-slate-800 text-sm">Mobile Biometric / GPS Clock-In Simulator</h3>
<p className="text-xs text-slate-500">
            Simulate an artisan tapping 'Clock In' on their mobile PWA with real GPS telemetry
</p>
</div>

        {feedback && (
<div
            className={`p-3 rounded-lg text-xs font-medium border ${
              feedback.startsWith('') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
}`}
          >
            {feedback}
</div>
)}

<form onSubmit={handleClockInSubmit} className="space-y-4 text-xs">
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div>
<label className="block font-semibold text-slate-700 mb-1">Select Site Artisan</label>
<select
                value={isLive ? selectedLaborerId : selectedWorker}
                onChange={(e) => {
                  if (isLive) setSelectedLaborerId(e.target.value);
                  else setSelectedWorker(e.target.value);
}}
                className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {isLive ? (
                  laborers.length === 0 ? (
<option value="">No registered laborers</option>
) : (
                    laborers.map((l) => (
<option key={l.id} value={l.id}>
                        {l.fullName} ({l.workerCode}{l.tradeCategory ? ` - ${l.tradeCategory}` : ''})
</option>
))
)
) : (
<>
<option value="Juma Otieno Ochieng (WKR-102)">Juma Otieno Ochieng (Mason - WKR-102)</option>
<option value="Dennis Kiprono (WKR-108)">Dennis Kiprono (Steel Fixer - WKR-108)</option>
<option value="Francis Mwangi (WKR-115)">Francis Mwangi (Carpenter - WKR-115)</option>
<option value="Samuel Kamau (WKR-121)">Samuel Kamau (Electrician - WKR-121)</option>
</>
)}
</select>
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">Action Type</label>
<div className="grid grid-cols-2 gap-2">
<button
                  type="button"
                  onClick={() => setClockType('CLOCK_IN')}
                  className={`py-2 rounded-lg font-bold border transition-colors ${
                    clockType === 'CLOCK_IN' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
}`}
                >
                  Clock In
</button>
<button
                  type="button"
                  onClick={() => setClockType('CLOCK_OUT')}
                  className={`py-2 rounded-lg font-bold border transition-colors ${
                    clockType === 'CLOCK_OUT' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'
}`}
                >
                  Clock Out
</button>
</div>
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">GPS Telemetry Presets</label>
<div className="flex gap-2">
<button
                  type="button"
                  onClick={() => setLocationPreset('GATE')}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium"
                >
                  Main Gate (~15m)
</button>
<button
                  type="button"
                  onClick={() => setLocationPreset('PERIMETER')}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium"
                >
                  Perimeter (~110m)
</button>
<button
                  type="button"
                  onClick={() => setLocationPreset('OFFSITE')}
                  className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-medium"
                >
                  Off-Site (~2.5km)
</button>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div>
<label className="block font-semibold text-slate-700 mb-1">Captured Latitude</label>
<input
                type="text"
                value={capturedLat}
                onChange={(e) => setCapturedLat(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
                required
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Captured Longitude</label>
<input
                type="text"
                value={capturedLng}
                onChange={(e) => setCapturedLng(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
                required
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Photo Selfie URL</label>
<input
                type="text"
                value={selfieUrl}
                onChange={(e) => setSelfieUrl(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
</div>
</div>

          {/* Real-time Haversine Distance Preview */}
<div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-2">
<div>
<span className="text-slate-600 font-medium">Calculated Haversine Distance:</span>
<span className="font-mono font-bold text-slate-900">{previewDistance.toFixed(2)} meters</span>
<span className="text-slate-400"> (Allowed: {activeGeofence?.radiusMeters} m)</span>
</div>
<div>
              {isWithinRadius ? (
<span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs">
                   Within Geofence Boundary
</span>
) : (
<span className="px-3 py-1 bg-rose-100 text-rose-800 font-bold rounded-full text-xs">
                   Outside Geofence Perimeter
</span>
)}
</div>
</div>

<div className="flex justify-end">
<button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
            >
              {isSubmitting ? 'Verifying Coordinates...' : 'Record Mobile Clock Event'}
</button>
</div>
</form>
</div>

      {/* Attendance Log Table */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
<div className="p-4 border-b border-slate-200 flex justify-between items-center">
<div>
<h3 className="font-bold text-slate-800 text-sm">Site Muster Roll Geofence Attendance Feed</h3>
<p className="text-xs text-slate-500">Live GPS-stamped clock-in and clock-out audit trail</p>
</div>
<span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded">
            {clockEvents.length} Events Logged
</span>
</div>

<div className="overflow-x-auto">
<table className="w-full text-left text-xs text-slate-600">
<thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
<tr>
<th className="p-3">Worker / Trade</th>
<th className="p-3">Worker Code</th>
<th className="p-3">Clock Action</th>
<th className="p-3">Haversine Distance</th>
<th className="p-3">Verification Status</th>
<th className="p-3">Selfie URL</th>
<th className="p-3">Timestamp</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {clockEvents.map((evt) => (
<tr key={evt.id} className="hover:bg-slate-50 transition-colors">
<td className="p-3 font-medium text-slate-800">
<div>{evt.workerName}</div>
<div className="text-[10px] text-slate-400">{evt.tradeCategory || 'ARTISAN'}</div>
</td>
<td className="p-3 font-mono font-bold text-slate-700">{evt.workerCode}</td>
<td className="p-3">
<span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.clockType === 'CLOCK_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
}`}
                    >
                      {evt.clockType}
</span>
</td>
<td className="p-3 font-mono font-bold text-slate-800">
                    {evt.calculatedDistanceMeters} m
</td>
<td className="p-3">
                    {evt.verificationStatus === 'WITHIN_GEOFENCE' ? (
<span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        VERIFIED ON-SITE
</span>
) : (
<span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        OFF-SITE FLAGGED
</span>
)}
</td>
<td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-[150px]">
                    {evt.photoSelfieUrl ? 'Photo Verified' : 'No Photo'}
</td>
<td className="p-3 text-slate-400">
                    {new Date(evt.eventTimestamp).toLocaleTimeString('en-KE')}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>

      {/* Geofence Configuration Modal */}
      {showGeofenceModal && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 className="font-bold text-slate-800 text-base">Configure Project Site Geofence</h3>
<button
                onClick={() => setShowGeofenceModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                
</button>
</div>

<form onSubmit={handleCreateGeofence} className="space-y-3 text-xs">
<div>
<label className="block font-semibold text-slate-700 mb-1">Geofence Label</label>
<input
                  type="text"
                  value={geoName}
                  onChange={(e) => setGeoName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label className="block font-semibold text-slate-700 mb-1">Center Latitude</label>
<input
                    type="text"
                    value={geoLat}
                    onChange={(e) => setGeoLat(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Center Longitude</label>
<input
                    type="text"
                    value={geoLng}
                    onChange={(e) => setGeoLng(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
</div>
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">Authorized Radius (Meters)</label>
<input
                  type="text"
                  value={geoRadius}
                  onChange={(e) => setGeoRadius(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                  required
                />
<p className="text-[11px] text-slate-400 mt-1">Recommended: 100m - 250m for commercial high-rises</p>
</div>

<div className="flex justify-end gap-2 pt-2">
<button
                  type="button"
                  onClick={() => setShowGeofenceModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Geofence
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
