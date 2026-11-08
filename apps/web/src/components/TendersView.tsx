import React, { useCallback, useEffect, useState } from 'react';

interface Tender {
  id: string; tenderCode: string; title: string; tradeCategory?: string;
  scopeOfWork: string; budgetKes: string; durationWeeks: number;
  submissionDeadline: string; status: string; awardedBidId?: string | null; bidsCount: number;
}
interface Bid {
  id: string; contractorName: string; contractorNcaCategory: string;
  amountKes: string; durationWeeks: number; technicalScore: number;
  financialScore: number; combinedScore: number; rank: number;
  bidStatus: string; proposalNotes?: string | null; submittedAt: string;
}
interface ProjectOpt { id: string; name: string; code: string }

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PUBLISHED: 'bg-sky-50 text-sky-700',
  UNDER_EVALUATION: 'bg-amber-50 text-amber-700',
  AWARDED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-rose-50 text-rose-600',
};
const fmt = (n: string | number) => `KES ${Number(n).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

export default function TendersView({ projectId, canManage = true }: { projectId?: string; canManage?: boolean }): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [pid, setPid] = useState(projectId || '');
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bids, setBids] = useState<Record<string, Bid[]>>({});
  const [showTenderForm, setShowTenderForm] = useState(false);
  const [showBidForm, setShowBidForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tForm, setTForm] = useState({ tenderCode: '', title: '', tradeCategory: '', scopeOfWork: '', budgetKes: '', durationWeeks: '24', submissionDeadline: '' });
  const [bForm, setBForm] = useState({ contractorName: '', contractorNcaCategory: 'NCA 4', amountKes: '', durationWeeks: '12', technicalScore: '70', proposalNotes: '' });

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
    if (!pid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/tenders`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load tenders');
      setTenders(await res.json());
    } catch (err: any) {
      setError(err?.message || 'Load failed');
      setTenders([]);
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!bids[id]) {
      try {
        const res = await fetch(`/api/v1/projects/${pid}/tenders/${id}/bids`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setBids((prev) => ({ ...prev, [id]: json.bids || json.data || [] }));
        }
      } catch { /* leave empty */ }
    }
  };

  const createTender = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/tenders`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderCode: tForm.tenderCode || undefined,
          title: tForm.title,
          tradeCategory: tForm.tradeCategory || undefined,
          scopeOfWork: tForm.scopeOfWork,
          budgetKes: tForm.budgetKes || undefined,
          durationWeeks: Number(tForm.durationWeeks) || 24,
          submissionDeadline: new Date(tForm.submissionDeadline).toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowTenderForm(false);
      setTForm({ tenderCode: '', title: '', tradeCategory: '', scopeOfWork: '', budgetKes: '', durationWeeks: '24', submissionDeadline: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const submitBid = async (tenderId: string) => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/tenders/${tenderId}/bids`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: bForm.contractorName,
          contractorNcaCategory: bForm.contractorNcaCategory,
          amountKes: bForm.amountKes,
          durationWeeks: Number(bForm.durationWeeks) || 12,
          technicalScore: Number(bForm.technicalScore) || 70,
          proposalNotes: bForm.proposalNotes || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowBidForm(null);
      setBids((prev) => { const next = { ...prev }; delete next[tenderId]; return next; });
      setExpanded(tenderId);
      await toggle(tenderId); // refetch bids
      await load();
    } catch (err: any) {
      setError(err?.message || 'Bid failed');
    } finally {
      setSaving(false);
    }
  };

  const award = async (tenderId: string, bidId: string) => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${pid}/tenders/${tenderId}/bids/${bidId}/award`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awardReason: 'Best combined score — technical & financial evaluation' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      await load();
      await toggle(tenderId);
    } catch (err: any) {
      setError(err?.message || 'Award failed');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Subcontractor Tenders & Bids</h3>
          <p className="text-xs text-slate-500">Package tenders, scored bid evaluation (70% technical / 30% financial), award</p>
        </div>
        <div className="flex items-center gap-2">
          {!projectId && (
            <select value={pid} onChange={(e) => setPid(e.target.value)} className={`${input} max-w-[180px]`}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          )}
          {canManage && (
            <button onClick={() => setShowTenderForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              {showTenderForm ? 'Cancel' : '+ Post tender'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showTenderForm && canManage && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1"><span className={label}>Tender code</span>
            <input value={tForm.tenderCode} onChange={(e) => setTForm({ ...tForm, tenderCode: e.target.value })} placeholder="TND-001 (auto if blank)" className={input} /></label>
          <label className="space-y-1"><span className={label}>Title *</span>
            <input value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} placeholder="e.g. Block A tiling & waterproofing" className={input} /></label>
          <label className="space-y-1"><span className={label}>Trade category</span>
            <input value={tForm.tradeCategory} onChange={(e) => setTForm({ ...tForm, tradeCategory: e.target.value })} placeholder="Tiling, MEP, Finishes…" className={input} /></label>
          <label className="space-y-1"><span className={label}>Budget (KES)</span>
            <input value={tForm.budgetKes} onChange={(e) => setTForm({ ...tForm, budgetKes: e.target.value })} placeholder="e.g. 2500000" className={input} /></label>
          <label className="space-y-1"><span className={label}>Duration (weeks)</span>
            <input type="number" value={tForm.durationWeeks} onChange={(e) => setTForm({ ...tForm, durationWeeks: e.target.value })} className={input} /></label>
          <label className="space-y-1"><span className={label}>Submission deadline *</span>
            <input type="date" value={tForm.submissionDeadline} onChange={(e) => setTForm({ ...tForm, submissionDeadline: e.target.value })} className={input} /></label>
          <label className="sm:col-span-2 space-y-1"><span className={label}>Scope of work *</span>
            <textarea value={tForm.scopeOfWork} onChange={(e) => setTForm({ ...tForm, scopeOfWork: e.target.value })} rows={3}
              placeholder="Quantities, specs, programme constraints…" className={input} /></label>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={() => void createTender()} disabled={saving || tForm.title.length < 3 || tForm.scopeOfWork.length < 5 || !tForm.submissionDeadline}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Posting…' : 'Post tender'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-6">Loading tenders…</p>
      ) : tenders.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No tenders posted{canManage ? ' — post the first package' : ''}.</p>
      ) : (
        <div className="space-y-2">
          {tenders.map((t) => (
            <div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => void toggle(t.id)} className="w-full text-left p-3.5 hover:bg-slate-50 transition">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">
                      <span className="font-mono text-indigo-600">{t.tenderCode}</span> — {t.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {t.tradeCategory || 'General'} · Budget {fmt(t.budgetKes)} · {t.durationWeeks}w · due {new Date(t.submissionDeadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500">{t.bidsCount} bid{t.bidsCount === 1 ? '' : 's'}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_STYLE[t.status] || 'bg-slate-100 text-slate-600'}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </button>

              {expanded === t.id && (
                <div className="border-t border-slate-100 p-3.5 space-y-3 bg-slate-50/40">
                  <p className="text-[11px] text-slate-600 leading-relaxed">{t.scopeOfWork}</p>

                  {(bids[t.id] || []).length === 0 ? (
                    <p className="text-[11px] text-slate-400">No bids submitted yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-200">
                            <th className="py-1.5 pr-3">#</th><th className="pr-3">Contractor</th><th className="pr-3">NCA</th>
                            <th className="pr-3">Amount</th><th className="pr-3">Weeks</th><th className="pr-3">Tech</th>
                            <th className="pr-3">Fin</th><th className="pr-3">Combined</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(bids[t.id] || []).map((b) => (
                            <tr key={b.id} className="border-b border-slate-100 last:border-0">
                              <td className="py-1.5 pr-3 font-bold text-slate-500">{b.rank || '—'}</td>
                              <td className="pr-3 font-semibold text-slate-800">{b.contractorName}</td>
                              <td className="pr-3 text-slate-500">{b.contractorNcaCategory}</td>
                              <td className="pr-3 font-mono">{fmt(b.amountKes)}</td>
                              <td className="pr-3">{b.durationWeeks}</td>
                              <td className="pr-3">{Number(b.technicalScore).toFixed(0)}</td>
                              <td className="pr-3">{Number(b.financialScore).toFixed(0)}</td>
                              <td className="pr-3 font-bold text-indigo-700">{Number(b.combinedScore).toFixed(1)}</td>
                              <td className="text-right">
                                {canManage && t.status !== 'AWARDED' && t.status === 'PUBLISHED' && (
                                  <button onClick={() => void award(t.id, b.id)} disabled={saving}
                                    className="px-2 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                                    Award
                                  </button>
                                )}
                                {t.awardedBidId === b.id && <span className="px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">AWARDED</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {canManage && t.status === 'PUBLISHED' && (
                    <div>
                      {showBidForm === t.id ? (
                        <div className="border border-slate-200 bg-white rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <input value={bForm.contractorName} onChange={(e) => setBForm({ ...bForm, contractorName: e.target.value })} placeholder="Contractor name *" className={input} />
                          <input value={bForm.contractorNcaCategory} onChange={(e) => setBForm({ ...bForm, contractorNcaCategory: e.target.value })} placeholder="NCA category" className={input} />
                          <input value={bForm.amountKes} onChange={(e) => setBForm({ ...bForm, amountKes: e.target.value })} placeholder="Bid amount KES *" className={input} />
                          <input type="number" value={bForm.durationWeeks} onChange={(e) => setBForm({ ...bForm, durationWeeks: e.target.value })} placeholder="Duration weeks" className={input} />
                          <input type="number" value={bForm.technicalScore} onChange={(e) => setBForm({ ...bForm, technicalScore: e.target.value })} placeholder="Technical score 0-100" className={input} />
                          <input value={bForm.proposalNotes} onChange={(e) => setBForm({ ...bForm, proposalNotes: e.target.value })} placeholder="Proposal notes" className={input} />
                          <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
                            <button onClick={() => setShowBidForm(null)} className="px-3 py-1 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
                            <button onClick={() => void submitBid(t.id)} disabled={saving || bForm.contractorName.length < 2 || !bForm.amountKes}
                              className="px-3 py-1 text-[11px] font-semibold text-white bg-indigo-600 rounded-lg disabled:opacity-50">
                              {saving ? 'Submitting…' : 'Submit bid'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowBidForm(t.id)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                          + Record subcontractor bid
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
