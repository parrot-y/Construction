import React, { useEffect, useMemo, useState } from 'react';
import { PROJECT_TYPE_CATEGORIES, type ProjectTypeCategory } from '@construction/validation';
import { api, apiErrorMessage } from '../lib/api';
import { InlineError } from './feedback/InlineError';

// ---------------------------------------------------------------------------
// New project — four short steps (type → subtype → details → terms), draft
// persisted to localStorage so closing the modal never loses typed data.
// Type drives only removable starter BoQ sections, milestones and checklists
// created server-side; nothing here is hard-coded per type.
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'sitesafi-new-project-draft';

interface Draft {
  step: number;
  projectType: string;
  projectSubtype: string;
  name: string;
  code: string;
  location: string;
  clientName: string;
  description: string;
  contractValue: string;
  contractCurrency: string;
  ncaProjectNo: string;
  startDate: string;
  targetEndDate: string;
  retentionRatePct: string;
  retentionCapPct: string;
  retentionFirstMoietyPct: string;
}

const EMPTY: Draft = {
  step: 0, projectType: '', projectSubtype: '', name: '', code: '', location: '',
  clientName: '', description: '', contractValue: '', contractCurrency: 'KES',
  ncaProjectNo: '', startDate: '', targetEndDate: '',
  retentionRatePct: '5', retentionCapPct: '5', retentionFirstMoietyPct: '50',
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch { return EMPTY; }
}

export default function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id?: string) => void }): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ncaHint, setNcaHint] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => {
      const next = { ...d, [k]: v };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* storage full/blocked — draft stays in memory */ }
      return next;
    });

  const category: ProjectTypeCategory | undefined = useMemo(
    () => PROJECT_TYPE_CATEGORIES.find((c) => c.key === draft.projectType),
    [draft.projectType],
  );

  // NCA hint from the editable rules table — shown only as a hint, never a
  // hard-coded limit.
  useEffect(() => {
    if (!category || !draft.contractValue) { setNcaHint(null); return; }
    const value = Number(draft.contractValue);
    if (!Number.isFinite(value) || value <= 0) { setNcaHint(null); return; }
    api.get<{ data?: { ncaRules?: any[] } }>('/api/v1/project-types')
      .then((j) => {
        const rules: any[] = j?.data?.ncaRules || [];
        for (const trade of category.ncaTrades) {
          const rule = rules
            .filter((r) => r.trade === trade)
            .find((r) => {
              const min = r.min_contract_value == null ? -Infinity : Number(r.min_contract_value);
              const max = r.max_contract_value == null ? Infinity : Number(r.max_contract_value);
              return value >= min && value < max;
            });
          if (rule) {
            setNcaHint(`${rule.class_label} likely needed (${trade}) — confirm current NCA limits.`);
            return;
          }
        }
        setNcaHint(null);
      })
      .catch(() => setNcaHint(null));
  }, [category, draft.contractValue]);

  const stepValid = (): boolean => {
    if (draft.step === 0) return !!draft.projectType;
    if (draft.step === 1) return draft.name.trim().length >= 2 && !!draft.code.trim();
    return true;
  };

  const next = () => { if (stepValid()) set('step', Math.min(3, draft.step + 1)); };
  const back = () => set('step', Math.max(0, draft.step - 1));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepValid()) { setError('Please complete the highlighted step first.'); return; }
    if (!draft.name.trim() || !draft.code.trim()) { setError('Name and project code are required.'); return; }
    setBusy(true); setError(null);
    try {
      const body = await api.post<{ data?: { id?: string }; id?: string }>('/api/v1/projects', {
        name: draft.name.trim(),
          code: draft.code.trim().toUpperCase(),
          location: draft.location.trim() || undefined,
          description: [draft.clientName.trim() && `Client: ${draft.clientName.trim()}`, draft.description.trim()].filter(Boolean).join(' — ') || undefined,
          contractValue: draft.contractValue.trim() || undefined,
          contractCurrency: draft.contractCurrency || 'KES',
          ncaProjectNo: draft.ncaProjectNo.trim() || undefined,
          startDate: draft.startDate || undefined,
          targetEndDate: draft.targetEndDate || undefined,
          projectType: draft.projectType || undefined,
          projectSubtype: draft.projectSubtype || undefined,
          retentionRatePct: draft.retentionRatePct || undefined,
          retentionCapPct: draft.retentionCapPct || undefined,
          retentionFirstMoietyPct: draft.retentionFirstMoietyPct || undefined,
      });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
      onCreated(body.data?.id || body.id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the project'));
      setBusy(false);
    }
  };

  const input = 'w-full px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-orange-500';
  const lbl = 'block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1';
  const STEPS = ['Type', 'Basics', 'Commercial', 'Team'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">New project</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
        </div>
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full ${i <= draft.step ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <p className={`text-xs mt-1 font-semibold ${i === draft.step ? 'text-orange-600' : 'text-slate-400'}`}>{label}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit}>
          {draft.step === 0 && (
            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {PROJECT_TYPE_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => { set('projectType', c.key); set('projectSubtype', ''); }}
                    className={`text-left px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
                      draft.projectType === c.key
                        ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {category && category.subtypes.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">What kind of {category.label.toLowerCase()} project is this?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.subtypes.map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => set('projectSubtype', st.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          draft.projectSubtype === st.key
                            ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => set('projectSubtype', '')}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        !draft.projectSubtype
                          ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      Decide later
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {draft.step === 1 && (
            <div className="space-y-3">
              <div>
                <label className={lbl} htmlFor="np-name">Project name *</label>
                <input id="np-name" className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kilimani Office Fit-Out" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} htmlFor="np-code">Project code *</label>
                  <input id="np-code" className={input} value={draft.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. KIL-001" />
                </div>
                <div>
                  <label className={lbl} htmlFor="np-location">Location</label>
                  <input id="np-location" className={input} value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Kilimani, Nairobi" />
                </div>
              </div>
              <div>
                <label className={lbl} htmlFor="np-client">Client name (optional)</label>
                <input id="np-client" className={input} value={draft.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="e.g. Acme Properties Ltd" />
              </div>
              <div>
                <label className={lbl} htmlFor="np-desc">Scope summary (optional)</label>
                <input id="np-desc" className={input} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description of the works" />
              </div>
            </div>
          )}

          {draft.step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl} htmlFor="np-ret">Retention %</label>
                  <input id="np-ret" className={input} inputMode="decimal" value={draft.retentionRatePct} onChange={(e) => set('retentionRatePct', e.target.value)} />
                </div>
                <div>
                  <label className={lbl} htmlFor="np-retcap">Retention cap %</label>
                  <input id="np-retcap" className={input} inputMode="decimal" value={draft.retentionCapPct} onChange={(e) => set('retentionCapPct', e.target.value)} />
                </div>
                <div>
                  <label className={lbl} htmlFor="np-moiety">First release %</label>
                  <input id="np-moiety" className={input} inputMode="decimal" value={draft.retentionFirstMoietyPct} onChange={(e) => set('retentionFirstMoietyPct', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={lbl} htmlFor="np-value">Contract value (KES)</label>
                  <input id="np-value" className={input} inputMode="decimal" value={draft.contractValue} onChange={(e) => set('contractValue', e.target.value)} placeholder="e.g. 84500000" />
                </div>
                <div>
                  <label className={lbl} htmlFor="np-currency">Currency</label>
                  <select id="np-currency" className={input} value={draft.contractCurrency} onChange={(e) => set('contractCurrency', e.target.value)}>
                    <option value="KES">KES</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              {ncaHint && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{ncaHint}</p>}
              <div>
                <label className={lbl} htmlFor="np-nca">NCA project no. (optional)</label>
                <input id="np-nca" className={input} value={draft.ncaProjectNo} onChange={(e) => set('ncaProjectNo', e.target.value)} placeholder="NCA-PRJ-2026-XXXX" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} htmlFor="np-start">Start date</label>
                  <input type="date" id="np-start" className={input} value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </div>
                <div>
                  <label className={lbl} htmlFor="np-end">Target end</label>
                  <input type="date" id="np-end" className={input} value={draft.targetEndDate} onChange={(e) => set('targetEndDate', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Retention is withheld from each payment certificate. Deposit / advance is set as a percentage on the quote when you send it.
              </p>
            </div>
          )}

          {draft.step === 3 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">Team</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You are added as project lead automatically. Invite the rest of the team from People → Team after creating the project — or skip this step and invite later.
                </p>
              </div>
            </div>
          )}

          {error && <InlineError error={error} className="mt-3" />}
          <div className="flex justify-between gap-2 pt-4">
            <button type="button" onClick={draft.step === 0 ? onClose : back} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              {draft.step === 0 ? 'Cancel' : 'Back'}
            </button>
            {draft.step < 3 ? (
              <button type="button" onClick={next} disabled={!stepValid()} className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
                Continue
              </button>
            ) : (
              <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
                {busy ? 'Creating…' : 'Create project'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
