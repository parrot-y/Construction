import React from 'react';
import { formatKes } from '../ui';

export interface SectionBreakdownItem {
  sectionId: string;
  title: string;
  sectionTitle?: string;
  orderIdx?: number;
  allocatedBudget: string;
  actualSpent: string;
  pendingSpent?: string;
  remainingBudget: string;
  consumptionPercentage: string;
  isOverBudget: boolean;
  status: 'NORMAL' | 'WATCH' | 'OVERRUN';
  itemCount?: number;
}

export interface DetailedVarianceData {
  costConsumptionRatio?: string | number;
  physicalProgressRatio?: string | number;
  costConsumptionPercentage: string;
  physicalProgressPercentage: string;
  differenceRatio?: string | number;
  differencePercentage: string;
  hasWarning?: boolean;
  status: 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED';
  statusLabel: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface CategoryBreakdownData {
  MATERIAL: { approved: string; pending: string};
  LABOR: { approved: string; pending: string};
  PLANT: { approved: string; pending: string};
  SUBCONTRACT: { approved: string; pending: string};
  PRELIMINARY: { approved: string; pending: string};
}

export interface VarianceMonitorCardProps {
  projectName?: string;
  approvedBudget?: string;
  approvedCost?: string;
  pendingCost?: string;
  detailedVariance?: DetailedVarianceData;
  sectionBreakdown?: SectionBreakdownItem[];
  categoryBreakdown?: CategoryBreakdownData;
}

export default function VarianceMonitorCard({
  projectName = '',
  approvedBudget = '45000000.00',
  approvedCost = '12450200.00',
  pendingCost = '1850000.00',
  detailedVariance = {
    costConsumptionPercentage: '27.67',
    physicalProgressPercentage: '30.00',
    differencePercentage: '-2.33%',
    status: 'ON_TRACK',
    statusLabel: 'Normal Alignment',
    severity: 'info',
    message: 'Expenditure is aligned with recorded physical progress.',
},
  sectionBreakdown = [
    {
      sectionId: 'sec-1',
      title: 'Section 1: Preliminaries & General',
      allocatedBudget: '4500000.00',
      actualSpent: '1800000.00',
      pendingSpent: '200000.00',
      remainingBudget: '2700000.00',
      consumptionPercentage: '40.00',
      isOverBudget: false,
      status: 'NORMAL',
},
    {
      sectionId: 'sec-2',
      title: 'Section 2: Substructure & Earthworks',
      allocatedBudget: '12000000.00',
      actualSpent: '7500000.00',
      pendingSpent: '500000.00',
      remainingBudget: '4500000.00',
      consumptionPercentage: '62.50',
      isOverBudget: false,
      status: 'NORMAL',
},
    {
      sectionId: 'sec-3',
      title: 'Section 3: Reinforced Concrete Frame',
      allocatedBudget: '18500000.00',
      actualSpent: '2500000.00',
      pendingSpent: '800000.00',
      remainingBudget: '16000000.00',
      consumptionPercentage: '13.51',
      isOverBudget: false,
      status: 'NORMAL',
},
    {
      sectionId: 'sec-4',
      title: 'Section 4: Walling, Finishes & Services',
      allocatedBudget: '10000000.00',
      actualSpent: '650200.00',
      pendingSpent: '350000.00',
      remainingBudget: '9349800.00',
      consumptionPercentage: '6.50',
      isOverBudget: false,
      status: 'NORMAL',
},
  ],
  categoryBreakdown = {
    MATERIAL: { approved: '6200000.00', pending: '850000.00'},
    LABOR: { approved: '3150000.00', pending: '500000.00'},
    PLANT: { approved: '1200200.00', pending: '250000.00'},
    SUBCONTRACT: { approved: '1100000.00', pending: '150000.00'},
    PRELIMINARY: { approved: '800000.00', pending: '100000.00'},
},
}: VarianceMonitorCardProps): React.JSX.Element {
  const costPct = parseFloat(detailedVariance.costConsumptionPercentage) || 0;
  const physPct = parseFloat(detailedVariance.physicalProgressPercentage) || 0;

  // Status configuration per ADR-001 & ADR-005 (Strict Neutrality)
  const isActionRequired = detailedVariance.status === 'ACTION_REQUIRED';
  const isAttention = detailedVariance.status === 'ATTENTION';

  const statusBadgeClass = isActionRequired
    ? 'bg-rose-50 text-rose-800 border-rose-300'
    : isAttention
      ? 'bg-amber-50 text-amber-800 border-amber-300'
      : 'bg-emerald-50 text-emerald-800 border-emerald-300';

  const statusNoticeClass = isActionRequired
    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
    : isAttention
      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900';

  const statusIcon = isActionRequired ? '' : isAttention ? 'ℹ' : '';

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
      {/* 1. Header & Neutral Status Badge */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div>
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
<span className="text-[11px] font-bold text-slate-500">
              Variance Monitor &amp; Health Guard • {projectName}
</span>
</div>
<h3 className="text-lg font-bold text-slate-900 mt-1">
            Cost Consumption vs Physical Progress
</h3>
<p className="text-xs text-slate-500">
            Automated milestone valuation comparison enforcing strict neutral reporting
</p>
</div>

<div className="flex items-center gap-2">
<span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass} flex items-center gap-1.5`}
          >
<span>{statusIcon}</span>
<span>{`${detailedVariance.statusLabel} (${detailedVariance.status})`}</span>
</span>
<span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
            Δ {detailedVariance.differencePercentage}
</span>
</div>
</div>

      {/* 2. Neutral Health Notice Banner */}
<div className={`p-3.5 rounded-lg border ${statusNoticeClass} text-xs flex items-start gap-2.5 leading-relaxed`}>
<span className="text-base select-none">{statusIcon}</span>
<div>
<span className="font-bold block mb-0.5">Project Health Notice:</span>
<span>{detailedVariance.message}</span>
</div>
</div>

      {/* 3. Cost Consumption % vs Physical Progress % Comparison Bars */}
<div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-4">
<span className="text-xs font-bold text-slate-700 block">
          Progress vs Expenditure Real-time Alignment
</span>

        {/* Cost Consumption Bar */}
<div className="space-y-1.5">
<div className="flex justify-between items-center text-xs">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-purple-600" />
<span className="font-semibold text-slate-700">Cost Consumption (Approved)</span>
</div>
<span className="font-mono font-bold text-slate-900">
              {`${detailedVariance.costConsumptionPercentage}% (${formatKes(approvedCost)} of ${formatKes(approvedBudget)} • ${formatKes(pendingCost)} pending)`}
</span>
</div>
<div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
<div
              className={`h-3 rounded-full transition-all duration-500 ${
                isActionRequired ? 'bg-rose-500' : isAttention ? 'bg-amber-500' : 'bg-purple-600'
}`}
              style={{ width: `${Math.min(costPct, 100)}%`}}
            />
</div>
</div>

        {/* Physical Progress Bar */}
<div className="space-y-1.5">
<div className="flex justify-between items-center text-xs">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-blue-600" />
<span className="font-semibold text-slate-700">Physical Milestone Progress</span>
</div>
<span className="font-mono font-bold text-blue-700">
              {`${detailedVariance.physicalProgressPercentage}% (Verified On-Site)`}
</span>
</div>
<div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
<div
              className="h-3 rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${Math.min(physPct, 100)}%`}}
            />
</div>
</div>
</div>

      {/* 4. Category Cost Distribution */}
<div className="space-y-2">
<span className="text-xs font-bold text-slate-700 block">
          Category Cost Distribution (Approved / Pending)
</span>
<div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[11px] font-bold text-slate-600 block"> Materials</span>
<span className="font-mono font-bold text-slate-800 block text-xs mt-1">
              {formatKes(categoryBreakdown.MATERIAL.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block mt-0.5">
              +{formatKes(categoryBreakdown.MATERIAL.pending)} pend
</span>
</div>

<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[11px] font-bold text-slate-600 block"> Labor</span>
<span className="font-mono font-bold text-slate-800 block text-xs mt-1">
              {formatKes(categoryBreakdown.LABOR.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block mt-0.5">
              +{formatKes(categoryBreakdown.LABOR.pending)} pend
</span>
</div>

<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[11px] font-bold text-slate-600 block"> Plant / Hire</span>
<span className="font-mono font-bold text-slate-800 block text-xs mt-1">
              {formatKes(categoryBreakdown.PLANT.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block mt-0.5">
              +{formatKes(categoryBreakdown.PLANT.pending)} pend
</span>
</div>

<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[11px] font-bold text-slate-600 block"> Subcontracts</span>
<span className="font-mono font-bold text-slate-800 block text-xs mt-1">
              {formatKes(categoryBreakdown.SUBCONTRACT.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block mt-0.5">
              +{formatKes(categoryBreakdown.SUBCONTRACT.pending)} pend
</span>
</div>

<div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[11px] font-bold text-slate-600 block"> Preliminaries</span>
<span className="font-mono font-bold text-slate-800 block text-xs mt-1">
              {formatKes(categoryBreakdown.PRELIMINARY.approved)}
</span>
<span className="text-[10px] text-amber-600 font-mono block mt-0.5">
              +{formatKes(categoryBreakdown.PRELIMINARY.pending)} pend
</span>
</div>
</div>
</div>

      {/* 5. Section-by-Section BOQ Spend Table */}
<div className="space-y-2">
<span className="text-xs font-bold text-slate-700 block">
          BOQ Section-by-Section Spend Breakdown
</span>
<div className="border border-slate-200 rounded-lg overflow-hidden">
<table className="w-full text-left text-xs">
<thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold ">
<tr>
<th className="p-3">Section Description</th>
<th className="p-3 text-right">Allocated Budget</th>
<th className="p-3 text-right">Actual Spent</th>
<th className="p-3 text-right">Pending</th>
<th className="p-3 text-right">Remaining</th>
<th className="p-3 text-right">Consumed</th>
<th className="p-3 text-center">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
              {sectionBreakdown.map((sec) => {
                const title = sec.title || sec.sectionTitle || 'Section';
                const tagClass =
                  sec.status === 'OVERRUN'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : sec.status === 'WATCH'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                return (
<tr key={sec.sectionId} className="hover:bg-slate-50/50">
<td className="p-3 font-semibold text-slate-900">{title}</td>
<td className="p-3 text-right font-mono font-medium">{formatKes(sec.allocatedBudget)}</td>
<td className="p-3 text-right font-mono font-medium">{formatKes(sec.actualSpent)}</td>
<td className="p-3 text-right font-mono text-amber-700">
                      {formatKes(sec.pendingSpent || '0.00')}
</td>
<td className="p-3 text-right font-mono font-medium">{formatKes(sec.remainingBudget)}</td>
<td className="p-3 text-right font-mono font-bold">{`${sec.consumptionPercentage}%`}</td>
<td className="p-3 text-center">
<span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tagClass}`}>
                        {sec.status}
</span>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>
</div>
);
}
