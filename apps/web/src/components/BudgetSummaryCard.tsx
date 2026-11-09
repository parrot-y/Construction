import React from 'react';
import { formatKes } from '../ui';

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
  projectName?: string;
}

export default function BudgetSummaryCard({
  summary = {
    approvedBudget: '45000000.00',
    approvedCost: '12450200.00',
    pendingCost: '1850000.00',
    rejectedCost: '0.00',
    remainingBudget: '32549800.00',
    consumptionPercentage: '27.67',
    categoryBreakdown: {
      MATERIAL: { approved: '6200000.00', pending: '850000.00'},
      LABOR: { approved: '3150000.00', pending: '500000.00'},
      PLANT: { approved: '1200200.00', pending: '250000.00'},
      SUBCONTRACT: { approved: '1100000.00', pending: '150000.00'},
      PRELIMINARY: { approved: '800000.00', pending: '100000.00'},
},
    varianceAlert: {
      hasWarning: false,
      message: null,
},
},
  projectName = '',
}: BudgetSummaryCardProps): React.JSX.Element {
  const percent = parseFloat(summary.consumptionPercentage) || 0;
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
<span className="text-xs font-bold font-mono text-slate-900">{summary.consumptionPercentage}%</span>
</div>
</div>

      {/* Neutral Variance Alert Banner */}
      {summary.varianceAlert?.hasWarning && (
<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
<span className="text-sm font-bold">ℹ</span>
<span>{summary.varianceAlert.message}</span>
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
<div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
<span>0%</span>
<span>50%</span>
<span>100% ({formatKes(summary.approvedBudget)})</span>
</div>
</div>

      {/* Financial Metrics Cards */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
<div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
<span className="text-[10px] font-semibold text-slate-500 block">
            Approved Budget
</span>
<span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
            {formatKes(summary.approvedBudget)}
</span>
</div>

<div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
<span className="text-[10px] font-semibold text-emerald-700 block">
            Actual Spent (Approved)
</span>
<span className="text-sm font-bold font-mono text-emerald-800 mt-1 block">
            {formatKes(summary.approvedCost)}
</span>
</div>

<div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
<span className="text-[10px] font-semibold text-amber-700 block">
            Pending Approval
</span>
<span className="text-sm font-bold font-mono text-amber-800 mt-1 block">
            {formatKes(summary.pendingCost)}
</span>
</div>

<div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200">
<span className="text-[10px] font-semibold text-blue-700 block">
            Remaining Budget
</span>
<span className="text-sm font-bold font-mono text-blue-800 mt-1 block">
            {formatKes(summary.remainingBudget)}
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
<span className="font-mono font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(summary.categoryBreakdown.MATERIAL.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block">
              +{formatKes(summary.categoryBreakdown.MATERIAL.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Labor</span>
<span className="font-mono font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(summary.categoryBreakdown.LABOR.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block">
              +{formatKes(summary.categoryBreakdown.LABOR.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Plant / Hire</span>
<span className="font-mono font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(summary.categoryBreakdown.PLANT.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block">
              +{formatKes(summary.categoryBreakdown.PLANT.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Subcontracts</span>
<span className="font-mono font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(summary.categoryBreakdown.SUBCONTRACT.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block">
              +{formatKes(summary.categoryBreakdown.SUBCONTRACT.pending)} pend
</span>
</div>

<div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] font-bold text-slate-600 block"> Prelims</span>
<span className="font-mono font-semibold text-slate-800 block text-[11px] mt-0.5">
              {formatKes(summary.categoryBreakdown.PRELIMINARY.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block">
              +{formatKes(summary.categoryBreakdown.PRELIMINARY.pending)} pend
</span>
</div>
</div>
</div>
</div>
);
}
