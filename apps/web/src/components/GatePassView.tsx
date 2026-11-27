import React, { useCallback, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { Modal, EmptyState, ErrorState } from '../ui';
import { InlineError } from './feedback/InlineError';
import { hasPermission, Permissions, type Role } from '@construction/permissions';
import { useToast } from './feedback/Toast';
import { useAppDialog } from './AppDialog';

// CB3 — gate pass register: material-exit authorization. A pass is created
// PENDING, authorized by a COST_APPROVE role, then confirmed EXITED at the
// gate with vehicle + timestamp recorded.

export interface GatePassItem { description: string; unit: string; quantity: string }
export interface GatePass {
  id: string;
  passNumber: string;
  projectId?: string | null;
  projectName?: string | null;
  storeLocation?: string | null;
  issuedToName: string;
  issuedToPhone?: string | null;
  destination?: string | null;
  vehicleRegistration?: string | null;
  purpose?: string | null;
  items: GatePassItem[];
  status: 'PENDING' | 'AUTHORIZED' | 'EXITED' | 'CANCELLED';
  authorizedBy?: string | null;
  authorizedAt?: string | null;
  exitedAt?: string | null;
  exitConfirmedBy?: string | null;
  cancelReason?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface PageMeta { page: number; limit: number; hasMore: boolean; nextPage: number | null }

const input = 'w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100';
const label = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  AUTHORIZED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  EXITED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  CANCELLED: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

interface DraftLine { description: string; unit: string; quantity: string }
const emptyLine = (): DraftLine => ({ description: '', unit: 'No', quantity: '1' });

export const GatePassView: React.FC<{ role?: string; projects?: { id: string; name: string }[] }> = ({ role = 'COMPANY_ADMIN', projects = [] }) => {
  const toast = useToast();
  const dialog = useAppDialog();
  const canCreate = hasPermission((role || 'VIEWER') as Role, Permissions.COST_CREATE);
  const canApprove = hasPermission((role || 'VIEWER') as Role, Permissions.COST_APPROVE);

  const [passes, setPasses] = useState<GatePass[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    projectId: '', storeLocation: '', issuedToName: '', issuedToPhone: '',
    destination: '', vehicleRegistration: '', purpose: '', notes: '',
  });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (q.trim()) params.set('q', q.trim());
      const json = await api.get<{ passes: GatePass[]; page: PageMeta }>(`/api/v1/gate-passes?${params}`);
      setPasses(json.passes ?? []);
      setPageMeta(json.page ?? null);
      setPage(p);
    } catch (err) {
      setError(err);
      setPasses([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q, page]);

  useEffect(() => { void load(1); }, [statusFilter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const createPass = async () => {
    const items = lines.filter((l) => l.description.trim());
    if (!form.issuedToName.trim() || items.length === 0) {
      setFormError('Issued-to name and at least one item are required.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      await api.post('/api/v1/gate-passes', {
        projectId: form.projectId || null,
        storeLocation: form.storeLocation.trim() || null,
        issuedToName: form.issuedToName.trim(),
        issuedToPhone: form.issuedToPhone.trim() || null,
        destination: form.destination.trim() || null,
        vehicleRegistration: form.vehicleRegistration.trim() || null,
        purpose: form.purpose.trim() || null,
        items: items.map((l) => ({ description: l.description.trim(), unit: l.unit.trim() || 'No', quantity: l.quantity || '1' })),
        notes: form.notes.trim() || null,
      });
      toast.success('Gate pass created — pending authorization.');
      setCreating(false);
      setForm({ projectId: '', storeLocation: '', issuedToName: '', issuedToPhone: '', destination: '', vehicleRegistration: '', purpose: '', notes: '' });
      setLines([emptyLine()]);
      void load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not create the gate pass.'));
    } finally {
      setFormBusy(false);
    }
  };

  const act = async (p: GatePass, action: 'authorize' | 'exit' | 'cancel') => {
    const labels = { authorize: 'Authorize', exit: 'Confirm exit', cancel: 'Cancel pass' };
    const ok = await dialog.confirm({
      title: `${labels[action]} — ${p.passNumber}`,
      message: action === 'exit'
        ? `Confirm ${p.issuedToName} is exiting with the listed materials?`
        : action === 'authorize'
          ? `Authorize ${p.passNumber} for ${p.issuedToName}?`
          : `Cancel gate pass ${p.passNumber}?`,
      confirmLabel: labels[action],
      danger: action === 'cancel',
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await api.post(`/api/v1/gate-passes/${p.id}/${action}`, {});
      toast.success(`Gate pass ${p.passNumber} ${action === 'authorize' ? 'authorized' : action === 'exit' ? 'marked exited' : 'cancelled'}.`);
      void load();
    } catch (err) {
      toast.error(err, `Could not ${action} the pass.`);
    } finally {
      setBusyId(null);
    }
  };

  const statusChips = ['', 'PENDING', 'AUTHORIZED', 'EXITED', 'CANCELLED'];

  return (
    <div className="space-y-4" data-testid="gate-pass-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Gate passes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Material-exit authorization register — authorize, then confirm exit at the gate.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setCreating(true)}
            className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700"
            data-testid="gate-pass-new">+ New gate pass</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pass no, person, vehicle, destination…"
          className={`${input} max-w-xs`} data-testid="gate-pass-search" />
        <div className="flex gap-1">
          {statusChips.map((s) => (
            <button key={s || 'all'} type="button" onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${statusFilter === s ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {s ? s[0] + s.slice(1).toLowerCase() : 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading gate passes…</p>
      ) : error ? (
        <ErrorState message={apiErrorMessage(error, 'Failed to load gate passes.')} onRetry={() => void load()} />
      ) : passes.length === 0 ? (
        <EmptyState title="No gate passes" hint="Create a pass to authorize material leaving the site or store." />
      ) : (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Pass</th>
                <th className="px-4 py-3">Issued to</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Authorized</th>
                <th className="px-4 py-3">Exited</th>
                {(canCreate || canApprove) && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {passes.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40" data-testid={`gate-pass-row-${p.id}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{p.passNumber}</p>
                    <p className="text-[11px] text-slate-400">{fmtDateTime(p.createdAt)}{p.projectName ? ` · ${p.projectName}` : ''}{p.storeLocation ? ` · ${p.storeLocation}` : ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {p.issuedToName}
                    {p.issuedToPhone && <p className="text-[11px] text-slate-400">{p.issuedToPhone}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{p.destination || p.purpose || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{p.vehicleRegistration || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[220px] truncate" title={p.items.map((i) => `${i.description} (${i.quantity} ${i.unit})`).join(', ')}>
                    {p.items.map((i) => i.description).join(', ')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[p.status] ?? ''}`}>{p.status[0] + p.status.slice(1).toLowerCase()}</span>
                    {p.status === 'CANCELLED' && p.cancelReason && <p className="text-[10px] text-slate-400 mt-0.5">{p.cancelReason}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(p.authorizedAt)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(p.exitedAt)}</td>
                  {(canCreate || canApprove) && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {p.status === 'PENDING' && canApprove && (
                        <button type="button" disabled={busyId === p.id} onClick={() => void act(p, 'authorize')} className="text-xs font-bold text-sky-700 hover:underline mr-3" data-testid={`gate-pass-authorize-${p.id}`}>Authorize</button>
                      )}
                      {p.status === 'AUTHORIZED' && canCreate && (
                        <button type="button" disabled={busyId === p.id} onClick={() => void act(p, 'exit')} className="text-xs font-bold text-emerald-700 hover:underline mr-3" data-testid={`gate-pass-exit-${p.id}`}>Confirm exit</button>
                      )}
                      {(p.status === 'PENDING' || p.status === 'AUTHORIZED') && canApprove && (
                        <button type="button" disabled={busyId === p.id} onClick={() => void act(p, 'cancel')} className="text-xs font-bold text-rose-600 hover:underline" data-testid={`gate-pass-cancel-${p.id}`}>Cancel</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageMeta && (pageMeta.page > 1 || pageMeta.hasMore) && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {pageMeta.page}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pageMeta.page <= 1} onClick={() => void load(pageMeta.page - 1)} className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40">Previous</button>
            <button type="button" disabled={!pageMeta.hasMore} onClick={() => void load(pageMeta.page + 1)} className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New gate pass" wide>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className={`${label} col-span-2 sm:col-span-1`}>
            Project
            <select className={input} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} data-testid="gate-pass-form-project">
              <option value="">— company / store —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={label}>
            Store location
            <input className={input} value={form.storeLocation} onChange={(e) => setForm({ ...form, storeLocation: e.target.value })} placeholder="Nairobi Main Store" data-testid="gate-pass-form-store" />
          </label>
          <label className={label}>
            Issued to *
            <input className={input} value={form.issuedToName} onChange={(e) => setForm({ ...form, issuedToName: e.target.value })} placeholder="Driver / recipient name" data-testid="gate-pass-form-issued-to" />
          </label>
          <label className={label}>
            Phone
            <input className={input} value={form.issuedToPhone} onChange={(e) => setForm({ ...form, issuedToPhone: e.target.value })} placeholder="+254…" />
          </label>
          <label className={label}>
            Destination
            <input className={input} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Site / client address" data-testid="gate-pass-form-destination" />
          </label>
          <label className={label}>
            Vehicle registration
            <input className={input} value={form.vehicleRegistration} onChange={(e) => setForm({ ...form, vehicleRegistration: e.target.value })} placeholder="KDA 123X" data-testid="gate-pass-form-vehicle" />
          </label>
          <label className={`${label} col-span-2 sm:col-span-3`}>
            Purpose
            <input className={input} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Foundation pour materials" />
          </label>
        </div>

        <p className="text-[11px] font-semibold text-slate-500 mt-4 mb-2">Materials leaving</p>
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <input className="col-span-6 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" placeholder="Item description"
                value={l.description} onChange={(e) => setLine(idx, { description: e.target.value })} data-testid={`gate-pass-item-desc-${idx}`} />
              <input className="col-span-2 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" placeholder="Unit"
                value={l.unit} onChange={(e) => setLine(idx, { unit: e.target.value })} />
              <input className="col-span-3 px-2 py-1.5 text-sm border border-slate-300 rounded-lg" type="number" min="0" step="any" placeholder="Qty"
                value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
              <button type="button" className="col-span-1 text-xs text-rose-600 font-bold" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} disabled={lines.length === 1}>✕</button>
            </div>
          ))}
          <button type="button" className="text-xs font-bold text-brand-700" onClick={() => setLines((prev) => [...prev, emptyLine()])} data-testid="gate-pass-add-item">+ Add item</button>
        </div>

        <label className={`${label} mt-4`}>
          Notes
          <input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>

        {formError && <InlineError error={formError} className="mt-3" />}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Cancel</button>
          <button type="button" onClick={() => void createPass()} disabled={formBusy}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 disabled:opacity-60" data-testid="gate-pass-save">
            {formBusy ? 'Creating…' : 'Create pass'}
          </button>
        </div>
      </Modal>

      {dialog.element}
    </div>
  );
};

export default GatePassView;
