import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import { api } from '../lib/apiClient';

/**
 * F1: "Report a problem" — available from the account menu on every
 * console screen. Captures route, app version and the last Sentry event
 * id; user/tenant come from the session server-side.
 */
export default function ReportProblemModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [reference, setReference] = useState<string | null>(null);

  const submit = async () => {
    setStatus('sending');
    try {
      const res = await api.post<{ reportId: string }>('/api/v1/problem-reports', {
        route: window.location.pathname + window.location.search,
        description,
        appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev',
        lastSentryEventId: Sentry.lastEventId() ?? undefined,
      });
      setReference(res.reportId);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-[60]" role="dialog" aria-modal="true" aria-label="Report a problem">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Report a problem</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tell us what went wrong. We automatically include the page you are on, your account and app version.
          </p>
        </div>
        {status === 'sent' ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            Thanks — your report was received{reference ? ` (ref ${reference.slice(0, 8)})` : ''}. The SiteSafi team will look into it.
          </div>
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              What happened?
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="e.g. The payment button did nothing after I clicked it."
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            {status === 'error' && (
              <p className="text-xs text-red-600">Could not send the report — check your connection and try again.</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
              <button
                onClick={submit}
                disabled={status === 'sending' || (!description.trim() && status !== 'error')}
                className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg"
              >
                {status === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </>
        )}
        {status === 'sent' && (
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
