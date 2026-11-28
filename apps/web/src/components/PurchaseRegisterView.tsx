import { useCallback, useEffect, useState } from 'react';
import { Card, formatKes } from '../ui';
import { api, apiErrorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { ProcurementPrintModal } from './procurement/ProcurementPrintModal';

/**
 * CB4 — PO/GRN register: unified register of purchase orders and material
 * deliveries (goods received notes) with supplier + store + value columns.
 * Backed by GET /api/v1/purchase-register (tenant-level; projectId filter).
 */

export interface RegisterRow {
  id: string;
  kind: 'PO' | 'GRN';
  ref: string;
  date: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  storeLocation?: string | null;
  description: string;
  quantity?: string | null;
  unit?: string | null;
  lineCount?: number;
  value?: string | null;
  status: string;
}

interface PageMeta { page: number; limit: number; hasMore: boolean; nextPage: number | null; total?: number }

const KIND_STYLES: Record<string, string> = {
  PO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  GRN: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const fmtDate = (iso?: string | null) => formatDate(iso);

const input = 'px-2 py-1.5 text-sm border border-slate-300 rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100';

export default function PurchaseRegisterView({ projectId }: { projectId?: string }) {
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [store, setStore] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [printRow, setPrintRow] = useState<RegisterRow | null>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (kind) params.set('kind', kind);
      if (status) params.set('status', status);
      if (store.trim()) params.set('store', store.trim());
      if (q.trim()) params.set('q', q.trim());
      if (projectId) params.set('projectId', projectId);
      const json = await api.get<{ rows: RegisterRow[]; page: PageMeta }>(`/api/v1/purchase-register?${params}`);
      setRows(json.rows ?? []);
      setPageMeta(json.page ?? null);
      setPage(p);
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind, status, store, q, projectId, page]);

  useEffect(() => { void load(1); }, [kind, status, store, q, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3" data-testid="purchase-register">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref, supplier, material…" className={`${input} max-w-xs`} data-testid="register-search" />
        <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store / site" className={`${input} max-w-[160px]`} data-testid="register-store" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={input} data-testid="register-kind">
          <option value="">PO + GRN</option>
          <option value="PO">Purchase orders</option>
          <option value="GRN">Deliveries (GRN)</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input} data-testid="register-status">
          <option value="">All statuses</option>
          {['DRAFT', 'ISSUED', 'ACCEPTED', 'PART_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED', 'RECORDED', 'CONFIRMED', 'DISPUTED'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-600 py-8 text-center">Loading register…</p>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-rose-700">{apiErrorMessage(error, 'Failed to load the register.')}</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-xs font-bold text-brand-700 hover:underline">Retry</button>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          No purchase orders or deliveries match these filters.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Store / site</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3 text-right">Value (KES)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40" data-testid={`register-row-${r.kind}-${r.id}`}>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${KIND_STYLES[r.kind] ?? ''}`}>{r.kind === 'PO' ? 'PO' : 'GRN'}</span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.ref}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.projectName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.supplierName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.storeLocation ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[240px] truncate" title={r.description}>
                    {r.description}
                    {r.kind === 'PO' && r.lineCount != null && <span className="text-slate-600"> ({r.lineCount} lines)</span>}
                    {r.kind === 'GRN' && r.quantity && <span className="text-slate-600"> ({r.quantity} {r.unit})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {r.value != null ? formatKes(r.value) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{r.status.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setPrintRow(r)}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      data-testid={`register-print-${r.kind}-${r.id}`}
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {printRow && (
        <ProcurementPrintModal
          kind={printRow.kind}
          id={printRow.id}
          projectId={printRow.projectId}
          projectName={printRow.projectName}
          onClose={() => setPrintRow(null)}
        />
      )}

      {pageMeta && (pageMeta.page > 1 || pageMeta.hasMore || (pageMeta.total ?? 0) > pageMeta.limit) && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{pageMeta.total != null ? `${pageMeta.total} rows · ` : ''}Page {pageMeta.page}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pageMeta.page <= 1} onClick={() => void load(pageMeta.page - 1)} className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40">Previous</button>
            <button type="button" disabled={!pageMeta.hasMore} onClick={() => void load(pageMeta.page + 1)} className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
