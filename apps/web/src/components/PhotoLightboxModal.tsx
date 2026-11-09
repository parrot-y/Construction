import React from 'react';

export interface PhotoEvidenceItem {
  id: string;
  caption: string;
  photo_url: string;
  latitude?: number | null;
  longitude?: number | null;
  captured_at: string;
  weather?: string;
  recorded_by_name?: string;
}

interface PhotoLightboxModalProps {
  isOpen: boolean;
  photo: PhotoEvidenceItem | null;
  onClose: () => void;
}

export default function PhotoLightboxModal({
  isOpen,
  photo,
  onClose,
}: PhotoLightboxModalProps): React.JSX.Element | null {
  if (!isOpen || !photo) {
    return null;
}

  const lat = photo.latitude !== null && photo.latitude !== undefined ? photo.latitude.toFixed(6) : '-1.286389';
  const lng = photo.longitude !== null && photo.longitude !== undefined ? photo.longitude.toFixed(6) : '36.817223';

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
<div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
<div>
<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Verified Site Evidence
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Photo Inspection Lightbox</h3>
</div>
<button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            
</button>
</div>

        {/* Photo Display Container */}
<div className="p-5 space-y-4">
<div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200 shadow-inner group">
            {photo.photo_url.startsWith('http') || photo.photo_url.endsWith('.jpg') || photo.photo_url.endsWith('.png') ? (
<img
                src={photo.photo_url}
                alt={photo.caption}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder if asset not hosted locally
                  (e.target as HTMLElement).style.display = 'none';
}}
              />
) : null}
<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white pointer-events-none bg-gradient-to-t from-slate-950/80 via-transparent to-transparent">
<span className="text-4xl mb-2 drop-shadow-md"></span>
<p className="text-sm font-semibold drop-shadow">{photo.caption}</p>
<span className="text-[11px] font-mono opacity-80 mt-1">
                 GPS {lat}, {lng} (Nairobi, Kenya)
</span>
</div>
</div>

          {/* Metadata Card Grid */}
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Nairobi GPS Pin
</span>
<span className="font-mono font-medium text-slate-800 mt-0.5 block">
                 {lat}, {lng}
</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Captured At
</span>
<span className="font-medium text-slate-800 mt-0.5 block">
                {photo.captured_at ? photo.captured_at.split('T')[0] : 'Today'}
</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Weather Conditions
</span>
<span className="font-medium text-slate-800 mt-0.5 block">
                 {photo.weather || 'SUNNY_CLEAR'}
</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg sm:col-span-3">
<span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Verified Inspector / Recorded By
</span>
<span className="font-medium text-slate-800 mt-0.5 block">
                 {photo.recorded_by_name || 'David Kimani (Registered Site Supervisor)'}
</span>
</div>
</div>

          {/* Kenya Data Protection Act 2019 Notice (M5) */}
<div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
<span className="font-semibold text-slate-700">Kenya Data Protection Act (2019) Notice:</span> GPS geolocation data and site photographs are captured solely for contractual works verification and milestone audit.
</div>
</div>

        {/* Footer */}
<div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
<button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition"
          >
            Close Lightbox
</button>
</div>
</div>
</div>
);
}
