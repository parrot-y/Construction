import React, { useState } from 'react';
import { PRODUCT_NAME } from '../lib/product';

/**
 * F2: operator-only adoption page. The platform operator authenticates with
 * the deployment OPERATOR_KEY (same guard as /api/v1/operator/*) — the key
 * is kept in sessionStorage only for the tab session and sent as a header.
 * Shows per-tenant pilot usage: last activity per user, diary entries,
 * invoices, certificates and open issues over the last 30 days.
 */
interface AdoptionUser { userId: string; name: string | null; email: string | null; role: string; active: boolean; lastActivityAt: string | null }
interface AdoptionTenant {
  tenant: { id: string; name: string; slug: string; createdAt: string };
  users: AdoptionUser[];
  diaryEntries30d: number;
  invoices30d: number;
  certificates: number;
  openSnags: number;
  openRfis: number;
}

export default function OperatorAdoptionView(): React.JSX.Element {
  const [key, setKey] = useState(() => sessionStorage.getItem('operator_key') ?? '');
  const [data, setData] = useState<{ generatedAt: string; windowDays: number; tenants: AdoptionTenant[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/operator/adoption', { headers: { 'x-operator-key': key } });
      if (res.status === 403) { setError('Invalid operator key.'); return; }
      if (!res.ok) { setError(`Request failed (${res.status})`); return; }
      const json = await res.json();
      setData(json.data);
      sessionStorage.setItem('operator_key', key);
    } catch {
      setError("Can't reach SiteSafi — check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{PRODUCT_NAME} — Operator adoption</h1>
          <p className="text-xs text-slate-500 mt-1">Per-tenant pilot usage over the last 30 days. Operator key required.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Operator key"
            aria-label="Operator key"
            className="flex-1 max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <button onClick={load} disabled={loading || !key} className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg disabled:opacity-50">
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {data && (
          <div className="space-y-4">
            <p className="text-[10px] text-slate-400">Generated {new Date(data.generatedAt).toLocaleString()} · window {data.windowDays}d</p>
            {data.tenants.map((t) => (
              <div key={t.tenant.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t.tenant.name}</span>
                  <span className="text-slate-500">Diary entries 30d: <b>{t.diaryEntries30d}</b></span>
                  <span className="text-slate-500">Invoices 30d: <b>{t.invoices30d}</b></span>
                  <span className="text-slate-500">Certificates: <b>{t.certificates}</b></span>
                  <span className="text-slate-500">Open snags: <b>{t.openSnags}</b></span>
                  <span className="text-slate-500">Open RFIs: <b>{t.openRfis}</b></span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                    <tr><th className="px-4 py-2">User</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Last activity</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {t.users.map((u) => (
                      <tr key={u.userId}>
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{u.name || u.email}{!u.active && <span className="ml-2 text-[10px] text-red-500">inactive</span>}</td>
                        <td className="px-4 py-2 text-slate-500">{u.role}</td>
                        <td className="px-4 py-2 text-slate-500 tabular-nums">{u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleString() : 'never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {data.tenants.length === 0 && <p className="text-xs text-slate-400">No tenants yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
