import React, { useEffect, useState} from 'react';
import { formatDate, formatDateTime } from '../../lib/format';
import { api } from '../../lib/api';
import { InlineError } from '../feedback/InlineError';

interface SessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/** Active sign-in sessions — list + revoke (audit S-01 self-service). */
export default function SessionsModal({ onClose}: { onClose: () => void}): React.JSX.Element {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get<any>('/api/v1/auth/sessions')
      .then((j) => setRows(j?.data || []))
      .catch(() => setError('Could not load sessions'));
};
  useEffect(load, []);

  const revoke = async (id: string) => {
    try {
      await api.delete(`/api/v1/auth/sessions/${id}`);
      load();
    } catch {
      setError('Revoke failed');
    }
};

  const revokeOthers = async () => {
    try {
      await api.delete('/api/v1/auth/sessions/others');
      load();
    } catch {
      setError('Revoke failed');
    }
};

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
<div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Active sessions</h3>
<p className="text-[11px] text-slate-500 mt-0.5">Devices currently signed in to your account</p>
</div>
<button onClick={onClose} className="text-slate-500 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
</div>
<div className="px-5 py-4 max-h-80 overflow-y-auto">
          {error && <InlineError error={error} className="mb-3" />}
          {rows === null &&<p className="text-xs text-slate-500">Loading…</p>}
          {rows?.length === 0 &&<p className="text-xs text-slate-500">No active sessions found.</p>}
<ul className="space-y-2">
            {rows?.map((s) => (
<li key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5">
<div>
<p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Session {s.id}
                    {s.current &&<span className="ml-2 text-[10px] font-bold text-emerald-700">THIS DEVICE</span>}
</p>
<p className="text-[10px] text-slate-500">
                    Signed in {formatDateTime(new Date(s.createdAt))} · expires {formatDate(new Date(s.expiresAt))}
</p>
</div>
                {!s.current && (
<button onClick={() => revoke(s.id)} className="text-[11px] font-bold text-red-700 hover:text-red-700 px-2 py-1">
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
