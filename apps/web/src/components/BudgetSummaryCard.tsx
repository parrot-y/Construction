import React, { useEffect, useState } from 'react';
import { formatKes, EmptyState } from '../ui';

export interface BudgetSummaryData {
  approvedBudget: string;
  approvedCost: string;
  pendingCost: string;
  rejectedCost: string;
  remainingBudget: string;
  consumptionPercentage: string;
  categoryBreakdown: {
    MATERIAL: { approved: string; pending: string};
    LABOR: { approved: string; pending: string};
    PLANT: { approved: string; pending: string};
    SUBCONTRACT: { approved: string; pending: string};
    PRELIMINARY: { approved: string; pending: string};
};
  varianceAlert: {
    hasWarning: boolean;
    message: string | null;
};
}

interface BudgetSummaryCardProps {
  summary?: BudgetSummaryData;
  projectId?: string;
  projectName?: string;
}

export default function BudgetSummaryCard({
  summary,
  projectId,
  projectName = '',
}: BudgetSummaryCardProps): React.JSX.Element {
  const [live, setLive] = useState<BudgetSummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (summary || !projectId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/budget/summary`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const d = j.data || j;
        if (d?.approvedBudget) {
          setLive({
            approvedBudget: d.approvedBudget,
            approvedCost: d.approvedCost,
            pendingCost: d.pendingCost,
            rejectedCost: d.rejectedCost,
            remainingBudget: d.remainingBudget,
            consumptionPercentage: d.consumptionPercentage,
            categoryBreakdown: d.categoryBreakdown,
            varianceAlert: d.varianceAlert,
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [summary, projectId]);

  const resolved = summary ?? live;
  if (!resolved) {
    return loading ? (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <span className="text-[11px] font-bold text-slate-500">Financial Ledger Baseline • {projectName}</span>
        <p className="text-xs text-slate-500 mt-2">Loading budget summary…</p>
      </div>
    ) : (
      <EmptyState
        title="No budget data yet"
        hint="Approved budget, costs and category breakdown appear here once the project BOQ and cost entries exist."
      />
    );
  }

  const percent = parseFloat(resolved.consumptionPercentage) || 0;
  const isHighConsumption = percent > 80;

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
      {/* Header */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[11px] font-bold text-slate-500">
            Financial Ledger Baseline • {projectName}
</span>
<h3 className="text-base font-bold text-slate-900 mt-0.5">Budget vs Actual Expenditure</h3>
</div>
<div className="text-right">
<span className="text-xs font-medium text-slate-500">Budget Consumed:</span>
<span className="text-xs font-bold tabular-nums text-slate-900">{resolved.consumptionPercentage}%</span>
</div>
</div>

      {/* Neutral Variance Alert Banner */}
      {resolved.varianceAlert?.hasWarning && (
<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
<span className="text-sm font-bold">ℹ</span>
<span>{resolved.varianceAlert.message}</span>
</div>
)}

      {/* Progress Bar */}
<div>
<div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
<div
            className={`h-2.5 transition-all duration-500 ${isHighConsumption ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(percent, 100)}%`}}
          ></div>
</div>
<div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 tabular-nums">
<span>0%</span>
<span>50%</span>
<span>100% ({formatKes(resolved.approvedBudget)})</span>
</div>
</div>

      {/* Financial Metrics Cards */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
<div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
<span className="text-[10px] font-semibold text-slate-500 block">
            Approved Budget
</span>
<span className="text-sm font-bold tabular-nums text-slate-900 mt-1 block">
            {formatKes(resolved.approvedBudget)}
</span>
</div>

<div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
<span className="text-[10px] font-semibold text-emerald-700 block">
            Actual Spent (Approved)
</span>
<span className="text-sm font-bold tabular-nums text-emerald-800 mt-1 block">
            {formatKes(resolved.approvedCost)}
</span>
</div>

<div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
<span className="text-[10px] font-semibold text-amber-700 block">
            Pending Approval
</span>
<span className="text-sm font-bold tabular-nums text-amber-800 mt-1 block">
            {formatKes(resolved.pendingCost)}
</span>
</div>

<div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200">
<span className="text-[10px] font-semibold text-blue-700 block">
            Remaining Budget
</span>
<span className="text-sm font-bold tabular-nums text-blue-800 mt-1 block">
            {formatKes(resolved.remainingBudget)}
</span>
</div>
</div>

      {/* Category Breakdown Breakdown Accordion / Pills */}
<div className="pt-2 border-t border-slate-100">
<span className="text-[11px] font-semibold text-slate-600 block mb-2">
          Category Cost Distribution (Approved / Pending):
</span>
<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Materials</span>
<span className="tabular-nums font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(resolved.categoryBreakdown.MATERIAL.approved)}
</span>
<span className="text-[10px] text-amber-600 tabular-nums block">
              +{formatKes(resolved.categoryBreakdown.MATERIAL.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Labor</span>
<span className="tabular-nums font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(resolved.categoryBreakdown.LABOR.approved)}
</span>
<span className="text-[10px] text-amber-600 tabular-nums block">
              +{formatKes(resolved.categoryBreakdown.LABOR.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Plant / Hire</span>
<span className="tabular-nums font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(resolved.categoryBreakdown.PLANT.approved)}
</span>
<span className="text-[10px] text-amber-600 tabular-nums block">
              +{formatKes(resolved.categoryBreakdown.PLANT.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Subcontracts</span>
<span className="tabular-nums font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(resolved.categoryBreakdown.SUBCONTRACT.approved)}
</span>
<span className="text-[10px] text-amber-600 tabular-nums block">
              +{formatKes(resolved.categoryBreakdown.SUBCONTRACT.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Prelims</span>
<span className="tabular-nums font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(resolved.categoryBreakdown.PRELIMINARY.approved)}
</span>
<span className="text-[10px] text-amber-600 tabular-nums block">
              +{formatKes(resolved.categoryBreakdown.PRELIMINARY.pending)} pend
</span>
</div>
</div>
</div>
</div>
);
}
