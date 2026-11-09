import React, { useState} from 'react';
import { SNAG_TRADE_CATEGORIES} from '@construction/validation';

export type SnagSeverity = 'COSMETIC' | 'FUNCTIONAL' | 'CRITICAL_SAFETY';
export type SnagPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SnagItemType = 'ARCHITECTURAL' | 'MEP' | 'FINISHES' | 'STRUCTURAL' | 'CIVIL' | 'OTHER';
export type TradeCategory = string;

export interface CreateSnagModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  onSnagCreated?: (snag: any) => void;
}

export default function CreateSnagModal({
  isOpen,
  onClose,
  projectId = '',
  projectName = '',
  onSnagCreated,
}: CreateSnagModalProps): React.JSX.Element | null {
  const [block, setBlock] = useState('Block A');
  const [floor, setFloor] = useState('2nd Floor');
  const [room, setRoom] = useState('');
  const [tradeCategory, setTradeCategory] = useState<TradeCategory>('Tiling & Flooring');
  const [customTrade, setCustomTrade] = useState('');
  const [severity, setSeverity] = useState<SnagSeverity>('FUNCTIONAL');
  const [priority, setPriority] = useState<SnagPriority>('MEDIUM');
  const [itemType, setItemType] = useState<SnagItemType>('FINISHES');
  const [isPrivate, setIsPrivate] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [finalApproverName, setFinalApproverName] = useState('');
  const [costImpactKes, setCostImpactKes] = useState('');
  const [scheduleImpactDays, setScheduleImpactDays] = useState('');
  const [costCode, setCostCode] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [distributionText, setDistributionText] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('-1.2683');
  const [longitude, setLongitude] = useState('36.8044');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const effectiveTrade = tradeCategory === '__OTHER__' ? customTrade.trim() : tradeCategory;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room.trim()) {
      setError('Room or Zone location is required (e.g. Room 204 Master Ensuite)');
      return;
}
    if (!description.trim()) {
      setError('Defect description is required');
      return;
}
    if (!effectiveTrade) {
      setError('Please select or type a trade category');
      return;
}

    setIsSubmitting(true);
    setError(null);

    // Gate-4 S6: real API submission — server assigns snag_number & status.
    try {
      const distributions = distributionText
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((name) => ({ recipientName: name}));

      const res = await fetch(`/api/v1/projects/${projectId}/snags`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          locationBlock: block,
          locationFloor: floor,
          locationRoom: room.trim(),
          tradeCategory: effectiveTrade,
          description: description.trim(),
          severity,
          priority,
          itemType,
          isPrivate,
          managerName: managerName || undefined,
          finalApproverName: finalApproverName || undefined,
          costImpactKes: costImpactKes || undefined,
          scheduleImpactDays: scheduleImpactDays ? parseInt(scheduleImpactDays, 10) : undefined,
          costCode: costCode || undefined,
          referenceDoc: referenceDoc || undefined,
          dueDate: dueDate || undefined,
          identifiedByName: 'Site Team',
          photos: photoUrl.trim()
            ? [{ photoType: 'DEFECT', storageKey: photoUrl.trim(), caption: 'Before evidence', gpsLatitude: parseFloat(latitude) || null, gpsLongitude: parseFloat(longitude) || null}]
            : undefined,
          distributions: distributions.length ? distributions : undefined,
}),
});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed to log snag (${res.status})`);

      if (onSnagCreated) {
        onSnagCreated(body);
}

      setRoom('');
      setDescription('');
      setPhotoUrl('');
      onClose();
} catch (err: any) {
      setError(err?.message || 'Failed to log snag item');
} finally {
      setIsSubmitting(false);
}
};

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
<div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
<div>
<span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              Punch List & Defect Logging
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
              Add Snagging Item
</h3>
<p className="text-xs text-slate-500">{projectName}</p>
</div>
<button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition text-lg leading-none"
            aria-label="Close"
          >
            
</button>
</div>

        {/* Form Body */}
<form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2">
<span></span>
<span>{error}</span>
</div>
)}

          {/* Spatial Location Hierarchy: Block -> Floor -> Room */}
<div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
<span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Spatial Zoning (Block → Floor → Room)
</span>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Block / Wing
</label>
<select
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
<option value="Block A">Block A</option>
<option value="Block B">Block B</option>
<option value="Basement 1">Basement 1</option>
<option value="Basement 2">Basement 2</option>
<option value="Roof Terrace">Roof Terrace</option>
</select>
</div>

<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Floor Level
</label>
<select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
<option value="Ground Floor">Ground Floor</option>
<option value="1st Floor">1st Floor</option>
<option value="2nd Floor">2nd Floor</option>
<option value="3rd Floor">3rd Floor</option>
<option value="4th Floor">4th Floor</option>
<option value="Plant Level">Plant Level</option>
</select>
</div>

<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Room / Zone<span className="text-rose-500">*</span>
</label>
<input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Room 204 Ensuite"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  required
                />
</div>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Trade Category<span className="text-rose-500">*</span>
</label>
<select
                value={tradeCategory}
                onChange={(e) => setTradeCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 bg-white"
              >
                {SNAG_TRADE_CATEGORIES.map((t) => (
<option key={t} value={t}>{t}</option>
))}
<option value="__OTHER__">Other (type it)</option>
</select>
              {tradeCategory === '__OTHER__' && (
<input
                  type="text"
                  value={customTrade}
                  onChange={(e) => setCustomTrade(e.target.value)}
                  placeholder="Type trade…"
                  className="w-full text-xs px-3 py-1.5 mt-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
)}
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Severity Level<span className="text-rose-500">*</span>
</label>
<select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SnagSeverity)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 bg-white"
              >
<option value="COSMETIC">COSMETIC (Minor scratch, paint blemish)</option>
<option value="FUNCTIONAL">FUNCTIONAL (Door binding, leak, misaligned fixture)</option>
<option value="CRITICAL_SAFETY">CRITICAL_SAFETY (Exposed wiring, structural hazard)</option>
</select>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
</label>
<select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SnagPriority)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 bg-white"
              >
<option value="LOW">LOW</option>
<option value="MEDIUM">MEDIUM</option>
<option value="HIGH">HIGH</option>
<option value="CRITICAL">CRITICAL</option>
</select>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Item Type</label>
<select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as SnagItemType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 bg-white"
              >
                {(['ARCHITECTURAL', 'MEP', 'FINISHES', 'STRUCTURAL', 'CIVIL', 'OTHER'] as const).map((t) => (
<option key={t} value={t}>{t}</option>
))}
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Punch Item Manager</label>
<input type="text" value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Site Foreman" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Final Approver</label>
<input type="text" value={finalApproverName} onChange={(e) => setFinalApproverName(e.target.value)} placeholder="e.g. Consulting Architect" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
</div>

<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Cost Impact (KES)</label>
<input type="number" min="0" step="0.01" value={costImpactKes} onChange={(e) => setCostImpactKes(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Schedule Impact (days)</label>
<input type="number" min="0" step="1" value={scheduleImpactDays} onChange={(e) => setScheduleImpactDays(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Cost Code</label>
<input type="text" value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="e.g. FIN-02" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Reference (drawing/spec)</label>
<input type="text" value={referenceDoc} onChange={(e) => setReferenceDoc(e.target.value)} placeholder="e.g. A-204 Rev C" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Distribution List (comma-separated)</label>
<input type="text" value={distributionText} onChange={(e) => setDistributionText(e.target.value)} placeholder="e.g. Architect, QS, Client Rep" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" />
</div>
</div>

<label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
<input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-slate-300" />
            Private — restrict visibility from external stakeholder portals
</label>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Defect Description<span className="text-rose-500">*</span>
</label>
<textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State precise defect, location on element, and rectification requirement..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 placeholder-slate-400 resize-none"
              required
            />
</div>

          {/* Geotag GPS & Photo Evidence */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                GPS Latitude
</label>
<input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 font-mono"
              />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                GPS Longitude
</label>
<input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 font-mono"
              />
</div>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Before Photo Evidence URL / Filename
</label>
<input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="e.g. photo-crack-tile-204.jpg or leave blank for sample photo"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 placeholder-slate-400"
            />
</div>

<div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
<button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
</button>
<button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Logging...' : 'Add Snag Item'}
</button>
</div>
</form>
</div>
</div>
);
}
