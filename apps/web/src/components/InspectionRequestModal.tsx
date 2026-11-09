import React, { useState} from 'react';

/** Reference-observed inspection categories (12 types). */
export const INSPECTION_TYPES = [
  'Quality', 'Safety', 'Structural', 'Environmental', 'Electrical', 'Plumbing',
  'Road Surface', 'Subgrade / Earthwork', 'Drainage / Culvert', 'Bridge Structural',
  'Asphalt Compaction', 'Traffic Control Setup',
] as const;

const CHECKLIST_TYPES = [
  ['PRE_POUR_CONCRETE', 'Pre-pour concrete'],
  ['SUBSTRUCTURE_EXCAVATION', 'Substructure / excavation'],
  ['REBAR_VERIFICATION', 'Rebar verification'],
  ['SCAFFOLDING_SAFETY', 'Scaffolding safety'],
  ['WATERPROOFING_FLOOD_TEST', 'Waterproofing / flood test'],
  ['MEP_PRESSURE_TEST', 'MEP pressure test'],
  ['PRE_PLASTER_WALLING', 'Pre-plaster walling'],
  ['PRE_HANDOVER_INSPECTION', 'Pre-handover inspection'],
] as const;

const input = 'w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';
const label = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1';

interface Props {
  projectId: string;
  projectName?: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function InspectionRequestModal({ projectId, projectName, open, onClose, onCreated}: Props): React.JSX.Element | null {
  const [form, setForm] = useState({
    inspectionType: 'Quality',
    scheduledDate: new Date().toISOString().slice(0, 10),
    inspectorName: '',
    inspectorRole: '',
    assignedConsultant: '',
    checklistType: 'PRE_POUR_CONCRETE',
    location: '',
    requiresConsultantReview: true,
    summaryNotes: '',
});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/inspections`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          inspectionType: form.inspectionType,
          assignedConsultant: form.assignedConsultant || null,
          checklistType: form.checklistType,
          title: `${form.inspectionType} inspection — ${projectName || 'project'}`,
          location: form.location || 'Site',
          scheduledDate: form.scheduledDate,
          inspectorName: form.inspectorName || null,
          inspectorRole: form.inspectorRole || null,
          summaryNotes: form.summaryNotes || null,
          requiresConsultantReview: form.requiresConsultantReview,
}),
});
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message || 'Failed to create inspection request');
      onCreated(); onClose();
} catch (err: any) {
      setError(err.message);
} finally {
      setSaving(false);
}
};

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
<div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">New Inspection Request</h3>
<p className="text-[11px] text-slate-400">Template-driven QA/QC inspection with consultant approval workflow</p>
</div>
<button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
</div>
<form onSubmit={submit} className="p-5 space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div>
<label className={label}>Type *</label>
<select required value={form.inspectionType} onChange={(e) => setForm({ ...form, inspectionType: e.target.value})} className={input}>
                {INSPECTION_TYPES.map((t) =><option key={t} value={t}>{t}</option>)}
</select>
</div>
<div>
<label className={label}>Date *</label>
<input required type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value})} className={input} />
</div>
<div>
<label className={label}>Inspector / requester</label>
<input value={form.inspectorName} onChange={(e) => setForm({ ...form, inspectorName: e.target.value})} placeholder="Name" className={input} />
</div>
<div>
<label className={label}>Role</label>
<input value={form.inspectorRole} onChange={(e) => setForm({ ...form, inspectorRole: e.target.value})} placeholder="e.g. Site Engineer" className={input} />
</div>
<div>
<label className={label}>Assign to consultant</label>
<input value={form.assignedConsultant} onChange={(e) => setForm({ ...form, assignedConsultant: e.target.value})} placeholder="Consultant name(s), comma-separated" className={input} />
</div>
<div>
<label className={label}>Checklist template *</label>
<select required value={form.checklistType} onChange={(e) => setForm({ ...form, checklistType: e.target.value})} className={input}>
                {CHECKLIST_TYPES.map(([v, l]) =><option key={v} value={v}>{l}</option>)}
</select>
</div>
<div className="sm:col-span-2">
<label className={label}>Location</label>
<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value})} placeholder="e.g. Block B, 2nd floor slab" className={input} />
</div>
<div className="sm:col-span-2">
<label className={label}>Notes</label>
<textarea rows={2} value={form.summaryNotes} onChange={(e) => setForm({ ...form, summaryNotes: e.target.value})} className={input} />
</div>
</div>
<label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
<input type="checkbox" checked={form.requiresConsultantReview} onChange={(e) => setForm({ ...form, requiresConsultantReview: e.target.checked})} className="accent-orange-600" />
            Requires consultant review before sign-off
</label>
          {error &&<p className="text-xs font-semibold text-red-600">{error}</p>}
<div className="flex justify-end gap-2">
<button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
<button type="submit" disabled={saving} className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg">
              {saving ? 'Submitting…' : 'Submit request'}
</button>
</div>
</form>
</div>
</div>
);
}
