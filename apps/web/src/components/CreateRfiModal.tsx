import React, { useState} from 'react';

export type RfiPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ConsultantRole = 'Architect' | 'Structural Eng' | 'Services Eng' | 'QS';

interface CreateRfiModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  onRfiCreated?: (rfi: any) => void;
}

export default function CreateRfiModal({
  isOpen,
  onClose,
  projectId = '',
  projectName = '',
  onRfiCreated,
}: CreateRfiModalProps): React.JSX.Element | null {
  const [title, setTitle] = useState('');
  const [assignedConsultant, setAssignedConsultant] = useState<ConsultantRole>('Architect');
  const [priority, setPriority] = useState<RfiPriority>('MEDIUM');
  const [issueType, setIssueType] = useState<'RFI' | 'CLASH' | 'DESIGN_QUESTION'>('RFI');
  const [drawingRef, setDrawingRef] = useState('');
  const [query, setQuery] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('RFI title is required');
      return;
}
    if (!query.trim()) {
      setError('Technical query description is required');
      return;
}

    setIsSubmitting(true);
    setError(null);

    const newRfi = {
      id: `rfi-${Date.now()}`,
      projectId,
      rfiNo: `RFI-00${Math.floor(Math.random() * 90) + 10}`,
      title: title.trim(),
      query: query.trim(),
      issueType,
      priority,
      status: 'SUBMITTED' as const,
      assignedConsultant,
      drawingRef: drawingRef.trim() || undefined,
      submittedBy: 'Contractor Site Agent',
      submittedAt: new Date().toISOString(),
      daysElapsed: 0,
      responses: [],
      attachments: attachmentName.trim()
        ? [{ name: attachmentName.trim(), size: '1.4 MB'}]
        : [{ name: 'Site-Markup-Detail.pdf', size: '820 KB'}],
};

    if (onRfiCreated) {
      onRfiCreated(newRfi);
}

    setIsSubmitting(false);
    // Reset form
    setTitle('');
    setDrawingRef('');
    setQuery('');
    setAttachmentName('');
    setPriority('MEDIUM');
    setAssignedConsultant('Architect');
    onClose();
};

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
<div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
<div>
<span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              Formal Technical Clarification
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
              New Request for Information (RFI)
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

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              RFI Subject / Title<span className="text-rose-500">*</span>
</label>
<input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clarification on Column C4 Starter Bar Lap Length"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 placeholder-slate-400"
              required
            />
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Issue type</label>
<select value={issueType} onChange={(e) => setIssueType(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white">
<option value="RFI">RFI</option>
<option value="CLASH">Clash</option>
<option value="DESIGN_QUESTION">Design Question</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Consultant<span className="text-rose-500">*</span>
</label>
<select
                value={assignedConsultant}
                onChange={(e) => setAssignedConsultant(e.target.value as ConsultantRole)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 bg-white"
              >
<option value="Architect">Architect (Lead Design Consultant)</option>
<option value="Structural Eng">Structural Engineer (BORAQS / EBK)</option>
<option value="Services Eng">Services Engineer (MEP / HVAC)</option>
<option value="QS">Quantity Surveyor (BORAQS Cost Control)</option>
</select>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Level<span className="text-rose-500">*</span>
</label>
<select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RfiPriority)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 bg-white"
              >
<option value="LOW">LOW (Informational / 7 days)</option>
<option value="MEDIUM">MEDIUM (Standard / 5 days)</option>
<option value="HIGH">HIGH (Urgent / 48 hours)</option>
<option value="CRITICAL">CRITICAL (Work Stoppage / 24 hours)</option>
</select>
</div>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Specification / Drawing Reference
</label>
<input
              type="text"
              value={drawingRef}
              onChange={(e) => setDrawingRef(e.target.value)}
              placeholder="e.g. ST-102-REV-B, Detail 4 / EASMM Section F"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 placeholder-slate-400"
            />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Technical Query Narrative<span className="text-rose-500">*</span>
</label>
<textarea
              rows={4}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="State the technical ambiguity, drawing discrepancy, site condition clash, or proposed solution clearly..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 placeholder-slate-400 resize-none"
              required
            />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Attachment Name / Reference Drawing
</label>
<input
              type="text"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              placeholder="e.g. Photo-Grid-C4-Discrepancy.jpg or SK-02.pdf"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 placeholder-slate-400"
            />
<p className="text-[11px] text-slate-400 mt-1">
              Simulates attaching marked-up DWG/PDF drawings or site photos for the consultant.
</p>
</div>

          {/* Footer actions */}
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
              className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit RFI to Consultant'}
</button>
</div>
</form>
</div>
</div>
);
}
