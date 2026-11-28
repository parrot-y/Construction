import React from 'react';

export interface ScheduleRow {
  batchDate: string;
  quantity: string;
}

/** CB1 — editable delivery-schedule batches shared by create + amend forms. */
export const DeliveryScheduleEditor: React.FC<{
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  emptyHint?: string;
}> = ({ rows, onChange, emptyHint = 'No batches — single delivery on expected date.' }) => {
  const set = (i: number, patch: Partial<ScheduleRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Delivery schedule</p>
        <button
          type="button"
          onClick={() => onChange([...rows, { batchDate: '', quantity: '' }])}
          className="text-xs text-amber-700 font-medium hover:underline"
        >
          + Add batch
        </button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="date"
            value={row.batchDate}
            onChange={(e) => set(i, { batchDate: e.target.value })}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
            aria-label={`Batch ${i + 1} date`}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Qty"
            value={row.quantity}
            onChange={(e) => set(i, { quantity: e.target.value })}
            className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
            aria-label={`Batch ${i + 1} quantity`}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="text-rose-700 hover:text-rose-700 text-xs"
            aria-label={`Remove batch ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-slate-600">{emptyHint}</p>}
    </div>
  );
};
