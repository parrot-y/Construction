import React, { useCallback, useEffect, useState } from 'react';
import { formatKes } from '../../../ui';
import { hasPermission, Permissions, type Role } from '@construction/permissions';
import BoqImportModal from '../../BoqImportModal';
import { useAppDialog } from '../../AppDialog';
import { api, ApiError, apiErrorMessage } from '../../../lib/api';
import { InlineError } from '../../feedback/InlineError';
import { RateLookupButton } from '../../rateMaster/RateLookupButton';

interface BoqItem {
  id: string;
  item_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_rate: string;
  total_amount: string;
  is_provisional?: boolean;
}
interface BoqSection {
  id: string;
  title: string;
  total_amount: string;
  items: BoqItem[];
}
interface Boq {
  id: string;
  version: number;
  status: string;
  total_amount: string;
  sections: BoqSection[];
}

const fmt = (n: string | number) => formatKes(n || 0);

interface ItemForm {
  item_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_rate: string;
}
const emptyForm: ItemForm = { item_code: '', description: '', unit: 'm', quantity: '', unit_rate: '' };

/**
 * Active BOQ workbook — sections → items → amounts.
 * With `canEdit` (BOQ_EDIT roles) admins can type items, edit lines, delete
 * lines, and import an Excel BOQ — the active version's totals stay in sync.
 */
export default function BoqWorkbookView({
  projectId,
  projectName = 'this project',
  role,
}: {
  projectId: string;
  projectName?: string;
  role?: Role | string;
}): React.JSX.Element {
  const dialog = useAppDialog();
  const canEdit = hasPermission((role || 'VIEWER') as Role, Permissions.BOQ_EDIT);
  const [boq, setBoq] = useState<Boq | null>(null);
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading');
  const [showImport, setShowImport] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState('loading');
    api.get<{ data?: Boq }>(`/api/v1/projects/${projectId}/boq`)
      .then((j) => {
        if (j?.data) {
          setBoq(j.data);
          setState('ready');
        } else {
          setBoq(null);
          setState('empty');
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setBoq(null);
          setState('empty');
          return;
        }
        setState('error');
      });
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = boq?.sections.find((sec) => sec.id === sectionId);
      await api.post(`/api/v1/projects/${projectId}/boq/items`, {
        itemCode: form.item_code.trim() || undefined,
        description: form.description.trim(),
        unit: form.unit.trim() || 'm',
        quantity: Number(form.quantity),
        unitRate: Number(form.unit_rate),
        sectionTitle: chosen?.title ?? (sectionTitle.trim() || undefined),
      });
      setForm(emptyForm);
      setSectionTitle('');
      setSectionId('');
      setAdding(false);
      load();
    } catch (err: any) {
      setError(apiErrorMessage(err, 'Could not save the item. Check the fields and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (it: BoqItem) => {
    setEditingId(it.id);
    setEditForm({
      item_code: it.item_code || '',
      description: it.description,
      unit: it.unit,
      quantity: String(it.quantity),
      unit_rate: String(it.unit_rate),
    });
    setError(null);
  };

  const saveEdit = async (itemId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/v1/projects/${projectId}/boq/items/${itemId}`, {
        itemCode: editForm.item_code.trim() || undefined,
        description: editForm.description.trim(),
        unit: editForm.unit.trim() || undefined,
        quantity: Number(editForm.quantity),
        unitRate: Number(editForm.unit_rate),
      });
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(apiErrorMessage(err, 'Could not update the item. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (busy) return;
    const ok = await dialog.confirm({
      title: 'Delete BoQ line',
      message: 'Delete this BoQ line? The project total will be recalculated.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/v1/projects/${projectId}/boq/items/${itemId}`);
      load();
    } catch (err: any) {
      setError(apiErrorMessage(err, 'Could not delete the item. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-slate-700/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Could not load the Bill of Quantities</p>
        <p className="text-xs text-slate-500 mt-1">Check your connection and try again.</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 text-xs font-bold text-brand-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === 'empty' || !boq) {
    return (
      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No Bill of Quantities yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          The BoQ lists every item of work with quantities and rates — it drives valuations, valuations and retention.
          {canEdit ? ' Type your first item below or import an Excel BoQ.' : ' Ask a project manager or QS to import one.'}
        </p>
        {canEdit && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700"
            >
              Add your first BoQ item
            </button>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Import Excel BoQ
            </button>
          </div>
        )}
        {adding && renderForm('Add BoQ item', form, setForm, submitItem, () => { setAdding(false); setForm(emptyForm); setSectionTitle(''); setSectionId(''); }, busy, error, boq, sectionId, setSectionId, sectionTitle, setSectionTitle, true)}
        {canEdit && (
          <BoqImportModal
            isOpen={showImport}
            onClose={() => setShowImport(false)}
            onImportSuccess={() => { setShowImport(false); load(); }}
            projectId={projectId}
            projectName={projectName}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bill of Quantities</h3>
          <p className="text-[11px] text-slate-500">Version {boq.version} · {boq.status}</p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-700"
              >
                {adding ? 'Close' : 'Add item'}
              </button>
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Import Excel
              </button>
            </>
          )}
          <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(boq.total_amount)}</span>
        </div>
      </div>

      {error && (
        <div className="px-5 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {adding && renderForm('Add BoQ item', form, setForm, submitItem, () => { setAdding(false); setForm(emptyForm); setSectionTitle(''); setSectionId(''); }, busy, error, boq, sectionId, setSectionId, sectionTitle, setSectionTitle, true)}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <th className="px-5 py-2.5 font-semibold">Code</th>
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 font-semibold">Unit</th>
              <th className="px-3 py-2.5 font-semibold text-right">Qty</th>
              <th className="px-3 py-2.5 font-semibold text-right">Rate</th>
              <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
              {canEdit && <th className="px-3 py-2.5 font-semibold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {boq.sections.map((sec) => (
              <React.Fragment key={sec.id}>
                <tr className="bg-slate-50 dark:bg-slate-900/60">
                  <td colSpan={5} className="px-5 py-2 font-bold text-slate-800 dark:text-slate-200">{sec.title}</td>
                  <td className="px-5 py-2 text-right font-bold font-mono tabular-nums">{fmt(sec.total_amount)}</td>
                  {canEdit && <td />}
                </tr>
                {sec.items.map((it) => (
                  <React.Fragment key={it.id}>
                    {editingId === it.id ? (
                      <tr className="border-t border-slate-100 dark:border-slate-800/60 bg-brand-50/40 dark:bg-brand-900/10">
                        <td colSpan={6} className="px-5 py-3">
                          {renderForm('Save changes', editForm, setEditForm, (e) => { e.preventDefault(); void saveEdit(it.id); }, () => setEditingId(null), busy, error, boq, '', () => {}, '', () => {}, false)}
                        </td>
                        {canEdit && <td className="px-3 py-3 text-right"><button type="button" onClick={() => setEditingId(null)} className="text-[11px] font-bold text-slate-500 hover:underline">Cancel</button></td>}
                      </tr>
                    ) : (
                      <tr className="border-t border-slate-50 dark:border-slate-800/60 text-slate-700 dark:text-slate-300">
                        <td className="px-5 py-2 font-mono tabular-nums text-[11px]">{it.item_code}</td>
                        <td className="px-3 py-2 max-w-[320px]">
                          {it.description}
                          {it.is_provisional && <span className="ml-2 text-[9px] font-bold text-amber-600">provisional</span>}
                        </td>
                        <td className="px-3 py-2">{it.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(it.quantity).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(it.unit_rate)}</td>
                        <td className="px-5 py-2 text-right tabular-nums font-semibold">{fmt(it.total_amount)}</td>
                        {canEdit && (
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button type="button" onClick={() => startEdit(it)} className="text-[11px] font-bold text-brand-600 hover:underline mr-3">Edit</button>
                            <button type="button" onClick={() => void removeItem(it.id)} disabled={busy} className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-50">Delete</button>
                          </td>
                        )}
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <BoqImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onImportSuccess={() => { setShowImport(false); load(); }}
          projectId={projectId}
          projectName={projectName}
        />
      )}
      {dialog.element}
    </div>
  );
}

function renderForm(
  title: string,
  form: ItemForm,
  setForm: (f: ItemForm) => void,
  onSubmit: (e: React.FormEvent) => void,
  onCancel: () => void,
  busy: boolean,
  error: string | null,
  boq: Boq | null,
  sectionId: string,
  setSectionId: (v: string) => void,
  sectionTitle: string,
  setSectionTitle: (v: string) => void,
  showSectionPicker: boolean,
): React.JSX.Element {
  const input =
    'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-base sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
  return (
    <form onSubmit={onSubmit} className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">{title}</p>
      {showSectionPicker && boq && boq.sections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="text-[11px] font-semibold text-slate-500">
            Section
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={`${input} mt-1`}>
              <option value="">— choose a section —</option>
              {boq.sections.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-slate-500">
            …or new section title
            <input
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="e.g. Foundation works"
              className={`${input} mt-1`}
            />
          </label>
        </div>
      )}
      {showSectionPicker && (!boq || boq.sections.length === 0) && (
        <label className="block text-[11px] font-semibold text-slate-500 mb-3">
          Section title
          <input
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            placeholder="e.g. Foundation works"
            className={`${input} mt-1`}
          />
        </label>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label className="text-[11px] font-semibold text-slate-500">
          Item code
          <input value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} placeholder="Auto" className={`${input} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-500 col-span-2 sm:col-span-1">
          Description
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="Describe the work" className={`${input} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Unit
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="m, m², no" className={`${input} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Qty
          <input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required placeholder="0" className={`${input} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Rate (KES)
          <input type="number" min="0" step="any" value={form.unit_rate} onChange={(e) => setForm({ ...form, unit_rate: e.target.value })} required placeholder="0" className={`${input} mt-1`} />
          <span className="mt-1 inline-block">
            <RateLookupButton
              query={form.description}
              unit={form.unit}
              onPick={(m) => setForm({ ...form, unit_rate: m.unitRateKes, ...(form.unit.trim() ? {} : { unit: m.unit }) })}
            />
          </span>
        </label>
      </div>
      {error && <InlineError error={error} className="mt-2" />}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save item'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-60">
          Cancel
        </button>
      </div>
    </form>
  );
}
