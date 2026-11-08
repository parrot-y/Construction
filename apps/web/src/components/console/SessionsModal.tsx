import React, { useEffect, useState } from 'react';

interface SessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/** Active sign-in sessions — list + revoke (audit S-01 self-service). */
export default function SessionsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/v1/auth/sessions', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => setRows(j.data || []))
      .catch(() => setError('Could not load sessions'));
  };
  useEffect(load, []);

  const revoke = async (id: string) => {
    const res = await fetch(`/api/v1/auth/sessions/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) load(); else setError('Revoke failed');
  };

  const revokeOthers = async () => {
    const res = await fetch('/api/v1/auth/sessions/others', { method: 'DELETE', credentials: 'include' });
    if (res.ok) load(); else setError('Revoke failed');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Active sessions</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Devices currently signed in to your account</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
        </div>
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          {rows === null && <p className="text-xs text-slate-400">Loading…</p>}
          {rows?.length === 0 && <p className="text-xs text-slate-400">No active sessions found.</p>}
          <ul className="space-y-2">
            {rows?.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Session {s.id}
                    {s.current && <span className="ml-2 text-[10px] font-bold text-emerald-600">THIS DEVICE</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Signed in {new Date(s.createdAt).toLocaleString()} · expires {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {!s.current && (
                  <button onClick={() => revoke(s.id)} className="text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button onClick={revokeOthers} className="text-[11px] font-bold text-slate-500 hover:text-red-600">
            Sign out all other sessions
          </button>
        </div>
      </div>
    </div>
  );
}
