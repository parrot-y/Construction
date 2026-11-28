import React, { useCallback, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { Modal, EmptyState, ErrorState } from '../ui';
import { InlineError } from './feedback/InlineError';
import { hasPermission, Permissions, type Role } from '@construction/permissions';
import { useToast } from './feedback/Toast';
import { useAppDialog } from './AppDialog';

// CB5 — contractor master: tenant-level register of subcontractor firms
// (KRA PIN, work categories, approval status). Only APPROVED firms can be
// linked to project work packages.

export interface ContractorFirm {
  id: string;
  firmName: string;
  kraPin?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  workCategories: string[];
  approvalStatus: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'BLACKLISTED';
  approvedBy?: string | null;
  approvedAt?: string | null;
  statusReason?: string | null;
  notes?: string | null;
  isActive: boolean;
  packageCount?: number;
  createdAt?: string;
}

interface PageMeta { page: number; limit: number; hasMore: boolean; nextPage: number | null }

const input = 'w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100';
const label = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  BLACKLISTED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  SUSPENDED: 'Suspended',
  BLACKLISTED: 'Blacklisted',
};

interface FirmForm {
  firmName: string;
  kraPin: string;
  contactPerson: string;
  phone: string;
  email: string;
  workCategories: string;
  notes: string;
}

const emptyForm = (): FirmForm => ({ firmName: '', kraPin: '', contactPerson: '', phone: '', email: '', workCategories: '', notes: '' });

export const ContractorMasterView: React.FC<{ role?: string }> = ({ role = 'COMPANY_ADMIN' }) => {
  const toast = useToast();
  const dialog = useAppDialog();
  const canCreate = hasPermission((role || 'VIEWER') as Role, Permissions.COST_CREATE);
  const canApprove = hasPermission((role || 'VIEWER') as Role, Permissions.COST_APPROVE);

  const [firms, setFirms] = useState<ContractorFirm[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editing, setEditing] = useState<ContractorFirm | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FirmForm>(emptyForm());
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (q.trim()) params.set('q', q.trim());
      const json = await api.get<{ contractors: ContractorFirm[]; page: PageMeta }>(`/api/v1/contractors?${params}`);
      setFirms(json.contractors ?? []);
      setPageMeta(json.page ?? null);
      setPage(p);
    } catch (err) {
      setError(err);
      setFirms([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q, page]);

  useEffect(() => { void load(1); }, [statusFilter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setForm(emptyForm()); setFormError(''); setEditing(null); setCreating(true); };
  const openEdit = (f: ContractorFirm) => {
    setForm({
      firmName: f.firmName,
      kraPin: f.kraPin ?? '',
      contactPerson: f.contactPerson ?? '',
      phone: f.phone ?? '',
      email: f.email ?? '',
      workCategories: (f.workCategories ?? []).join(', '),
      notes: f.notes ?? '',
    });
    setFormError('');
    setEditing(f);
    setCreating(true);
  };

  const payload = () => ({
    firmName: form.firmName.trim(),
    kraPin: form.kraPin.trim() || null,
    contactPerson: form.contactPerson.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    workCategories: form.workCategories.split(',').map((c) => c.trim()).filter(Boolean),
    notes: form.notes.trim() || null,
  });

  const save = async () => {
    if (form.firmName.trim().length < 2) {
      setFormError('Firm name is required.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      if (editing) {
        await api.patch(`/api/v1/contractors/${editing.id}`, payload());
        toast.success('Contractor updated.');
      } else {
        await api.post('/api/v1/contractors', payload());
        toast.success('Contractor registered — pending approval.');
      }
      setCreating(false);
      void load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the contractor.'));
    } finally {
      setFormBusy(false);
    }
  };

  const transition = async (f: ContractorFirm, to: ContractorFirm['approvalStatus']) => {
    const reason = await dialog.prompt({
      title: `${STATUS_LABEL[to] ?? to} — ${f.firmName}`,
      message: `Reason for marking ${f.firmName} as ${(STATUS_LABEL[to] ?? to).toLowerCase()}?`,
      inputLabel: 'Reason',
      inputPlaceholder: 'e.g. Docs verified / Insurance expired',
      confirmLabel: STATUS_LABEL[to] ?? to,
      danger: to === 'BLACKLISTED' || to === 'SUSPENDED',
    });
    if (reason === null) return;
    setBusyId(f.id);
    try {
      await api.patch(`/api/v1/contractors/${f.id}`, { approvalStatus: to, statusReason: reason || null });
      toast.success(`${f.firmName} is now ${(STATUS_LABEL[to] ?? to).toLowerCase()}.`);
      void load();
    } catch (err) {
      toast.error(err, `Could not update ${f.firmName}.`);
    } finally {
      setBusyId(null);
    }
  };

  const statusChips = ['', 'PENDING', 'APPROVED', 'SUSPENDED', 'BLACKLISTED'];

  return (
    <div className="space-y-4" data-testid="contractor-master-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Contractor register</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Firm master — KRA PIN, work categories and approval status. Only approved firms can take work packages.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={openCreate}
            className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
            data-testid="contractor-new">+ Register contractor</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search firm, KRA PIN, contact…"
          className={`${input} max-w-xs`} data-testid="contractor-search" />
        <div className="flex gap-1">
          {statusChips.map((s) => (
            <button key={s || 'all'} type="button" onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${statusFilter === s ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {s ? STATUS_LABEL[s] : 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-600 py-8 text-center">Loading contractors…</p>
      ) : error ? (
        <ErrorState message={apiErrorMessage(error, 'Failed to load contractors.')} onRetry={() => void load()} />
      ) : firms.length === 0 ? (
        <EmptyState title="No contractors registered" hint="Register a firm to start tracking KRA PIN, categories and approvals." />
      ) : (
        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Firm</th>
                <th className="px-4 py-3">KRA PIN</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Packages</th>
                <th className="px-4 py-3">Status</th>
                {(canCreate || canApprove) && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {firms.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40" data-testid={`contractor-row-${f.id}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{f.firmName}</p>
                    {f.statusReason && <p className="text-[11px] text-slate-600">{f.statusReason}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 font-mono">{f.kraPin || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(f.workCategories ?? []).slice(0, 3).map((c) => (
                        <span key={c} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">{c}</span>
                      ))}
                      {(f.workCategories ?? []).length > 3 && <span className="text-[10px] text-slate-600">+{f.workCategories.length - 3}</span>}
                      {(f.workCategories ?? []).length === 0 && <span className="text-xs text-slate-600">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {f.contactPerson || f.phone || f.email || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{f.packageCount ?? 0}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[f.approvalStatus] ?? ''}`}>{STATUS_LABEL[f.approvalStatus] ?? f.approvalStatus}</span>
                  </td>
                  {(canCreate || canApprove) && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {canApprove && f.approvalStatus === 'PENDING' && (
                        <button type="button" disabled={busyId === f.id} onClick={() => void transition(f, 'APPROVED')} className="text-xs font-bold text-emerald-700 hover:underline mr-3" data-testid={`contractor-approve-${f.id}`}>Approve</button>
                      )}
                      {canApprove && f.approvalStatus === 'APPROVED' && (
                        <button type="button" disabled={busyId === f.id} onClick={() => void transition(f, 'SUSPENDED')} className="text-xs font-bold text-orange-700 hover:underline mr-3" data-testid={`contractor-suspend-${f.id}`}>Suspend</button>
                      )}
                      {canApprove && (f.approvalStatus === 'APPROVED' || f.approvalStatus === 'SUSPENDED') && (
                        <button type="button" disabled={busyId === f.id} onClick={() => void transition(f, 'BLACKLISTED')} className="text-xs font-bold text-rose-700 hover:underline mr-3" data-testid={`contractor-blacklist-${f.id}`}>Blacklist</button>
                      )}
                      {canApprove && f.approvalStatus === 'SUSPENDED' && (
                        <button type="button" disabled={busyId === f.id} onClick={() => void transition(f, 'APPROVED')} className="text-xs font-bold text-emerald-700 hover:underline mr-3" data-testid={`contractor-reinstate-${f.id}`}>Reinstate</button>
                      )}
                      {canApprove && canCreate && (
                        <button type="button" onClick={() => openEdit(f)} className="text-xs font-bold text-slate-500 hover:underline" data-testid={`contractor-edit-${f.id}`}>Edit</button>
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

      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? `Edit ${editing.firmName}` : 'Register contractor'} wide>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className={`${label} col-span-2 sm:col-span-3`}>
            Firm name *
            <input className={input} value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} data-testid="contractor-form-name" />
          </label>
          <label className={label}>
            KRA PIN
            <input className={input} value={form.kraPin} onChange={(e) => setForm({ ...form, kraPin: e.target.value })} placeholder="P051234567X" data-testid="contractor-form-kra" />
          </label>
          <label className={label}>
            Contact person
            <input className={input} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </label>
          <label className={label}>
            Phone
            <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254…" />
          </label>
          <label className={label}>
            Email
            <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className={`${label} col-span-2`}>
            Work categories (comma separated)
            <input className={input} value={form.workCategories} onChange={(e) => setForm({ ...form, workCategories: e.target.value })} placeholder="ELECTRICAL, PLUMBING, ROOFING" data-testid="contractor-form-categories" />
          </label>
          <label className={`${label} col-span-2 sm:col-span-3`}>
            Notes
            <input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>

        {formError && <InlineError error={formError} className="mt-3" />}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={formBusy}
            className="px-4 py-2 rounded-lg bg-brand-700 text-white text-xs font-bold hover:bg-brand-800 disabled:opacity-60" data-testid="contractor-save">
            {formBusy ? 'Saving…' : editing ? 'Save changes' : 'Register'}
          </button>
        </div>
      </Modal>

      {dialog.element}
    </div>
  );
};

export default ContractorMasterView;
