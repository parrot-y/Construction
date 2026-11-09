import React, { useEffect, useState} from 'react';
import { PortalLinkNotice, PortalExpiryBanner } from './PortalErrorState';

export interface ConsultantRfiItem {
  id: string;
  rfi_number: string;
  title: string;
  question: string;
  discipline: string;
  urgency: 'NORMAL' | 'URGENT' | 'BLOCKER';
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ANSWERED' | 'CLOSED';
  created_at: string;
  responses?: Array<{
    id: string;
    official_answer: string;
    is_accepted: boolean;
    created_at: string;
}>;
}

export interface ConsultantCubeTest {
  id: string;
  batch_reference: string;
  pour_date: string;
  element_location: string;
  design_grade_mpa: number;
  break_results?: Array<{
    id: string;
    age_days: number;
    failure_load_kn: number;
    compressive_strength_mpa: number;
    is_pass: boolean;
}>;
}

export interface ConsultantInspection {
  id: string;
  title: string;
  category: string;
  scheduled_date: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED_REVISE';
  items?: Array<{
    id: string;
    item_description: string;
    is_compliant: boolean;
    notes?: string;
}>;
}

interface ConsultantPortalViewProps {
  token?: string;
  stakeholderName?: string;
  stakeholderRole?: string;
  projectName?: string;
  projectCode?: string;
  onBackToDashboard?: () => void;
}

export default function ConsultantPortalView({
  token,
  stakeholderName,
  stakeholderRole,
  projectName,
  projectCode,
  onBackToDashboard,
}: ConsultantPortalViewProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [stakeholder, setStakeholder] = useState({ name: stakeholderName || '', role: stakeholderRole || '' });
  const [proj, setProj] = useState({ name: projectName || '', code: projectCode || '' });
  const [rfis, setRfis] = useState<ConsultantRfiItem[]>([]);
  const [cubeTests, setCubeTests] = useState<ConsultantCubeTest[]>([]);
  const [inspections, setInspections] = useState<ConsultantInspection[]>([]);
  const [selectedRfi, setSelectedRfi] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rfis' | 'cubes' | 'inspections'>('rfis');

  useEffect(() => {
    if (!token) { setLoading(false); setLoadError('Missing portal token.'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/portals/consultant/${token}`, { credentials: 'include' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || 'This portal link is invalid or has expired');
        if (cancelled) return;
        const d = body.data || body;
        if (d.stakeholder) setStakeholder({ name: d.stakeholder.name || '', role: d.stakeholder.role || '' });
        if (d.linkExpiresAt) setLinkExpiresAt(d.linkExpiresAt);
        if (d.project) setProj({ name: d.project.name || '', code: d.project.code || '' });
        setRfis((d.rfis || []).map((r: any) => ({
          id: r.id,
          rfi_number: `RFI-${String(r.rfiNumber).padStart(3, '0')}`,
          title: r.title,
          question: r.question,
          drawing_reference: r.drawingReference,
          discipline: r.issueType || 'GENERAL',
          urgency: r.priority === 'CRITICAL' ? 'BLOCKER' : (r.priority === 'HIGH' || r.priority === 'URGENT') ? 'URGENT' : 'NORMAL',
          status: r.status,
          created_at: r.createdAt,
          responses: (r.responses || []).map((x: any) => ({
            id: x.id, official_answer: x.officialAnswer, is_accepted: x.isAccepted, created_at: x.createdAt, responder_name: x.responderName,
          })),
        })));
        setCubeTests((d.cubeTests || []).map((c: any) => ({
          id: c.id,
          batch_reference: c.deliveryDocketNo || c.id,
          pour_date: c.pourDate,
          element_location: c.pourLocation,
          concrete_class: c.concreteClass,
          design_grade_mpa: Number(c.targetStrengthMpa ?? 0),
          supplier_name: c.supplierName,
          break_results: (c.breakResults || []).map((b: any) => ({
            id: b.id,
            age_days: b.breakAgeDays,
            failure_load_kn: 0,
            compressive_strength_mpa: Number(b.compressiveMpa ?? 0),
            is_pass: !!b.isPass,
            lab_name: b.labName,
          })),
        })));
        setInspections((d.inspections || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          category: i.inspectionType || String(i.checklistType || ''),
          scheduled_date: i.scheduledDate,
          status: i.status,
          location: i.location,
          inspector_name: i.inspectorName,
          items: (i.items || []).map((it: any) => ({
            id: it.id,
            item_description: it.checkPoint,
            is_compliant: it.result === 'PASS',
            notes: it.deficiencyNotes,
          })),
        })));
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || 'Failed to load portal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-sm text-slate-400">Loading portal…</div>;
  }
  if (loadError) {
    const isExpired = /expired/i.test(loadError);
    const isRevoked = /revoked|invalid/i.test(loadError);
    return (
      <div className="max-w-5xl mx-auto">
        <PortalLinkNotice kind={isExpired ? 'expired' : isRevoked ? 'revoked' : 'error'} message={loadError} />
        {onBackToDashboard && <div className="text-center pb-8"><button onClick={onBackToDashboard} className="text-xs text-blue-600 hover:underline">Back</button></div>}
      </div>
    );
  }

  const handleSendReply = async (rfiId: string) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/portals/consultant/${token}/rfis/${rfiId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          officialAnswer: replyText.trim(),
          consultantName: stakeholder.name,
          consultantBoraqsNo: stakeholder.role,
}),
});

      if (res.ok) {
        setFeedback('Official Consultant Answer recorded successfully.');
        setReplyText('');
        setSelectedRfi(null);
} else {
        const err = await res.json().catch(() => ({}));
        setFeedback(err.message || 'Failed to submit response. Please retry.');
}
} catch (e: any) {
      setFeedback(e.message || 'Network error — answer not submitted.');
} finally {
      setSubmitting(false);
}
};

  return (
<div className="max-w-5xl mx-auto space-y-6" data-testid="consultant-portal-view">
      <PortalExpiryBanner expiresAt={linkExpiresAt} />
      {/* Portal header */}
<header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-2">
<span className="text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
              Consultant Portal
</span>
<span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Secured project link
</span>
</div>
<h1 className="text-xl font-bold mt-2 text-white">{proj.name} ({proj.code})</h1>
<p className="text-xs text-slate-400">
            Welcome,<span className="text-slate-200 font-semibold">{stakeholder.name}</span> • {stakeholder.role}
</p>
</div>

<div className="flex items-center gap-3">
          {onBackToDashboard && (
<button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              ← Back to Project
</button>
)}
<div className="text-right hidden sm:block">
<p className="text-[11px] text-slate-400">Statutory Standard</p>
<p className="text-xs font-bold text-slate-200">BORAQS Cap 525 / KS 02-598</p>
</div>
</div>
</header>

      {/* Tabs */}
<div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
<button
          onClick={() => setActiveTab('rfis')}
          className={`pb-2 border-b-2 transition ${
            activeTab === 'rfis'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
}`}
        >
          Architectural & Structural RFIs ({rfis.length})
</button>
<button
          onClick={() => setActiveTab('cubes')}
          className={`pb-2 border-b-2 transition ${
            activeTab === 'cubes'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
}`}
        >
          Concrete Cube Strength Tests ({cubeTests.length})
</button>
<button
          onClick={() => setActiveTab('inspections')}
          className={`pb-2 border-b-2 transition ${
            activeTab === 'inspections'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
}`}
        >
          Pre-Pour QA Checklists ({inspections.length})
</button>
</div>

      {feedback && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center">
<span>{feedback}</span>
<button onClick={() => setFeedback(null)} className="text-emerald-600 font-bold ml-2">×</button>
</div>
)}

      {/* TAB 1: RFIs */}
      {activeTab === 'rfis' && (
<div className="space-y-4">
          {rfis.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8">No RFIs on this project yet.</p>
)}
          {rfis.map((rfi) => {
            const isAnswered = rfi.status === 'ANSWERED' || rfi.status === 'CLOSED';
            const isSelected = selectedRfi === rfi.id;

            return (
<div
                key={rfi.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
                data-testid={`consultant-rfi-${rfi.rfi_number}`}
              >
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div className="flex items-center gap-2">
<span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {rfi.rfi_number}
</span>
<span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {rfi.discipline}
</span>
<span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        rfi.urgency === 'BLOCKER'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : rfi.urgency === 'URGENT'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
}`}
                    >
                      {rfi.urgency}
</span>
</div>

<span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isAnswered
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
}`}
                  >
                    {isAnswered ? 'Answered' : 'Awaiting Official Response'}
</span>
</div>

<h3 className="text-sm font-bold text-slate-900">{rfi.title}</h3>
<p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                  {rfi.question}
</p>

                {/* Responses */}
                {rfi.responses && rfi.responses.length > 0 && (
<div className="mt-3 pl-3 border-l-2 border-emerald-500 space-y-2">
                    {rfi.responses.map((resp) => (
<div key={resp.id} className="text-xs text-slate-800 bg-emerald-50/60 p-2.5 rounded border border-emerald-100">
<p className="font-semibold text-emerald-900 mb-1">Official Consultant Instruction:</p>
<p className="whitespace-pre-wrap">{resp.official_answer}</p>
</div>
))}
</div>
)}

                {/* Reply Form */}
                {!isAnswered && (
<div className="pt-2">
                    {!isSelected ? (
<button
                        onClick={() => setSelectedRfi(rfi.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition"
                      >
                        Provide Official Consultant Answer
</button>
) : (
<div className="space-y-2 bg-purple-50/50 p-3 rounded-lg border border-purple-200">
<label className="block text-xs font-bold text-purple-900">
                          Official Instruction / Specification Detail:
</label>
<textarea
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="State exact rebar details, concrete cover, drawing reference, or material approval..."
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
<div className="flex gap-2 justify-end">
<button
                            type="button"
                            onClick={() => {
                              setSelectedRfi(null);
                              setReplyText('');
}}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                          >
                            Cancel
</button>
<button
                            type="button"
                            disabled={submitting || !replyText.trim()}
                            onClick={() => handleSendReply(rfi.id)}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg disabled:opacity-50 transition"
                          >
                            {submitting ? 'Submitting...' : 'Sign & Submit Answer'}
</button>
</div>
</div>
)}
</div>
)}
</div>
);
})}
</div>
)}

      {/* TAB 2: Concrete Cube Strength Tests */}
      {activeTab === 'cubes' && (
<div className="space-y-4">
<div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
<span>KS 02-598 &amp; BS EN 12390 Compliance: Compressive Strength (&sigma; = kN / 22.5) for 150 &times; 150 &times; 150 mm concrete cubes.</span>
<span className="font-bold text-slate-800">Area: 22,500 mm²</span>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cubeTests.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8 col-span-2">No concrete cube tests recorded yet.</p>
)}
            {cubeTests.map((c) => (
<div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
<div className="flex justify-between items-start">
<div>
<span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {c.batch_reference}
</span>
<h4 className="text-xs font-bold text-slate-900 mt-1">{c.element_location}</h4>
</div>
<span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    Target: Grade C{c.design_grade_mpa}
</span>
</div>

<div className="space-y-1.5 text-xs">
                  {c.break_results?.map((b) => (
<div
                      key={b.id}
                      className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200"
                    >
<div>
<span className="font-semibold text-slate-800">{b.age_days}-Day Crush:</span>{' '}
<span className="font-mono">{b.compressive_strength_mpa} MPa</span>
<span className="text-[10px] text-slate-500 ml-1">({b.failure_load_kn} kN)</span>
</div>
<span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          b.is_pass
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
}`}
                      >
                        {b.is_pass ? 'PASSED' : 'BELOW TARGET'}
</span>
</div>
))}
</div>
</div>
))}
</div>
</div>
)}

      {/* TAB 3: Pre-Pour QA */}
      {activeTab === 'inspections' && (
<div className="space-y-4">
          {inspections.length === 0 && (
<p className="text-sm text-slate-500 text-center py-8">No pre-pour inspections scheduled yet.</p>
)}
          {inspections.map((insp) => (
<div key={insp.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
<div className="flex justify-between items-center">
<div>
<h3 className="text-sm font-bold text-slate-900">{insp.title}</h3>
<p className="text-xs text-slate-500">Scheduled Date: {insp.scheduled_date} • Category: {insp.category}</p>
</div>
<span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {insp.status}
</span>
</div>

<div className="space-y-2 text-xs">
                {insp.items?.map((it) => (
<div key={it.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
<span className="text-emerald-600 font-bold text-sm"></span>
<span className="text-slate-800">{it.item_description}</span>
</div>
))}
</div>
</div>
))}
</div>
)}
</div>
);
}
