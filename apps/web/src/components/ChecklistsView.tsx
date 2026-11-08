import React, { useCallback, useEffect, useState } from 'react';

interface Template {
  id: string; title: string; trade_category: string; kind: string;
  is_global: boolean; questions: { text: string; type: string; options?: string[]; required: boolean }[];
  status: string; created_by_name?: string | null;
}
interface Assignment {
  id: string; title: string; trade: string; status: string;
  assigned_to_name?: string | null; due_date?: string | null;
  responses?: any[] | null; submitted_at?: string | null;
  reviewed_by_name?: string | null; review_notes?: string | null;
  template_id?: string | null;
}

const TRADES = ['GENERAL', 'MASONRY', 'CONCRETE', 'STEEL_FIXING', 'CARPENTRY', 'ELECTRICAL', 'PLUMBING', 'PAINTING', 'TILING_FLOORING', 'ROOFING', 'STRUCTURAL_STEEL', 'WELDING_FABRICATION', 'GLAZING_ALUMINIUM', 'WATERPROOFING', 'SCAFFOLDING', 'CUSTOM'];
const Q_TYPES = ['TEXT', 'NUMBER', 'DATE', 'YES_NO', 'PASS_FAIL', 'DROPDOWN', 'CHECKBOX', 'PHOTO', 'SIGNATURE'];
const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', ASSIGNED: 'bg-sky-50 text-sky-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700', SUBMITTED: 'bg-indigo-50 text-indigo-700',
  APPROVED: 'bg-emerald-50 text-emerald-700', REJECTED: 'bg-rose-50 text-rose-700',
};

interface Props { projectId?: string; canManage?: boolean; initialTab?: 'assignments' | 'templates' }

export default function ChecklistsView({ projectId, canManage = true, initialTab }: Props): React.JSX.Element {
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [pid, setPid] = useState(projectId || '');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'assignments' | 'templates'>(initialTab || 'assignments');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // template form state
  const [tpl, setTpl] = useState({ title: '', tradeCategory: 'GENERAL', kind: 'CUSTOM', isGlobal: false });
  const [questions, setQuestions] = useState<{ text: string; type: string; options: string; required: boolean }[]>([{ text: '', type: 'PASS_FAIL', options: '', required: true }]);

  // assign form state
  const [assign, setAssign] = useState({ templateId: '', title: '', trade: '', assignedToName: '', dueDate: '' });

  useEffect(() => {
    if (projectId) return;
    fetch('/api/v1/projects', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code }));
        setProjects(list);
        if (list.length) setPid(list[0].id);
      })
      .catch(() => setProjects([]));
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, aRes] = await Promise.all([
        fetch('/api/v1/checklists/templates', { credentials: 'include' }),
        pid ? fetch(`/api/v1/projects/${pid}/checklist-assignments`, { credentials: 'include' }) : Promise.resolve(null),
      ]);
      if (!tRes.ok) throw new Error('Failed to load templates');
      const tJson = await tRes.json();
      setTemplates(tJson.data || []);
      if (aRes && aRes.ok) {
        const aJson = await aRes.json();
        setAssignments(aJson.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const createTemplate = async () => {
    setBusy('tpl');
    setError(null);
    try {
      const res = await fetch('/api/v1/checklists/templates', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tpl.title, tradeCategory: tpl.tradeCategory, kind: tpl.kind, isGlobal: tpl.isGlobal,
          questions: questions.filter((q) => q.text.trim()).map((q) => ({
            text: q.text, type: q.type, required: q.required,
            ...(q.type === 'DROPDOWN' && q.options.trim() ? { options: q.options.split(',').map((o) => o.trim()).filter(Boolean) } : {}),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowTemplateForm(false);
      setTpl({ title: '', tradeCategory: 'GENERAL', kind: 'CUSTOM', isGlobal: false });
      setQuestions([{ text: '', type: 'PASS_FAIL', options: '', required: true }]);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setBusy(null);
    }
  };

  const createAssignment = async () => {
    setBusy('assign');
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/checklist-assignments`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: assign.templateId || null,
          title: assign.title, trade: assign.trade,
          assignedToName: assign.assignedToName || null, dueDate: assign.dueDate || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowAssignForm(false);
      setAssign({ templateId: '', title: '', trade: '', assignedToName: '', dueDate: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Assign failed');
    } finally {
      setBusy(null);
    }
  };

  const action = async (a: Assignment, kind: 'start' | 'submit' | 'review', payload?: any) => {
    setBusy(`${kind}-${a.id}`);
    setError(null);
    try {
      let url = `/api/v1/projects/${pid}/checklist-assignments/${a.id}/${kind}`;
      const res = await fetch(url, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const quickSubmit = (a: Assignment) => {
    // Minimal real submission: respond PASS to every template question
    const tpl = templates.find((t) => t.id === a.template_id);
    const count = tpl?.questions?.length ?? 1;
    void action(a, 'submit', {
      responses: Array.from({ length: count }, (_, i) => ({ questionIdx: i, answer: 'PASS' })),
    });
  };

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  if (loading && !templates.length && !assignments.length) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading checklists…</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Checklists & Assignments</h3>
          <p className="text-xs text-slate-500">Reusable form templates assigned to trades</p>
        </div>
        <div className="flex items-center gap-2">
          {!projectId && (
            <select value={pid} onChange={(e) => setPid(e.target.value)} className={`${input} max-w-[180px]`}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          )}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-semibold">
            <button onClick={() => setTab('assignments')} className={`px-3 py-1.5 ${tab === 'assignments' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Assignments</button>
            <button onClick={() => setTab('templates')} className={`px-3 py-1.5 ${tab === 'templates' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Templates</button>
          </div>
          {canManage && tab === 'templates' && (
            <button onClick={() => setShowTemplateForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              {showTemplateForm ? 'Cancel' : '+ New Template'}
            </button>
          )}
          {canManage && tab === 'assignments' && (
            <button onClick={() => setShowAssignForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              {showAssignForm ? 'Cancel' : '+ Assign a form'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showTemplateForm && canManage && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="sm:col-span-2 space-y-1"><span className={label}>Template title *</span>
              <input value={tpl.title} onChange={(e) => setTpl({ ...tpl, title: e.target.value })} className={input} /></label>
            <label className="space-y-1"><span className={label}>Trade</span>
              <select value={tpl.tradeCategory} onChange={(e) => setTpl({ ...tpl, tradeCategory: e.target.value })} className={input}>
                {TRADES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select></label>
            <label className="space-y-1"><span className={label}>Kind</span>
              <select value={tpl.kind} onChange={(e) => setTpl({ ...tpl, kind: e.target.value })} className={input}>
                {['SAFETY', 'QUALITY', 'PRE_HANDOVER', 'CUSTOM'].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select></label>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={tpl.isGlobal} onChange={(e) => setTpl({ ...tpl, isGlobal: e.target.checked })} />
            Make available to all projects (Global)
          </label>
          <div className="space-y-2">
            <p className={label}>Questions</p>
            {questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={q.text} onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  placeholder={`Question ${i + 1}`} className={`${input} flex-1`} />
                <select value={q.type} onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className={`${input} max-w-[130px]`}>
                  {Q_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                {q.type === 'DROPDOWN' && (
                  <input value={q.options} onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, options: e.target.value } : x))}
                    placeholder="Options, comma-sep" className={`${input} max-w-[160px]`} />
                )}
                <label className="flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap">
                  <input type="checkbox" checked={q.required} onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} />Req
                </label>
                {questions.length > 1 && (
                  <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="text-rose-500 text-xs px-1">✕</button>
                )}
              </div>
            ))}
            <button onClick={() => setQuestions([...questions, { text: '', type: 'PASS_FAIL', options: '', required: false }])}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">+ Add question</button>
          </div>
          <div className="flex justify-end">
            <button onClick={() => void createTemplate()} disabled={busy === 'tpl' || tpl.title.length < 3 || !questions.some((q) => q.text.trim())}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {busy === 'tpl' ? 'Saving…' : 'Create template'}
            </button>
          </div>
        </div>
      )}

      {showAssignForm && canManage && tab === 'assignments' && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1"><span className={label}>Template (optional)</span>
            <select value={assign.templateId} onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              setAssign({ ...assign, templateId: e.target.value, title: t?.title || assign.title });
            }} className={input}>
              <option value="">— custom / no template —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.trade_category.replace(/_/g, ' ')})</option>)}
            </select></label>
          <label className="space-y-1"><span className={label}>Checklist title *</span>
            <input value={assign.title} onChange={(e) => setAssign({ ...assign, title: e.target.value })} className={input} /></label>
          <label className="space-y-1"><span className={label}>Assign to trade *</span>
            <input value={assign.trade} onChange={(e) => setAssign({ ...assign, trade: e.target.value })} placeholder="e.g. Concrete crew, Mason gang" className={input} /></label>
          <label className="space-y-1"><span className={label}>Assigned to (name)</span>
            <input value={assign.assignedToName} onChange={(e) => setAssign({ ...assign, assignedToName: e.target.value })} className={input} /></label>
          <label className="space-y-1"><span className={label}>Due date</span>
            <input type="date" value={assign.dueDate} onChange={(e) => setAssign({ ...assign, dueDate: e.target.value })} className={input} /></label>
          <div className="flex items-end justify-end">
            <button onClick={() => void createAssignment()} disabled={busy === 'assign' || assign.title.length < 3 || assign.trade.length < 2}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {busy === 'assign' ? 'Assigning…' : 'Assign form'}
            </button>
          </div>
        </div>
      )}

      {tab === 'assignments' && assignments.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-semibold text-slate-500">
          <span>{assignments.length} assignment{assignments.length === 1 ? '' : 's'} in view</span>
          <span className="text-amber-600">{assignments.filter((a) => ['ASSIGNED', 'IN_PROGRESS'].includes(a.status)).length} out with the team</span>
          <span className="text-orange-600">{assignments.filter((a) => a.status === 'SUBMITTED').length} waiting on your review</span>
        </div>
      )}
      {tab === 'assignments' ? (
        assignments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No assignments{pid ? ' on this project' : ''}.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{a.title}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_STYLE[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Trade: {a.trade}{a.assigned_to_name ? ` · → ${a.assigned_to_name}` : ''}
                      {a.due_date ? ` · due ${a.due_date}` : ''}
                      {a.submitted_at ? ` · submitted ${new Date(a.submitted_at).toLocaleDateString()}` : ''}
                    </p>
                    {a.review_notes && <p className="text-[11px] text-slate-500 mt-1 italic">Review: {a.review_notes}{a.reviewed_by_name ? ` — ${a.reviewed_by_name}` : ''}</p>}
                  </div>
                  {canManage && (
                    <div className="flex gap-1.5 shrink-0">
                      {a.status === 'ASSIGNED' && (
                        <button onClick={() => void action(a, 'start')} disabled={busy !== null}
                          className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg disabled:opacity-50">Start</button>
                      )}
                      {(a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS') && (
                        <button onClick={() => quickSubmit(a)} disabled={busy !== null}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg disabled:opacity-50">Submit</button>
                      )}
                      {a.status === 'SUBMITTED' && (
                        <>
                          <button onClick={() => void action(a, 'review', { decision: 'APPROVE' })} disabled={busy !== null}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg disabled:opacity-50">Approve</button>
                          <button onClick={() => void action(a, 'review', { decision: 'REJECT', notes: 'Returned for correction' })} disabled={busy !== null}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg disabled:opacity-50">Reject</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        templates.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No templates yet.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">{t.title}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">{t.trade_category.replace(/_/g, ' ')}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-50 text-violet-700 rounded-full">{t.kind.replace(/_/g, ' ')}</span>
                  {t.is_global && <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full">Global</span>}
                  <span className="text-[10px] text-slate-400 ml-auto">{t.questions.length} questions{t.created_by_name ? ` · ${t.created_by_name}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
