import React, { useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import { formatKes } from '../../ui';

export interface RateMasterMatch {
  id: string;
  description: string;
  unit: string;
  unitRateKes: string;
  materialType?: string | null;
  materialSubType?: string | null;
  city?: string | null;
}

/**
 * CB2 — inline rate-library lookup. Queries GET /api/v1/rate-master/lookup
 * and lets the user pick a match; the caller decides what to fill.
 */
export const RateLookupButton: React.FC<{
  query: string;
  unit?: string;
  onPick: (match: RateMasterMatch) => void;
  label?: string;
  disabled?: boolean;
}> = ({ query, unit, onPick, label = 'Rate', disabled }) => {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<RateMasterMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lookup = async () => {
    if (!query.trim()) {
      setError('Type a description first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: '8' });
      if (unit?.trim()) params.set('unit', unit.trim());
      const json = await api.get<{ matches?: RateMasterMatch[] }>(`/api/v1/rate-master/lookup?${params}`);
      const rows = json.matches ?? [];
      setMatches(rows);
      setOpen(true);
      if (rows.length === 0) setError('No rate-master matches.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Rate lookup failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={lookup}
        disabled={disabled || busy}
        className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        title="Look up a rate from the rate master"
      >
        {busy ? '…' : label}
      </button>
      {error && !open && <span className="ml-2 text-[11px] text-rose-700">{error}</span>}
      {open && (
        <div className="absolute z-30 mt-1 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Rate master matches</p>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-600 text-xs" aria-label="Close rate matches">✕</button>
          </div>
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onPick(m); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200"
            >
              <p className="text-xs font-semibold text-slate-800 truncate">{m.description}</p>
              <p className="text-[11px] text-slate-500">
                {[m.materialType, m.materialSubType, m.city].filter(Boolean).join(' · ')}
                {m.materialType || m.materialSubType || m.city ? ' — ' : ''}
                {formatKes(m.unitRateKes)}/{m.unit}
              </p>
            </button>
          ))}
          {matches.length === 0 && <p className="text-xs text-slate-600 px-2 py-1">No matches — add the rate in Money → Rate master.</p>}
        </div>
      )}
    </span>
  );
};
