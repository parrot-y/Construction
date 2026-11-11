import React, { useEffect, useState} from 'react';
import { formatKes } from '../../../ui';

interface BoqItem { id: string; item_code: string; description: string; unit: string; quantity: string; unit_rate: string; total_amount: string; is_provisional?: boolean}
interface BoqSection { id: string; title: string; total_amount: string; items: BoqItem[]}
interface Boq { id: string; version: number; status: string; total_amount: string; sections: BoqSection[]}

const fmt = (n: string | number) => formatKes(n || 0);

/** Read-only active BOQ workbook (sections → items → amounts). */
export default function BoqWorkbookView({ projectId}: { projectId: string}): React.JSX.Element {
  const [boq, setBoq] = useState<Boq | null>(null);
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading');

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/boq`, { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) { setBoq(j.data); setState('ready' as any);}
        else setState('empty');
})
      .catch(() => setState('error'));
}, [projectId]);

  if (state === 'loading') return<p className="text-xs text-slate-400 p-6">Loading BOQ…</p>;
  if (state === 'error' || !boq) {
    return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No active BOQ</p>
<p className="text-xs text-slate-400 mt-1">Import an Excel BOQ from the PM/QS workspace to populate this view.</p>
</div>
);
}

  return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
<div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bill of Quantities</h3>
<p className="text-[11px] text-slate-400">Version {boq.version} · {boq.status}</p>
</div>
<span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(boq.total_amount)}</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-xs">
<thead>
<tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
<th className="px-5 py-2.5 font-semibold">Code</th>
<th className="px-3 py-2.5 font-semibold">Description</th>
<th className="px-3 py-2.5 font-semibold">Unit</th>
<th className="px-3 py-2.5 font-semibold text-right">Qty</th>
<th className="px-3 py-2.5 font-semibold text-right">Rate</th>
<th className="px-5 py-2.5 font-semibold text-right">Amount</th>
</tr>
</thead>
<tbody>
            {boq.sections.map((sec) => (
<React.Fragment key={sec.id}>
<tr className="bg-slate-50 dark:bg-slate-900/60">
<td colSpan={5} className="px-5 py-2 font-bold text-slate-800 dark:text-slate-200">{sec.title}</td>
<td className="px-5 py-2 text-right font-bold font-mono tabular-nums">{fmt(sec.total_amount)}</td>
</tr>
                {sec.items.map((it) => (
<tr key={it.id} className="border-t border-slate-50 dark:border-slate-800/60 text-slate-700 dark:text-slate-300">
<td className="px-5 py-2 font-mono tabular-nums text-[11px]">{it.item_code}</td>
<td className="px-3 py-2 max-w-[320px]">
                      {it.description}
                      {it.is_provisional &&<span className="ml-2 text-[9px] font-bold text-amber-600 ">provisional</span>}
</td>
<td className="px-3 py-2">{it.unit}</td>
<td className="px-3 py-2 text-right tabular-nums">{Number(it.quantity).toLocaleString()}</td>
<td className="px-3 py-2 text-right tabular-nums">{fmt(it.unit_rate)}</td>
<td className="px-5 py-2 text-right tabular-nums font-semibold">{fmt(it.total_amount)}</td>
</tr>
))}
</React.Fragment>
))}
</tbody>
</table>
</div>
</div>
);
}
