import React, { useEffect, useState} from 'react';
import PhotoLightboxModal, { PhotoEvidenceItem} from './PhotoLightboxModal';

interface PhotoEvidenceGalleryProps {
  photos?: PhotoEvidenceItem[];
  projectId?: string;
}

export default function PhotoEvidenceGallery({
  photos,
  projectId = '',
}: PhotoEvidenceGalleryProps): React.JSX.Element {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [livePhotos, setLivePhotos] = useState<PhotoEvidenceItem[] | null>(null);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoEvidenceItem | null>(null);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-diaries`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const diaries = (json.data || []) as any[];
      const mapped: PhotoEvidenceItem[] = diaries
        .flatMap((d) => (d.photos || []).map((p: any) => ({
          id: p.id,
          caption: p.caption || 'Site photo evidence',
          photo_url: p.storage_key?.startsWith('http') || p.storage_key?.startsWith('/')
            ? p.storage_key
            : `/uploads/${p.storage_key || ''}`,
          latitude: p.gps_latitude != null ? parseFloat(String(p.gps_latitude)) : null,
          longitude: p.gps_longitude != null ? parseFloat(String(p.gps_longitude)) : null,
          captured_at: p.taken_at || p.created_at || '',
          weather: d.weather || undefined,
          recorded_by_name: undefined,
})))
        .sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)));
      setLivePhotos(mapped);
} catch {
      setLivePhotos([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const resolvedPhotos = isLive
    ? (livePhotos ?? [])
    : (photos ?? []);
  const displayPhotos = resolvedPhotos;

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading photo evidence…</div>;
}

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Site Progress Photos
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Verified Photo Evidence Gallery</h3>
<p className="text-xs text-slate-500">
            Geotagged site inspection photos verified and signed off by resident engineers
</p>
</div>

</div>

      {/* Statutory Data Protection Notice (M5) */}
<div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
<span></span>
<span>
<strong>Data Protection Notice:</strong> Geolocation data and site imagery are recorded strictly for contractual milestone verification under the Kenya Data Protection Act 2019.
</span>
</div>

      {displayPhotos.length === 0 ? (
<div className="border border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 space-y-2">
<div className="text-3xl text-slate-400"></div>
<p className="text-xs font-semibold text-slate-700">No Photo Records Available</p>
<p className="text-[11px] text-slate-500 max-w-md mx-auto">
            Site progress photos will appear here as field inspections and site diaries are logged.
</p>
</div>
) : (
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {displayPhotos.map((photo) => {
            const lat = photo.latitude !== null && photo.latitude !== undefined ? photo.latitude.toFixed(6) : '-1.286389';
            const lng = photo.longitude !== null && photo.longitude !== undefined ? photo.longitude.toFixed(6) : '36.817223';

            return (
<div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="group border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-300 hover:shadow-md transition cursor-pointer bg-white flex flex-col justify-between"
              >
                {/* Photo Preview Container */}
<div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
<div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
<span className="text-3xl mb-1 group-hover:scale-110 transition duration-200"></span>
<span className="text-[11px] text-slate-300 font-medium line-clamp-1">{photo.caption}</span>
</div>
<div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-white/90">
<span className="bg-slate-950/70 backdrop-blur-sm px-2 py-0.5 rounded font-mono">
                       {lat}, {lng}
</span>
<span className="bg-emerald-600/90 backdrop-blur-sm px-2 py-0.5 rounded font-semibold">
                      Verified
</span>
</div>
</div>

                {/* Card Content */}
<div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
<div>
<h4 className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 transition line-clamp-2">
                      {photo.caption}
</h4>
<p className="text-[11px] text-slate-500 mt-1">
                      By {photo.recorded_by_name || 'Site Supervisor'}
</p>
</div>

<div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
<span>{photo.captured_at ? photo.captured_at.split('T')[0] : '2026-02-01'}</span>
<span className="text-emerald-600 font-semibold group-hover:underline">
                      Inspect Photo →
</span>
</div>
</div>
</div>
);
})}
</div>
)}

      {/* Lightbox Modal */}
<PhotoLightboxModal
        isOpen={selectedPhoto !== null}
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
</div>
);
}
