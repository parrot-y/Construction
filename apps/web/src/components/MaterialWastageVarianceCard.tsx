import { formatKes} from '../ui';
import React, { useEffect, useState} from 'react';

export interface MaterialWastageItem {
  id: string;
  periodName: string;
  materialName: string;
  unitOfMeasure: string;
  theoreticalQuantity: string;
  actualConsumedQuantity: string;
  allowableWastagePct: string;
  actualWastagePct: string;
  varianceQuantity: string;
  unitCostKes: string;
  financialLossKes: string;
  status: 'WITHIN_TOLERANCE' | 'ELEVATED_LOSS' | 'CRITICAL_UNEXPLAINED_LOSS';
  investigationNotes?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface MaterialWastageSummary {
  totalReconciliations: number;
  totalFinancialLossKes: string;
  criticalLossesCount: number;
  elevatedCount: number;
  withinToleranceCount: number;
}

interface MaterialWastageVarianceCardProps {
  projectId: string;
  projectName?: string;
  reconciliations?: MaterialWastageItem[];
  summary?: MaterialWastageSummary;
  onRecordWastage?: (data: any) => Promise<void>;
}

export const MaterialWastageVarianceCard: React.FC<MaterialWastageVarianceCardProps> = ({
  projectId,
  projectName = 'Current Project',
  reconciliations: initialReconciliations,
  summary: initialSummary,
  onRecordWastage,
}) => {
  const [reconciliations, setReconciliations] = useState<MaterialWastageItem[]>(
    initialReconciliations || (import.meta.env.DEV ? [
      {
        id: 'w-01',
        periodName: 'Week 43 Ground Floor Slab Pour',
        materialName: '',
        unitOfMeasure: 'BAGS',
        theoreticalQuantity: '500.00',
        actualConsumedQuantity: '515.00',
        allowableWastagePct: '5.00',
        actualWastagePct: '3.00',
        varianceQuantity: '15.00',
        unitCostKes: '780.00',
        financialLossKes: '0.00',
        status: 'WITHIN_TOLERANCE',
        investigationNotes: 'Normal handling and batching tolerance per BS 8110',
        createdBy: 'Site QS David Kiprono',
        createdAt: '2026-11-02T10:00:00Z',
},
      {
        id: 'w-02',
        periodName: 'First Floor Columns & Beams Steel Takeoff',
        materialName: 'D16 High-Yield Rebar (Y16)',
        unitOfMeasure: 'TONNES',
        theoreticalQuantity: '10.00',
        actualConsumedQuantity: '12.20',
        allowableWastagePct: '5.00',
        actualWastagePct: '22.00',
        varianceQuantity: '2.20',
        unitCostKes: '140000.00',
        financialLossKes: '238000.00',
        status: 'CRITICAL_UNEXPLAINED_LOSS',
        investigationNotes: 'Excessive offcuts observed on site scrap heap; investigate bar bending yard',
        createdBy: 'Project Manager O. Odhiambo',
        createdAt: '2026-11-03T09:30:00Z',
},
    ] : [])
);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/material-wastage`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.reconciliations || json.data || []) as any[];
      setReconciliations(list.map((r) => ({
        id: r.id,
        periodName: r.periodName,
        materialName: r.materialName,
        unitOfMeasure: r.unitOfMeasure,
        theoreticalQuantity: r.theoreticalQuantity?.toString?.() ?? String(r.theoreticalQuantity ?? 0),
        actualConsumedQuantity: r.actualConsumedQuantity?.toString?.() ?? String(r.actualConsumedQuantity ?? 0),
        allowableWastagePct: r.allowableWastagePct?.toString?.() ?? String(r.allowableWastagePct ?? 0),
        actualWastagePct: r.actualWastagePct?.toString?.() ?? String(r.actualWastagePct ?? 0),
        varianceQuantity: r.varianceQuantity?.toString?.() ?? String(r.varianceQuantity ?? 0),
        unitCostKes: r.unitCostKes?.toString?.() ?? String(r.unitCostKes ?? 0),
        financialLossKes: r.financialLossKes?.toString?.() ?? String(r.financialLossKes ?? 0),
        status: r.status,
        investigationNotes: r.investigationNotes ?? null,
        createdBy: r.createdBy,
        createdAt: r.createdAt ?? '',
})));
} catch {
      setReconciliations([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [periodName, setPeriodName] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('BAGS');
  const [theoreticalQuantity, setTheoreticalQuantity] = useState('');
  const [actualConsumedQuantity, setActualConsumedQuantity] = useState('');
  const [allowableWastagePct, setAllowableWastagePct] = useState('5.00');
  const [unitCostKes, setUnitCostKes] = useState('');
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [createdBy, setCreatedBy] = useState('');

  // Computations
  const theo = parseFloat(theoreticalQuantity) || 0;
  const actual = parseFloat(actualConsumedQuantity) || 0;
  const allowable = parseFloat(allowableWastagePct) || 5;
  const unitCost = parseFloat(unitCostKes) || 0;

  const varianceQty = actual - theo;
  const actualWastagePct = theo > 0 ? ((varianceQty / theo) * 100).toFixed(2) : '0.00';
  const allowedThresholdQty = theo * (1 + allowable / 100);
  const excessQty = actual > allowedThresholdQty ? actual - allowedThresholdQty : 0;
  const financialLoss = excessQty * unitCost;

  const totalFinancialLoss = reconciliations
    .reduce((sum, r) => sum + Number(r.financialLossKes || 0), 0);
  const criticalCount = reconciliations.filter((r) => r.status === 'CRITICAL_UNEXPLAINED_LOSS').length;
  const withinTolCount = reconciliations.filter((r) => r.status === 'WITHIN_TOLERANCE').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName || !materialName || !theoreticalQuantity || !actualConsumedQuantity || !unitCostKes) return;

    setIsSubmitting(true);
    let computedStatus: 'WITHIN_TOLERANCE' | 'ELEVATED_LOSS' | 'CRITICAL_UNEXPLAINED_LOSS' = 'WITHIN_TOLERANCE';
    const numPct = parseFloat(actualWastagePct);
    if (numPct > allowable + 5) {
      computedStatus = 'CRITICAL_UNEXPLAINED_LOSS';
} else if (numPct > allowable) {
      computedStatus = 'ELEVATED_LOSS';
}

    const payload = {
      periodName,
      materialName,
      unitOfMeasure,
      theoreticalQuantity,
      actualConsumedQuantity,
      allowableWastagePct,
      unitCostKes,
      investigationNotes: investigationNotes || null,
      createdBy: createdBy || 'Site QS',
};

    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/material-wastage`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
});
        if (res.ok) {
          await reload();
          setIsSubmitting(false);
          setIsModalOpen(false);
          setPeriodName('');
          setMaterialName('');
          setTheoreticalQuantity('');
          setActualConsumedQuantity('');
          setUnitCostKes('');
          setInvestigationNotes('');
          return;
}
} catch { /* fall through to local */}
}

    if (onRecordWastage) {
      await onRecordWastage(payload);
} else {
      const newItem: MaterialWastageItem = {
        id: `w-${Date.now()}`,
        periodName,
        materialName,
        unitOfMeasure,
        theoreticalQuantity,
        actualConsumedQuantity,
        allowableWastagePct,
        actualWastagePct,
        varianceQuantity: varianceQty.toFixed(2),
        unitCostKes,
        financialLossKes: (excessQty * unitCost).toFixed(2),
        status: computedStatus,
        investigationNotes,
        createdBy: createdBy || 'Site QS',
        createdAt: new Date().toISOString(),
};
      setReconciliations([newItem, ...reconciliations]);
}

    setIsSubmitting(false);
    setIsModalOpen(false);
    setPeriodName('');
    setMaterialName('');
    setTheoreticalQuantity('');
    setActualConsumedQuantity('');
    setUnitCostKes('');
    setInvestigationNotes('');
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading wastage reconciliations...</div>;
}

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
<div>
<div className="flex items-center gap-2">
<span className="p-2 bg-rose-50 text-rose-700 rounded-lg text-lg"></span>
<h2 className="text-xl font-bold text-slate-900">Material Wastage & Shrinkage Engine</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
            BS 8110 / Eurocode 2 theoretical vs. actual consumption loss monitor for {projectName}
</p>
</div>
<button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
        >
<span>+</span> Log Wastage Takeoff
</button>
</div>

      {/* KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
<p className="text-xs font-semibold text-slate-500 ">Total Reconciled</p>
<p className="text-2xl font-bold text-slate-800 mt-1">
            {initialSummary?.totalReconciliations ?? reconciliations.length}
</p>
</div>
<div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
<p className="text-xs font-semibold text-emerald-700 ">Within Tolerance</p>
<p className="text-2xl font-bold text-emerald-900 mt-1">
            {initialSummary?.withinToleranceCount ?? withinTolCount}
</p>
</div>
<div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
<p className="text-xs font-semibold text-rose-700 ">Critical Theft/Loss Flags</p>
<p className="text-2xl font-bold text-rose-900 mt-1">
            {initialSummary?.criticalLossesCount ?? criticalCount}
</p>
</div>
<div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
<p className="text-xs font-semibold text-amber-700 ">Financial Leakage</p>
<p className="text-2xl font-bold text-amber-900 mt-1">
            {formatKes(initialSummary?.totalFinancialLossKes ?? totalFinancialLoss)}
</p>
</div>
</div>

      {/* Reconciliation Table */}
<div className="overflow-x-auto">
<table className="w-full text-left text-sm text-slate-600">
<thead className="bg-slate-50 text-slate-700 font-semibold text-xs border-b border-slate-200">
<tr>
<th className="py-3 px-4">Period & Cycle</th>
<th className="py-3 px-4">Material</th>
<th className="py-3 px-4">Theoretical Qty</th>
<th className="py-3 px-4">Actual Consumed</th>
<th className="py-3 px-4">Wastage %</th>
<th className="py-3 px-4">Financial Loss</th>
<th className="py-3 px-4">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
            {reconciliations.length === 0 ? (
<tr>
<td colSpan={7} className="py-8 text-center text-slate-400">
                  No material wastage records logged yet.
</td>
</tr>
) : (
              reconciliations.map((rec) => (
<tr key={rec.id} className="hover:bg-slate-50/80 transition">
<td className="py-3 px-4">
<p className="font-semibold text-slate-900">{rec.periodName}</p>
<p className="text-xs text-slate-400">{new Date(rec.createdAt).toLocaleDateString()}</p>
</td>
<td className="py-3 px-4 font-medium text-slate-800">
                    {rec.materialName}
</td>
<td className="py-3 px-4">
                    {rec.theoreticalQuantity}<span className="text-xs text-slate-400">{rec.unitOfMeasure}</span>
</td>
<td className="py-3 px-4 font-semibold text-slate-900">
                    {rec.actualConsumedQuantity}<span className="text-xs text-slate-400">{rec.unitOfMeasure}</span>
</td>
<td className="py-3 px-4">
<span
                      className={`tabular-nums font-bold ${
                        Number(rec.actualWastagePct) > Number(rec.allowableWastagePct)
                          ? 'text-rose-600'
                          : 'text-emerald-600'
}`}
                    >
                      {rec.actualWastagePct}%
</span>
<span className="text-xs text-slate-400 ml-1">(Allowable: {rec.allowableWastagePct}%)</span>
</td>
<td className="py-3 px-4 font-bold text-slate-900">
                    {Number(rec.financialLossKes) > 0 ? (
<span className="text-rose-600">
                        {formatKes(rec.financialLossKes)}
</span>
) : (
<span className="text-emerald-600">{formatKes(0)}</span>
)}
</td>
<td className="py-3 px-4">
<span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        rec.status === 'WITHIN_TOLERANCE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.status === 'ELEVATED_LOSS'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800 animate-pulse'
}`}
                    >
                      {rec.status === 'WITHIN_TOLERANCE'
                        ? 'Standard Tolerance'
                        : rec.status === 'ELEVATED_LOSS'
                        ? 'Elevated Loss'
                        : 'Critical Unexplained Loss'}
</span>
</td>
</tr>
))
)}
</tbody>
</table>
</div>

      {/* Record Modal */}
      {isModalOpen && (
<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 className="text-lg font-bold text-slate-900">Compute Material Wastage</h3>
<button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                
</button>
</div>

<form onSubmit={handleSubmit} className="space-y-4 text-sm">
<div>
<label className="block font-medium text-slate-700 mb-1">Pour / Cycle / Period Name *</label>
<input
                  type="text"
                  required
                  placeholder="e.g. Week 44 2nd Floor Beam & Slab Pour"
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Material Name *</label>
<input
                    type="text"
                    required
                    placeholder="e.g. D16 Rebar, Cement 42.5N"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Unit of Measure *</label>
<select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
<option value="BAGS">BAGS</option>
<option value="TONNES">TONNES</option>
<option value="TRIPS">TRIPS</option>
<option value="PIECES">PIECES</option>
<option value="M3">M3</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Theoretical Takeoff Qty *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500"
                    value={theoreticalQuantity}
                    onChange={(e) => setTheoreticalQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Actual Consumed Qty *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 520"
                    value={actualConsumedQuantity}
                    onChange={(e) => setActualConsumedQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-medium text-slate-700 mb-1">Allowable Wastage (%)</label>
<input
                    type="number"
                    step="0.01"
                    value={allowableWastagePct}
                    onChange={(e) => setAllowableWastagePct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
</div>
<div>
<label className="block font-medium text-slate-700 mb-1">Unit Cost (KES) *</label>
<input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 780"
                    value={unitCostKes}
                    onChange={(e) => setUnitCostKes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
</div>
</div>

              {/* Dynamic Preview */}
<div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
<div>
<span className="text-slate-500">Calculated Wastage:</span>
<span className={`font-bold tabular-nums ${parseFloat(actualWastagePct) > allowable ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {actualWastagePct}%
</span>
</div>
<div>
<span className="text-slate-500">Financial Leakage:</span>
<span className="font-bold text-slate-900 tabular-nums">{formatKes(financialLoss)}</span>
</div>
</div>

<div>
<label className="block font-medium text-slate-700 mb-1">QS / Recorded By</label>
<input
                  type="text"
                  placeholder="e.g. Site QS David Kiprono"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
</div>

<div>
<label className="block font-medium text-slate-700 mb-1">Investigation Notes</label>
<textarea
                  rows={2}
                  placeholder="Notes on bar bending yard, site storage, or handling breakage"
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
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
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Calculating...' : 'Save Reconciliation'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
