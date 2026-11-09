import React, { useEffect, useState} from 'react';
import CreateRfiModal, { RfiPriority, ConsultantRole} from './CreateRfiModal';

export type RfiStatus = 'SUBMITTED' | 'ANSWERED' | 'CLOSED';

export interface RfiResponseItem {
  id: string;
  respondentName: string;
  respondentRole: string;
  respondedAt: string;
  content: string;
  attachments?: Array<{ name: string; size: string; url?: string}>;
}

export interface RfiItemData {
  id: string;
  rfiNo: string;
  title: string;
  query: string;
  priority: RfiPriority;
  status: RfiStatus;
  assignedConsultant: ConsultantRole;
  drawingRef?: string;
  submittedBy: string;
  submittedAt: string;
  daysElapsed: number;
  responses: RfiResponseItem[];
  attachments?: Array<{ name: string; size: string; url?: string}>;
}

interface RfiManagementViewProps {
  projectId?: string;
  projectName?: string;
  initialRfis?: RfiItemData[];
  canCreate?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONSULTANT_MAP: Record<string, ConsultantRole> = {
  ARCHITECT: 'Architect', STRUCTURAL_ENG: 'Structural Eng', SERVICES_ENG: 'Services Eng', QS: 'QS',
};

function mapApiRfi(r: any): RfiItemData {
  const status: RfiStatus = r.status === 'ANSWERED' ? 'ANSWERED' : r.status === 'CLOSED' ? 'CLOSED' : 'SUBMITTED';
  const created = r.created_at ? new Date(r.created_at) : new Date();
  return {
    id: r.id,
    rfiNo: `RFI-${String(r.rfi_number).padStart(3, '0')}`,
    title: r.title,
    query: r.question,
    priority: (r.priority as RfiPriority) || 'MEDIUM',
    status,
    assignedConsultant: CONSULTANT_MAP[r.assigned_to_role] || 'QS',
    drawingRef: r.drawing_reference || undefined,
    submittedBy: r.created_by?.full_name || r.created_by?.email || 'Site team',
    submittedAt: created.toISOString(),
    daysElapsed: Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000)),
    responses: (r.responses || []).map((resp: any) => ({
      id: resp.id,
      respondentName: resp.responder?.full_name || resp.responder?.email || 'Consultant',
      respondentRole: 'Consultant',
      respondedAt: resp.created_at,
      content: resp.official_answer,
})),
};
}

export default function RfiManagementView({
  projectId = '',
  projectName = '',
  initialRfis = [],
  canCreate = true,
}: RfiManagementViewProps): React.JSX.Element {
  const isLive = UUID_RE.test(projectId);
  const [rfis, setRfis] = useState<RfiItemData[]>(initialRfis);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/rfis`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setRfis((data || []).map(mapApiRfi));
      setLiveLoaded(true);
} catch {
      setLiveLoaded(true); // surface empty rather than stale demo
      setRfis([]);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRfiId, setExpandedRfiId] = useState<string | null>('rfi-001');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RfiStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | RfiPriority>('ALL');
  const [consultantFilter, setConsultantFilter] = useState<'ALL' | ConsultantRole>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState<{ [rfiId: string]: string}>({});

  const handleCreateRfi = (newRfi: any) => {
    if (isLive) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/rfis`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              title: newRfi.title,
              question: newRfi.query,
              drawingReference: newRfi.drawingRef || null,
              priority: newRfi.priority,
              assignedToRole: Object.entries(CONSULTANT_MAP).find(([, v]) => v === newRfi.assignedConsultant)?.[0] || 'QS',
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      return;
}
    setRfis((prev) => [newRfi, ...prev]);
    setExpandedRfiId(newRfi.id);
};

  const handleToggleExpand = (id: string) => {
    setExpandedRfiId((prev) => (prev === id ? null : id));
};

  const handleCloseRfi = (id: string) => {
    if (isLive) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/rfis/${id}/close`, { method: 'POST', credentials: 'include'});
          if (res.ok) await reload();
} catch { /* ignore */}
})();
      return;
}
    setRfis((prev) =>
      prev.map((rfi) => (rfi.id === id ? { ...rfi, status: 'CLOSED' as const} : rfi))
);
};

  const handleAddResponse = (rfiId: string) => {
    const text = replyText[rfiId]?.trim();
    if (!text) return;

    if (isLive) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/rfis/${rfiId}/responses`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ officialAnswer: text, isAccepted: true}),
});
          if (res.ok) { setReplyText((prev) => ({ ...prev, [rfiId]: ''})); await reload();}
} catch { /* ignore */}
})();
      return;
}

    setRfis((prev) =>
      prev.map((rfi) => {
        if (rfi.id !== rfiId) return rfi;
        const newResponse: RfiResponseItem = {
          id: `resp-${Date.now()}`,
          respondentName: 'Faith Achieng (Consultant / QS)',
          respondentRole: 'BORAQS Registered Professional',
          respondedAt: new Date().toISOString(),
          content: text,
};
        return {
          ...rfi,
          status: 'ANSWERED' as const,
          responses: [...rfi.responses, newResponse],
};
})
);

    setReplyText((prev) => ({ ...prev, [rfiId]: ''}));
};

  const filteredRfis = rfis.filter((rfi) => {
    if (statusFilter !== 'ALL' && rfi.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && rfi.priority !== priorityFilter) return false;
    if (consultantFilter !== 'ALL' && rfi.assignedConsultant !== consultantFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${rfi.rfiNo} ${rfi.title} ${rfi.query} ${rfi.assignedConsultant}`.toLowerCase();
      if (!matchText.includes(q)) return false;
}
    return true;
});

  const getPriorityBadge = (priority: RfiPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
}
};

  const getStatusBadge = (status: RfiStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ANSWERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-600 border-slate-200';
}
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading RFIs…</div>;
}

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Top Header */}
<div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              BORAQS / EBK Engineering Coordination
</span>
<span className="text-xs text-slate-400 font-mono">ISO 9001:2015</span>
</div>
<h3 className="text-lg font-bold text-slate-900 mt-1">
            Request for Information (RFI) Register
</h3>
<p className="text-xs text-slate-500">
            Contractor formal technical queries, drawing discrepancies, and consultant resolution threads
</p>
</div>

<div className="flex items-center gap-2">
          {canCreate && (
<button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
<span>+ New RFI</span>
</button>
)}
</div>
</div>

      {/* Summary KPI Strip */}
<div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-slate-50/30 border-b border-slate-200 text-xs">
<div className="p-3 text-center">
<span className="text-[10px] font-semibold text-slate-400 block">
            Total RFIs Logged
</span>
<span className="text-lg font-bold font-mono text-slate-800 mt-0.5 block">
            {rfis.length}
</span>
</div>
<div className="p-3 text-center">
<span className="text-[10px] font-semibold text-amber-600 block">
            Pending Consultant Reply
</span>
<span className="text-lg font-bold font-mono text-amber-700 mt-0.5 block">
            {rfis.filter((r) => r.status === 'SUBMITTED').length}
</span>
</div>
<div className="p-3 text-center">
<span className="text-[10px] font-semibold text-emerald-600 block">
            Answered & Resolved
</span>
<span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
            {rfis.filter((r) => r.status === 'ANSWERED').length}
</span>
</div>
<div className="p-3 text-center">
<span className="text-[10px] font-semibold text-rose-600 block">
            Critical Path Queries
</span>
<span className="text-lg font-bold font-mono text-rose-700 mt-0.5 block">
            {rfis.filter((r) => r.priority === 'CRITICAL').length}
</span>
</div>
</div>

      {/* Filter and Search Bar */}
<div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
<div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
<div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['ALL', 'SUBMITTED', 'ANSWERED', 'CLOSED'] as const).map((st) => (
<button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                  statusFilter === st
                    ? 'bg-white text-purple-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
}`}
              >
                {st === 'ALL' ? 'All Status' : st}
</button>
))}
</div>

          {/* Consultant Filter */}
<select
            value={consultantFilter}
            onChange={(e) => setConsultantFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
<option value="ALL">All Consultants</option>
<option value="Architect">Architect</option>
<option value="Structural Eng">Structural Eng</option>
<option value="Services Eng">Services Eng</option>
<option value="QS">Quantity Surveyor</option>
</select>

          {/* Priority Filter */}
<select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
<option value="ALL">All Priorities</option>
<option value="CRITICAL">Critical</option>
<option value="HIGH">High</option>
<option value="MEDIUM">Medium</option>
<option value="LOW">Low</option>
</select>
</div>

        {/* Search */}
<div className="relative">
<input
            type="text"
            placeholder="Search RFI #, subject, drawing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400"
          />
<span className="absolute left-2.5 top-2 text-slate-400 text-xs"></span>
</div>
</div>

      {/* Interactive RFI Table */}
<div className="overflow-x-auto">
<table className="w-full text-left text-xs border-collapse">
<thead>
<tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px]">
<th className="p-3 font-semibold">RFI #</th>
<th className="p-3 font-semibold">Title & Reference</th>
<th className="p-3 font-semibold">Assigned Consultant</th>
<th className="p-3 font-semibold">Priority</th>
<th className="p-3 font-semibold">Status</th>
<th className="p-3 font-semibold">Elapsed</th>
<th className="p-3 font-semibold text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredRfis.length === 0 ? (
<tr>
<td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                  No RFIs found matching your filters.
</td>
</tr>
) : (
              filteredRfis.map((rfi) => {
                const isExpanded = expandedRfiId === rfi.id;
                return (
<React.Fragment key={rfi.id}>
<tr
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        isExpanded ? 'bg-purple-50/30' : ''
}`}
                      onClick={() => handleToggleExpand(rfi.id)}
                    >
<td className="p-3 font-mono font-bold text-purple-900 whitespace-nowrap">
                        {rfi.rfiNo}
</td>
<td className="p-3">
<div className="font-semibold text-slate-900">{rfi.title}</div>
                        {rfi.drawingRef && (
<div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {`Ref: ${rfi.drawingRef}`}
</div>
)}
</td>
<td className="p-3 whitespace-nowrap">
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-medium text-[11px] border border-slate-200">
<span></span>
<span>{rfi.assignedConsultant}</span>
</span>
</td>
<td className="p-3 whitespace-nowrap">
<span
                          className={`px-2 py-0.5 rounded-full text-[10px] border ${getPriorityBadge(
                            rfi.priority
)}`}
                        >
                          {rfi.priority}
</span>
</td>
<td className="p-3 whitespace-nowrap">
<span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                            rfi.status
)}`}
                        >
                          {rfi.status}
</span>
</td>
<td className="p-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {`${rfi.daysElapsed} days elapsed`}
</td>
<td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
<button
                          onClick={() => handleToggleExpand(rfi.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition"
                        >
                          {isExpanded ? 'Hide Thread ▲' : 'View Thread ▼'}
</button>
</td>
</tr>

                    {/* Expandable Response Thread */}
                    {isExpanded && (
<tr className="bg-slate-50/70 border-b border-purple-100">
<td colSpan={7} className="p-4 sm:p-5">
<div className="space-y-4 max-w-4xl mx-auto bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                            {/* Original Technical Query */}
<div className="border-l-4 border-purple-500 pl-4 space-y-1.5">
<div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
<div>
<span className="font-semibold text-slate-800">
                                    Submitted by: {rfi.submittedBy}
</span>
<span className="mx-1">•</span>
<span>{new Date(rfi.submittedAt).toLocaleDateString()}</span>
</div>
<span className="text-purple-700 font-semibold">
                                  Assigned to: {rfi.assignedConsultant}
</span>
</div>
<p className="text-xs text-slate-700 leading-relaxed font-sans">
                                {rfi.query}
</p>
                              {rfi.attachments && rfi.attachments.length > 0 && (
<div className="pt-2 flex flex-wrap gap-2">
                                  {rfi.attachments.map((att, i) => (
<span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-mono border border-slate-200 hover:bg-slate-200 cursor-pointer"
                                    >
<span></span>
<span>{att.name}</span>
<span className="text-slate-400">({att.size})</span>
</span>
))}
</div>
)}
</div>

                            {/* Official Consultant Responses */}
<div className="space-y-3 pt-2">
<h4 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
<span></span>
<span>Official Consultant Resolution Thread ({rfi.responses.length})</span>
</h4>

                              {rfi.responses.length === 0 ? (
<div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
<span>⏳</span>
<span>
                                    Awaiting official written response from {rfi.assignedConsultant}. Lead time SLA: 48h.
</span>
</div>
) : (
                                rfi.responses.map((resp) => (
<div
                                    key={resp.id}
                                    className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2 text-xs"
                                  >
<div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
<div className="flex items-center gap-2">
<span className="text-sm"></span>
<div>
<span className="font-bold text-slate-900 block">
                                            {resp.respondentName}
</span>
<span className="text-[10px] text-emerald-800 font-medium">
                                            {resp.respondentRole}
</span>
</div>
</div>
<span className="text-[11px] text-slate-500 font-mono">
                                        {new Date(resp.respondedAt).toLocaleDateString()}
</span>
</div>
<p className="text-slate-800 leading-relaxed font-sans">
                                      {resp.content}
</p>
                                    {resp.attachments && resp.attachments.length > 0 && (
<div className="pt-1 flex flex-wrap gap-2">
                                        {resp.attachments.map((att, i) => (
<span
                                            key={i}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-emerald-900 rounded-md text-[11px] font-mono border border-emerald-200 shadow-2xs hover:bg-emerald-50 cursor-pointer"
                                          >
<span></span>
<span>{att.name}</span>
<span className="text-emerald-600">({att.size})</span>
</span>
))}
</div>
)}
</div>
))
)}
</div>

                            {/* Reply & Closure Actions */}
<div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
<div className="flex-1 flex gap-2">
<input
                                  type="text"
                                  placeholder={`Add consultant reply to ${rfi.rfiNo}...`}
                                  value={replyText[rfi.id] || ''}
                                  onChange={(e) =>
                                    setReplyText({ ...replyText, [rfi.id]: e.target.value})
}
                                  className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400"
                                />
<button
                                  onClick={() => handleAddResponse(rfi.id)}
                                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition shrink-0"
                                >
                                  Submit Reply
</button>
</div>

                              {rfi.status !== 'CLOSED' && (
<button
                                  onClick={() => handleCloseRfi(rfi.id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition shrink-0"
                                >
                                  Close RFI 
</button>
)}
</div>
</div>
</td>
</tr>
)}
</React.Fragment>
);
})
)}
</tbody>
</table>
</div>

      {/* Create Modal */}
<CreateRfiModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        onRfiCreated={handleCreateRfi}
      />
</div>
);
}
