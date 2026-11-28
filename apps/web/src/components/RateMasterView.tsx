import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { Card, formatKes, Modal, EmptyState, ErrorState, FilterTabs } from '../ui';
import { InlineError } from './feedback/InlineError';
import { hasPermission, Permissions, type Role } from '@construction/permissions';
import { useToast } from './feedback/Toast';
import { useAppDialog } from './AppDialog';

// CB2 — shared rate library: geo (Country→State→City) + item/material typing,
// bulk upload/edit, prefill hooks into BoQ lines and PO rates.

export interface RateMasterEntry {
  id: string;
  country: string;
  stateRegion?: string | null;
  city?: string | null;
  itemType: 'MATERIAL' | 'SERVICE' | 'LABOUR' | 'EQUIPMENT' | 'OTHER';
  materialType?: string | null;
  materialSubType?: string | null;
  description: string;
  unit: string;
  unitRateKes: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  source: string;
  notes?: string | null;
  createdAt?: string;
}

interface PageMeta { page: number; limit: number; hasMore: boolean; nextPage: number | null }

const ITEM_TYPES = ['MATERIAL', 'SERVICE', 'LABOUR', 'EQUIPMENT', 'OTHER'] as const;
const input = 'w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100';
const label = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1';

const EMPTY_FORM = {
  country: 'Kenya', stateRegion: '', city: '', itemType: 'MATERIAL' as RateMasterEntry['itemType'],
  materialType: '', materialSubType: '', description: '', unit: '', unitRateKes: '',
  effectiveFrom: '', effectiveTo: '', notes: '',
};

function geoLabel(e: RateMasterEntry): string {
  return [e.country, e.stateRegion, e.city].filter(Boolean).join(' · ');
}

/** CSV → bulk entries. Columns (header optional): description,unit,unitRateKes,itemType,materialType,materialSubType,country,stateRegion,city,effectiveFrom,effectiveTo,notes */
function parseCsv(text: string): { entries: any[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: any[] = [];
  const errors: string[] = [];
  const header = ['description', 'unit', 'unitRateKes', 'itemType', 'materialType', 'materialSubType', 'country', 'stateRegion', 'city', 'effectiveFrom', 'effectiveTo', 'notes'];
  const rows = lines[0]?.toLowerCase().includes('description') ? lines.slice(1) : lines;
  rows.forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim());
    const get = (idx: number, name: string) => {
      const h = header.indexOf(name);
      const v = cells[h >= 0 ? h : idx] ?? '';
      return v === '' ? undefined : v;
    };
    const description = get(0, 'description');
    const unit = get(1, 'unit');
    const unitRateKes = get(2, 'unitRateKes');
    if (!description || !unit || !unitRateKes) {
      errors.push(`Row ${i + 1}: description, unit and unitRateKes are required`);
      return;
    }
    entries.push({
      description, unit, unitRateKes: Number(unitRateKes),
      itemType: (get(3, 'itemType') ?? 'MATERIAL').toUpperCase(),
      materialType: get(4, 'materialType'), materialSubType: get(5, 'materialSubType'),
      country: get(6, 'country') ?? 'Kenya', stateRegion: get(7, 'stateRegion'), city: get(8, 'city'),
      effectiveFrom: get(9, 'effectiveFrom'), effectiveTo: get(10, 'effectiveTo'), notes: get(11, 'notes'),
    });
  });
  return { entries, errors };
}

export const RateMasterView: React.FC<{ role?: string }> = ({ role = 'COMPANY_ADMIN' }) => {
  const toast = useToast();
  const dialog = useAppDialog();
  const canEdit = hasPermission((role || 'VIEWER') as Role, Permissions.BOQ_EDIT);
  const canImport = hasPermission((role || 'VIEWER') as Role, Permissions.BOQ_IMPORT);

  const [entries, setEntries] = useState<RateMasterEntry[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [itemType, setItemType] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<RateMasterEntry | 'new' | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; updated: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (q.trim()) params.set('q', q.trim());
      if (itemType) params.set('itemType', itemType);
      if (materialType.trim()) params.set('materialType', materialType.trim());
      if (city.trim()) params.set('city', city.trim());
      const json = await api.get<{ entries: RateMasterEntry[]; page: PageMeta }>(`/api/v1/rate-master?${params}`);
      setEntries(json.entries ?? []);
      setPageMeta(json.page ?? null);
      setPage(p);
    } catch (err) {
      setError(err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [q, itemType, materialType, city, page]);

  useEffect(() => { void load(1); }, [q, itemType, materialType, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (e: RateMasterEntry | 'new') => {
    setFormError('');
    setForm(e === 'new' ? { ...EMPTY_FORM } : {
      country: e.country ?? 'Kenya', stateRegion: e.stateRegion ?? '', city: e.city ?? '',
      itemType: e.itemType, materialType: e.materialType ?? '', materialSubType: e.materialSubType ?? '',
      description: e.description, unit: e.unit, unitRateKes: e.unitRateKes,
      effectiveFrom: e.effectiveFrom ?? '', effectiveTo: e.effectiveTo ?? '', notes: e.notes ?? '',
    });
    setEditing(e);
  };

  const saveEntry = async () => {
    if (!form.description.trim() || !form.unit.trim() || !form.unitRateKes) {
      setFormError('Description, unit and rate are required.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    const payload = {
      country: form.country.trim() || 'Kenya', stateRegion: form.stateRegion.trim() || null,
      city: form.city.trim() || null, itemType: form.itemType,
      materialType: form.materialType.trim() || null, materialSubType: form.materialSubType.trim() || null,
      description: form.description.trim(), unit: form.unit.trim(), unitRateKes: Number(form.unitRateKes),
      effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing === 'new') await api.post('/api/v1/rate-master', payload);
      else await api.patch(`/api/v1/rate-master/${(editing as RateMasterEntry).id}`, payload);
      toast.success(editing === 'new' ? 'Rate added.' : 'Rate updated.');
      setEditing(null);
      void load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the rate.'));
    } finally {
      setFormBusy(false);
    }
  };

  const removeEntry = async (e: RateMasterEntry) => {
    const ok = await dialog.confirm({
      title: 'Delete rate',
      message: `Delete rate "${e.description}"?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/v1/rate-master/${e.id}`);
      toast.success('Rate deleted.');
      void load();
    } catch (err) {
      toast.error(err, 'Delete failed.');
    }
  };

  const runBulk = async () => {
    const { entries: parsed, errors } = parseCsv(bulkText);
    setBulkErrors(errors);
    if (parsed.length === 0) { setBulkResult(null); return; }
    setBulkBusy(true);
    try {
      const res = await api.post<{ created: number; updated: number }>('/api/v1/rate-master/bulk', { entries: parsed });
      setBulkResult(res);
      toast.success(`Bulk import done — ${res.created} added, ${res.updated} updated.`);
      void load();
    } catch (err) {
      setBulkErrors([apiErrorMessage(err, 'Bulk import failed.')]);
    } finally {
      setBulkBusy(false);
    }
  };

  const typeChips = useMemo(() => [{ id: '', label: 'All types' }, ...ITEM_TYPES.map((t) => ({ id: t, label: t[0] + t.slice(1).toLowerCase() }))], []);

  return (
    <div className="space-y-4" data-testid="rate-master-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Rate master</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Shared rate library — BoQ lines and purchase orders prefill from these rates.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {canImport && (
              <button type="button" onClick={() => { setBulkOpen(true); setBulkResult(null); setBulkErrors([]); }}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                data-testid="rate-master-bulk">Bulk upload</button>
            )}
            <button type="button" onClick={() => openEdit('new')}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800"
              data-testid="rate-master-new">+ New rate</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description, material type…"
          className={`${input} max-w-xs`} data-testid="rate-master-search" />
        <input value={materialType} onChange={(e) => setMaterialType(e.target.value)} placeholder="Material type"
          className={`${input} max-w-[160px]`} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City"
          className={`${input} max-w-[140px]`} />
        <FilterTabs tabs={typeChips} active={itemType} onChange={setItemType} tabClassName="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition"
          activeClassName="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" inactiveClassName="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-600 py-8 text-center">Loading rates…</p>
      ) : error ? (
        <ErrorState message={apiErrorMessage(error, 'Failed to load rate master.')} onRetry={() => void load()} />
      ) : entries.length === 0 ? (
        <EmptyState title="No rates yet" hint="Add rates manually or bulk-upload a CSV to start prefilling BoQ lines and POs." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Rate (KES)</th>
                <th className="px-4 py-3">Source</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40" data-testid={`rate-row-${e.id}`}>
                  <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{e.description}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{e.itemType[0] + e.itemType.slice(1).toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{[e.materialType, e.materialSubType].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{geoLabel(e) || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{e.unit}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">{formatKes(e.unitRateKes)}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-600">{e.source}</td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(e)} className="text-xs font-bold text-brand-700 hover:underline mr-3" data-testid={`rate-edit-${e.id}`}>Edit</button>
                      <button type="button" onClick={() => void removeEntry(e)} className="text-xs font-bold text-rose-700 hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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

      {/* Create / edit */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New rate' : 'Edit rate'} wide>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className={`${label} col-span-2`}>
            Description *
            <input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="rate-form-description" />
          </label>
          <label className={label}>
            Unit *
            <input className={input} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bag, m³, hr" data-testid="rate-form-unit" />
          </label>
          <label className={label}>
            Rate (KES) *
            <input type="number" min="0" step="any" className={input} value={form.unitRateKes} onChange={(e) => setForm({ ...form, unitRateKes: e.target.value })} data-testid="rate-form-rate" />
          </label>
          <label className={label}>
            Type
            <select className={input} value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value as RateMasterEntry['itemType'] })} data-testid="rate-form-type">
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label className={label}>
            Material type
            <input className={input} value={form.materialType} onChange={(e) => setForm({ ...form, materialType: e.target.value })} placeholder="e.g. Cement" data-testid="rate-form-mat-type" />
          </label>
          <label className={label}>
            Material subtype
            <input className={input} value={form.materialSubType} onChange={(e) => setForm({ ...form, materialSubType: e.target.value })} placeholder="e.g. 42.5N" data-testid="rate-form-mat-subtype" />
          </label>
          <label className={label}>
            Country
            <input className={input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} data-testid="rate-form-country" />
          </label>
          <label className={label}>
            State / region
            <input className={input} value={form.stateRegion} onChange={(e) => setForm({ ...form, stateRegion: e.target.value })} placeholder="Nairobi" data-testid="rate-form-state" />
          </label>
          <label className={label}>
            City
            <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Nairobi" data-testid="rate-form-city" />
          </label>
          <label className={label}>
            Effective from
            <input type="date" className={input} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </label>
          <label className={label}>
            Effective to
            <input type="date" className={input} value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          </label>
          <label className={`${label} col-span-2`}>
            Notes
            <input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        {formError && <InlineError error={formError} className="mt-3" />}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Cancel</button>
          <button type="button" onClick={() => void saveEntry()} disabled={formBusy}
            className="px-4 py-2 rounded-lg bg-brand-700 text-white text-xs font-bold hover:bg-brand-800 disabled:opacity-60" data-testid="rate-form-save">
            {formBusy ? 'Saving…' : 'Save rate'}
          </button>
        </div>
      </Modal>

      {dialog.element}

      {/* Bulk upload */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk upload rates" wide>
        <p className="text-xs text-slate-500 mb-2">
          Paste CSV — one rate per line. Columns (header optional):{' '}
          <code className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">description, unit, unitRateKes, itemType, materialType, materialSubType, country, stateRegion, city, effectiveFrom, effectiveTo, notes</code>.
          Matching rates (same geo + type + unit + description) are updated, not duplicated.
        </p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={8}
          className={`${input} font-mono text-xs`}
          placeholder={'Cement 42.5N 50kg bag,bag,780,MATERIAL,Cement,42.5N,Kenya,Nairobi,Nairobi\nReady-mix concrete C25,m3,11500,SERVICE,Concrete,C25,Kenya,Nairobi,Nairobi'}
          data-testid="rate-bulk-text"
        />
        {bulkErrors.length > 0 && (
          <ul className="mt-2 text-xs text-rose-700 space-y-0.5 max-h-28 overflow-y-auto">
            {bulkErrors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
            {bulkErrors.length > 20 && <li>…and {bulkErrors.length - 20} more</li>}
          </ul>
        )}
        {bulkResult && <p className="mt-2 text-xs font-bold text-emerald-700">Imported: {bulkResult.created} created, {bulkResult.updated} updated.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setBulkOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:underline">Close</button>
          <button type="button" onClick={() => void runBulk()} disabled={bulkBusy || !bulkText.trim()}
            className="px-4 py-2 rounded-lg bg-brand-700 text-white text-xs font-bold hover:bg-brand-800 disabled:opacity-60" data-testid="rate-bulk-run">
            {bulkBusy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default RateMasterView;
