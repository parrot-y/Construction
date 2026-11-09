import React, { useState} from 'react';

export interface SCurveDataPoint {
  periodMonth: string;
  plannedValueKes: string;
  actualCostKes: string;
  earnedValueKes: string;
  cpi: string;
  spi: string;
  clientBilledKes: string;
  netCashFlowKes: string;
  status: 'AHEAD_UNDER_BUDGET' | 'ON_TRACK' | 'COST_OVERRUN' | 'SCHEDULE_DELAY' | 'CRITICAL_DIVERGENCE';
  notes?: string | null;
}

export interface CashFlowMetrics {
  cumulativePlannedValueKes: string;
  cumulativeActualCostKes: string;
  cumulativeEarnedValueKes: string;
  cumulativeClientBilledKes: string;
  cumulativeNetCashFlowKes: string;
  cpi: string;
  spi: string;
  estimateAtCompletionKes: string;
  varianceAtCompletionKes: string;
}

interface ProjectSCurveCashFlowCardProps {
  projectId: string;
  projectName?: string;
  budgetAtCompletionKes?: string;
  metrics?: CashFlowMetrics;
  sCurveSeries?: SCurveDataPoint[];
  onRecordPoint?: (data: any) => Promise<void>;
}

export const ProjectSCurveCashFlowCard: React.FC<ProjectSCurveCashFlowCardProps> = ({
  projectId: _projectId,
  projectName = 'Current Project',
  budgetAtCompletionKes = '0.00',
  metrics: initialMetrics,
  sCurveSeries: initialSeries,
  onRecordPoint,
}) => {
  const [series, setSeries] = useState<SCurveDataPoint[]>(
    initialSeries || []
);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [periodMonth, setPeriodMonth] = useState('');
  const [plannedValueKes, setPlannedValueKes] = useState('');
  const [actualCostKes, setActualCostKes] = useState('');
  const [earnedValueKes, setEarnedValueKes] = useState('');
  const [clientBilledKes, setClientBilledKes] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive metrics
  const latestPoint = series[series.length - 1];
  const cpi = initialMetrics?.cpi ?? latestPoint?.cpi ?? '—';
  const spi = initialMetrics?.spi ?? latestPoint?.spi ?? '—';
  const eacNum = parseFloat(cpi);
  const eac = initialMetrics?.estimateAtCompletionKes ?? (eacNum > 0 ? (Number(budgetAtCompletionKes) / eacNum).toFixed(2) : '0.00');
  const netCashFlow = initialMetrics?.cumulativeNetCashFlowKes ?? latestPoint?.netCashFlowKes ?? '0.00';

  // SVG Chart Dimensions & Calculations
  const chartWidth = 600;
  const chartHeight = 220;
  const padding = 40;

  const maxVal = Math.max(
    Number(budgetAtCompletionKes),
    ...series.map((s) => Math.max(Number(s.plannedValueKes), Number(s.actualCostKes), Number(s.earnedValueKes)))
) * 1.1;

  const getX = (index: number) => {
    if (series.length<= 1) return padding;
    return padding + (index / (series.length - 1)) * (chartWidth - padding * 2);
};

  const getY = (val: number) => {
    if (maxVal<= 0) return chartHeight - padding;
    return chartHeight - padding - (val / maxVal) * (chartHeight - padding * 2);
};

  const pvPoints = series.map((s, i) => `${getX(i)},${getY(Number(s.plannedValueKes))}`).join(' ');
  const acPoints = series.map((s, i) => `${getX(i)},${getY(Number(s.actualCostKes))}`).join(' ');
  const evPoints = series.map((s, i) => `${getX(i)},${getY(Number(s.earnedValueKes))}`).join(' ');

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodMonth || !plannedValueKes || !actualCostKes || !earnedValueKes) return;

    setIsSubmitting(true);
    const pv = parseFloat(plannedValueKes);
    const ac = parseFloat(actualCostKes);
    const ev = parseFloat(earnedValueKes);
    const billed = parseFloat(clientBilledKes) || 0;

    const calcCpi = ac > 0 ? (ev / ac).toFixed(4) : '1.0000';
    const calcSpi = pv > 0 ? (ev / pv).toFixed(4) : '1.0000';
    const net = (billed - ac).toFixed(2);

    let status: 'AHEAD_UNDER_BUDGET' | 'ON_TRACK' | 'COST_OVERRUN' | 'SCHEDULE_DELAY' | 'CRITICAL_DIVERGENCE' = 'ON_TRACK';
    if (parseFloat(calcCpi) >= 1.05 && parseFloat(calcSpi) >= 1.05) status = 'AHEAD_UNDER_BUDGET';
    else if (parseFloat(calcCpi)< 0.9 && parseFloat(calcSpi)< 0.9) status = 'CRITICAL_DIVERGENCE';
    else if (parseFloat(calcCpi)< 0.95) status = 'COST_OVERRUN';
    else if (parseFloat(calcSpi)< 0.95) status = 'SCHEDULE_DELAY';

    const payload = {
      periodMonth,
      plannedValueKes,
      actualCostKes,
      earnedValueKes,
      clientBilledKes: clientBilledKes || '0.00',
      notes,
};

    if (onRecordPoint) {
      await onRecordPoint(payload);
} else {
      const newPoint: SCurveDataPoint = {
        periodMonth,
        plannedValueKes,
        actualCostKes,
        earnedValueKes,
        cpi: calcCpi,
        spi: calcSpi,
        clientBilledKes: clientBilledKes || '0.00',
        netCashFlowKes: net,
        status,
        notes,
};
      setSeries([...series.filter((s) => s.periodMonth !== periodMonth), newPoint].sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)));
}

    setIsSubmitting(false);
    setIsModalOpen(false);
    setPeriodMonth('');
    setPlannedValueKes('');
    setActualCostKes('');
    setEarnedValueKes('');
    setClientBilledKes('');
};

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
<div>
<div className="flex items-center gap-2">
<span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-lg"></span>
<h2 className="text-xl font-bold text-slate-900">Project Cash Flow & S-Curve Forecasting</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
            Earned Value Management (EVM), S-Curve trajectory, and liquidity forecast for {projectName}
</p>
</div>
<button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
<span>+</span> Record Monthly Valuation
</button>
</div>

      {/* EVM KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost Performance (CPI)</p>
<div className="flex items-baseline gap-2 mt-1">
<span className={`text-2xl font-bold ${parseFloat(cpi) >= 1.0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {cpi}
</span>
<span className="text-xs text-slate-500">
              {parseFloat(cpi) >= 1.0 ? 'Under Budget' : 'Cost Overrun'}
</span>
</div>
</div>

<div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule Index (SPI)</p>
<div className="flex items-baseline gap-2 mt-1">
<span className={`text-2xl font-bold ${parseFloat(spi) >= 1.0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {spi}
</span>
<span className="text-xs text-slate-500">
              {parseFloat(spi) >= 1.0 ? 'Ahead of Schedule' : 'Schedule Lag'}
</span>
</div>
</div>

<div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
<p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Forecast at Completion</p>
<p className="text-xl font-bold text-indigo-900 mt-1">
            {Number(eac) > 0 ? `KES ${Number(eac).toLocaleString('en-KE', { minimumFractionDigits: 0})}` : '—'}
</p>
<p className="text-xs text-indigo-600 mt-0.5">
            BAC: KES {Number(budgetAtCompletionKes).toLocaleString('en-KE', { minimumFractionDigits: 0})}
</p>
</div>

<div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
<p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Net Cash Flow (Liquidity)</p>
<p className="text-xl font-bold text-emerald-900 mt-1">
            KES {Number(netCashFlow).toLocaleString('en-KE', { minimumFractionDigits: 0})}
</p>
<p className="text-xs text-emerald-700 mt-0.5">Billed vs Paid to Date</p>
</div>
</div>

      {/* SVG S-Curve Chart */}
<div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
<div className="flex justify-between items-center mb-2 text-xs font-medium text-slate-600">
<div className="flex items-center gap-4">
<div className="flex items-center gap-1.5">
<span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
<span>Planned Value (PV)</span>
</div>
<div className="flex items-center gap-1.5">
<span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
<span>Earned Value (EV)</span>
</div>
<div className="flex items-center gap-1.5">
<span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
<span>Actual Cost (AC)</span>
</div>
</div>
<span className="text-slate-400">Cumulative KES Millions</span>
</div>

<div className="w-full overflow-x-auto">
<svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-56 font-sans text-xs"
          >
            {/* Grid Lines */}
<line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="3 3" />
<line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
<line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Curves */}
            {pvPoints && (
<polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                points={pvPoints}
              />
)}
            {evPoints && (
<polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points={evPoints}
              />
)}
            {acPoints && (
<polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                points={acPoints}
              />
)}

            {/* Data Dots & Period Labels */}
            {series.map((s, i) => {
              const x = getX(i);
              return (
<g key={s.periodMonth}>
<circle cx={x} cy={getY(Number(s.plannedValueKes))} r="4" fill="#3b82f6" />
<circle cx={x} cy={getY(Number(s.earnedValueKes))} r="4" fill="#10b981" />
<circle cx={x} cy={getY(Number(s.actualCostKes))} r="4" fill="#f43f5e" />
<text x={x} y={chartHeight - 15} textAnchor="middle" fill="#64748b" fontSize="10">
                    {s.periodMonth}
</text>
</g>
);
})}
</svg>
</div>
</div>

      {/* Monthly Periods Breakdown Table */}
<div className="overflow-x-auto">
<table className="w-full text-left text-sm text-slate-600">
<thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs border-b border-slate-200">
<tr>
<th className="py-3 px-4">Period Month</th>
<th className="py-3 px-4">Planned Value (PV)</th>
<th className="py-3 px-4">Earned Value (EV)</th>
<th className="py-3 px-4">Actual Cost (AC)</th>
<th className="py-3 px-4">CPI</th>
<th className="py-3 px-4">SPI</th>
<th className="py-3 px-4">Net Cash Flow</th>
<th className="py-3 px-4">EVM Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
            {series.map((item) => (
<tr key={item.periodMonth} className="hover:bg-slate-50/80 transition">
<td className="py-3 px-4 font-mono font-semibold text-slate-900">{item.periodMonth}</td>
<td className="py-3 px-4">KES {Number(item.plannedValueKes).toLocaleString('en-KE')}</td>
<td className="py-3 px-4 font-semibold text-emerald-700">
                  KES {Number(item.earnedValueKes).toLocaleString('en-KE')}
</td>
<td className="py-3 px-4 text-slate-900">KES {Number(item.actualCostKes).toLocaleString('en-KE')}</td>
<td className="py-3 px-4 font-mono font-medium">{item.cpi}</td>
<td className="py-3 px-4 font-mono font-medium">{item.spi}</td>
<td className="py-3 px-4 font-bold text-slate-900">
                  KES {Number(item.netCashFlowKes).toLocaleString('en-KE')}
</td>
<td className="py-3 px-4">
<span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      item.status === 'AHEAD_UNDER_BUDGET'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'ON_TRACK'
                        ? 'bg-blue-100 text-blue-800'
                        : item.status === 'SCHEDULE_DELAY'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
}`}
                  >
                    {item.status.replace(/_/g, ' ')}
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>

      {/* Record Modal */}
      {isModalOpen && (
<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 className="text-lg font-bold text-slate-900">Record Monthly Cash Flow & EVM</h3>
<button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                
</button>
</div>

<form onSubmit={handleRecord} className="space-y-4 text-sm">
<div>
<label className="block font-medium text-slate-700 mb-1">Period Month (YYYY-MM) *</label>
<input
                  type="text"
                  required
                  pattern="^\d{4}-\d{2}$"
                  placeholder="e.g. 2026-11"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Planned Value (PV KES) *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 15000000"
                    value={plannedValueKes}
                    onChange={(e) => setPlannedValueKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Actual Cost (AC KES) *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 14200000"
                    value={actualCostKes}
                    onChange={(e) => setActualCostKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Earned Value (EV KES) *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 14800000"
                    value={earnedValueKes}
                    onChange={(e) => setEarnedValueKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Client Billed (KES)</label>
<input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 16000000"
                    value={clientBilledKes}
                    onChange={(e) => setClientBilledKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>
</div>

<div>
<label className="block font-medium text-slate-700 mb-1">Operational Notes</label>
<textarea
                  rows={2}
                  placeholder="e.g. Substructure completed, billing submitted for Interim Payment Certificate #4"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
</div>

<div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Record S-Curve Point'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
