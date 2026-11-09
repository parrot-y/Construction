import React, { useEffect, useState} from 'react';

export interface AsphaltBatchRecord {
  id: string;
  ticketNumber: string;
  supplierName: string;
  mixType: 'AC_20_BASE' | 'AC_14_WEARING' | 'SUPERPAVE_19' | 'SUPERPAVE_12_5' | 'BITUMEN_MACADAM';
  truckRegNo: string;
  tonnageTons: string;
  chainage: string;
  chainageStart?: string;
  chainageEnd?: string;
  laneDirection?: string;
  plantTempC?: string;
  deliveryTempC: string;
  breakdownTempC?: string;
  finishTempC: string;
  thermalVerdict: 'COMPLIANT' | 'COLD_MIX_WARNING' | 'REJECTED_COLD_PAVING';
  coreThicknessMm?: string | null;
  designThicknessMm?: string;
  coreDensityGCm3?: string | null;
  marshallDensityGCm3?: string | null;
  compactionPercent?: string | null;
  qaVerdict: 'PENDING_CORES' | 'ACCEPTED' | 'CONDITIONAL_PENALTY' | 'REJECTED_UNDER_COMPACTED';
  status: 'IN_TRANSIT' | 'PAVING' | 'ROLLING' | 'LAID' | 'CORED' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
}

interface AsphaltPavementViewProps {
  projectId: string;
  projectName?: string;
  initialBatches?: AsphaltBatchRecord[];
  onRegisterBatch?: (batch: any) => Promise<void>;
  onRecordCoreTest?: (batchId: string, core: any) => Promise<void>;
}

const DEFAULT_BATCHES: AsphaltBatchRecord[] = [
  {
    id: 'asp-001',
    ticketNumber: 'ASP-COL-88910',
    supplierName: 'Colas East Africa Ltd',
    mixType: 'AC_14_WEARING',
    truckRegNo: 'KDF 994L',
    tonnageTons: '24.50',
    chainage: 'Ch 12+100 - 12+350 (MAIN_CARRIAGEWAY)',
    chainageStart: 'Ch 12+100',
    chainageEnd: 'Ch 12+350',
    laneDirection: 'MAIN_CARRIAGEWAY',
    plantTempC: '165.0',
    deliveryTempC: '148.0',
    breakdownTempC: '132.0',
    finishTempC: '92.0',
    thermalVerdict: 'COMPLIANT',
    coreThicknessMm: '52.0',
    designThicknessMm: '50.00',
    coreDensityGCm3: '2.340',
    marshallDensityGCm3: '2.400',
    compactionPercent: '97.50',
    qaVerdict: 'ACCEPTED',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
},
  {
    id: 'asp-002',
    ticketNumber: 'ASP-HY-44021',
    supplierName: 'H-Young Asphalt Plant',
    mixType: 'AC_20_BASE',
    truckRegNo: 'KBZ 119M',
    tonnageTons: '28.00',
    chainage: 'Ch 12+350 - 12+600 (NORTHBOUND)',
    chainageStart: 'Ch 12+350',
    chainageEnd: 'Ch 12+600',
    laneDirection: 'NORTHBOUND',
    plantTempC: '160.0',
    deliveryTempC: '142.0',
    breakdownTempC: '128.0',
    finishTempC: '86.0',
    thermalVerdict: 'COMPLIANT',
    designThicknessMm: '60.00',
    qaVerdict: 'PENDING_CORES',
    status: 'LAID',
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
},
  {
    id: 'asp-003',
    ticketNumber: 'ASP-COL-88944',
    supplierName: 'Colas East Africa Ltd',
    mixType: 'AC_14_WEARING',
    truckRegNo: 'KCG 440P',
    tonnageTons: '22.00',
    chainage: 'Ch 12+600 - 12+800 (SOUTHBOUND)',
    chainageStart: 'Ch 12+600',
    chainageEnd: 'Ch 12+800',
    laneDirection: 'SOUTHBOUND',
    plantTempC: '150.0',
    deliveryTempC: '131.0',
    breakdownTempC: '115.0',
    finishTempC: '76.0',
    thermalVerdict: 'REJECTED_COLD_PAVING',
    designThicknessMm: '50.00',
    qaVerdict: 'REJECTED_UNDER_COMPACTED',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
},
];

export const AsphaltPavementView: React.FC<AsphaltPavementViewProps> = ({
  projectId,
  projectName = 'Kilimani Commercial Complex',
  initialBatches = import.meta.env.DEV ? DEFAULT_BATCHES : [],
  onRegisterBatch,
  onRecordCoreTest,
}) => {
  const [batches, setBatches] = useState<AsphaltBatchRecord[]>(initialBatches);
  const [filterMix, setFilterMix] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showCoreModal, setShowCoreModal] = useState<boolean>(false);
  const [selectedBatch, setSelectedBatch] = useState<AsphaltBatchRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Batch Form State
  const [ticketNo, setTicketNo] = useState(`ASP-TKT-${Date.now().toString().slice(-4)}`);
  const [supplierName, setSupplierName] = useState('Colas East Africa Ltd');
  const [mixType, setMixType] = useState<AsphaltBatchRecord['mixType']>('AC_14_WEARING');
  const [truckReg, setTruckReg] = useState('');
  const [tonnage, setTonnage] = useState('24.50');
  const [chainageStart, setChainageStart] = useState('Ch 0+000');
  const [chainageEnd, setChainageEnd] = useState('Ch 0+250');
  const [laneDirection, setLaneDirection] = useState('MAIN_CARRIAGEWAY');
  const [plantTemp, setPlantTemp] = useState('165.0');
  const [deliveryTemp, setDeliveryTemp] = useState('148.0');
  const [breakdownTemp, setBreakdownTemp] = useState('132.0');
  const [finishTemp, setFinishTemp] = useState('90.0');
  const [designThickness, setDesignThickness] = useState('50.00');
  const [inspectorName, setInspectorName] = useState('Resident Pavement Eng');

  // Core Test Form State
  const [coreThickness, setCoreThickness] = useState('52.00');
  const [coreDensity, setCoreDensity] = useState('2.340');
  const [marshallDensity, setMarshallDensity] = useState('2.400');

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/asphalt-batches`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.batches || []) as any[];
      setBatches(list.map((b) => ({
        id: b.id,
        ticketNumber: b.ticketNumber,
        supplierName: b.supplierName,
        mixType: b.mixType,
        truckRegNo: b.truckRegNo,
        tonnageTons: b.tonnageTons,
        chainage: b.chainage,
        deliveryTempC: b.deliveryTempC,
        finishTempC: b.finishTempC,
        thermalVerdict: b.thermalVerdict,
        coreThicknessMm: b.coreThicknessMm ?? null,
        designThicknessMm: b.designThicknessMm ?? undefined,
        coreDensityGCm3: b.coreDensityGCm3 ?? null,
        marshallDensityGCm3: b.marshallDensityGCm3 ?? null,
        compactionPercent: b.compactionPercent ?? null,
        qaVerdict: b.qaVerdict,
        status: b.status,
        createdAt: b.createdAt,
})));
} catch {
      setBatches([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const getThermalBadge = (verdict: AsphaltBatchRecord['thermalVerdict']) => {
    switch (verdict) {
      case 'COMPLIANT':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"> Thermal Compliant</span>;
      case 'COLD_MIX_WARNING':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"> Thermal Alert (&lt;140°C)</span>;
      case 'REJECTED_COLD_PAVING':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300"> REJECT: Cold Paving</span>;
}
};

  const getQaBadge = (verdict: AsphaltBatchRecord['qaVerdict']) => {
    switch (verdict) {
      case 'ACCEPTED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Accepted (≥97% Compaction)</span>;
      case 'CONDITIONAL_PENALTY':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Penalty (Thickness Deficit)</span>;
      case 'REJECTED_UNDER_COMPACTED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Rejected (Under-Compacted)</span>;
      case 'PENDING_CORES':
        return<span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Pending Cores</span>;
}
};

  const filteredBatches = batches.filter((b) => {
    const matchesMix = filterMix === 'ALL' || b.mixType === filterMix;
    const matchesSearch =
      b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.truckRegNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.chainage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMix && matchesSearch;
});

  const totalBatches = batches.length;
  const totalTonnageSum = batches.reduce((acc, b) => acc + parseFloat(b.tonnageTons || '0'), 0);
  const compliantCount = batches.filter((b) => b.thermalVerdict === 'COMPLIANT').length;
  const coredCount = batches.filter((b) => b.coreDensityGCm3 != null || b.coreThicknessMm != null).length;

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const dTemp = parseFloat(deliveryTemp);
      const fTemp = parseFloat(finishTemp);
      let thermalVerdict: AsphaltBatchRecord['thermalVerdict'] = 'COMPLIANT';
      if (dTemp< 135 || fTemp< 80) thermalVerdict = 'REJECTED_COLD_PAVING';
      else if (dTemp< 140 || fTemp< 85) thermalVerdict = 'COLD_MIX_WARNING';

      const newRecord: AsphaltBatchRecord = {
        id: `asp-${Date.now()}`,
        ticketNumber: ticketNo,
        supplierName,
        mixType,
        truckRegNo: truckReg,
        tonnageTons: parseFloat(tonnage).toFixed(2),
        chainage: `${chainageStart} - ${chainageEnd} (${laneDirection})`,
        chainageStart,
        chainageEnd,
        laneDirection,
        plantTempC: parseFloat(plantTemp).toFixed(1),
        deliveryTempC: parseFloat(deliveryTemp).toFixed(1),
        breakdownTempC: parseFloat(breakdownTemp).toFixed(1),
        finishTempC: parseFloat(finishTemp).toFixed(1),
        thermalVerdict,
        designThicknessMm: parseFloat(designThickness).toFixed(2),
        qaVerdict: 'PENDING_CORES',
        status: thermalVerdict === 'REJECTED_COLD_PAVING' ? 'REJECTED' : 'LAID',
        createdAt: new Date().toISOString(),
};

      if (isLive) {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/asphalt-batches`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              ticketNumber: newRecord.ticketNumber,
              supplierName: newRecord.supplierName,
              mixType: newRecord.mixType,
              truckRegNo: newRecord.truckRegNo,
              tonnageTons: parseFloat(newRecord.tonnageTons),
              chainageStart: newRecord.chainageStart ?? chainageStart,
              chainageEnd: newRecord.chainageEnd ?? chainageEnd,
              laneDirection: newRecord.laneDirection ?? laneDirection,
              plantTempC: parseFloat(newRecord.plantTempC ?? plantTemp),
              deliveryTempC: parseFloat(newRecord.deliveryTempC),
              breakdownTempC: parseFloat(newRecord.breakdownTempC ?? breakdownTemp),
              finishTempC: parseFloat(newRecord.finishTempC),
              designThicknessMm: parseFloat(newRecord.designThicknessMm ?? designThickness),
              inspectedBy: inspectorName,
}),
});
          if (res.ok) {
            await reload();
            setShowAddModal(false);
            setTruckReg('');
            return;
}
} catch { /* fall through to local */}
}

      if (onRegisterBatch) {
        await onRegisterBatch(newRecord);
}

      setBatches([newRecord, ...batches]);
      setShowAddModal(false);
      setTruckReg('');
} catch (err: any) {
      setErrorMessage(err.message || 'Failed to register asphalt batch');
} finally {
      setIsSubmitting(false);
}
};

  const handleRecordCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const coreThick = parseFloat(coreThickness);
      const designThick = parseFloat(selectedBatch.designThicknessMm || '50.0');
      const cDens = parseFloat(coreDensity);
      const mDens = parseFloat(marshallDensity);
      const compPct = (cDens / mDens) * 100;

      let qaVerdict: AsphaltBatchRecord['qaVerdict'] = 'ACCEPTED';
      if (compPct< 97.0 || coreThick< designThick - 3.0) qaVerdict = 'REJECTED_UNDER_COMPACTED';
      else if (coreThick< designThick) qaVerdict = 'CONDITIONAL_PENALTY';

      const isPriorRejected = selectedBatch.status === 'REJECTED' || selectedBatch.thermalVerdict === 'REJECTED_COLD_PAVING';
      const newStatus = isPriorRejected
        ? 'REJECTED'
        : (qaVerdict === 'REJECTED_UNDER_COMPACTED' ? 'REJECTED' : 'COMPLETED');

      if (isLive) {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/asphalt-batches/${selectedBatch.id}/core-test`, {
            method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              coreThicknessMm: coreThick,
              coreDensityGCm3: cDens,
              marshallDensityGCm3: mDens,
              inspectedBy: inspectorName,
}),
});
          if (res.ok) {
            await reload();
            setShowCoreModal(false);
            return;
}
} catch { /* fall through to local */}
}

      if (onRecordCoreTest) {
        await onRecordCoreTest(selectedBatch.id, {
          coreThicknessMm: coreThick.toFixed(2),
          coreDensityGCm3: cDens.toFixed(3),
          marshallDensityGCm3: mDens.toFixed(3),
});
}

      setBatches((prev) =>
        prev.map((b) => {
          if (b.id === selectedBatch.id) {
            return {
              ...b,
              coreThicknessMm: coreThick.toFixed(1),
              coreDensityGCm3: cDens.toFixed(3),
              marshallDensityGCm3: mDens.toFixed(3),
              compactionPercent: compPct.toFixed(2),
              qaVerdict,
              status: newStatus,
};
}
          return b;
})
);
      setShowCoreModal(false);
} catch (err: any) {
      setErrorMessage(err.message || 'Failed to record core test');
} finally {
      setIsSubmitting(false);
}
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading asphalt batches...</div>;
}

  return (
<div className="space-y-6">
      {/* Header and Action */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
<div>
<h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
<span></span> Asphalt Pavement Quality &amp; Thermal Tracker
</h2>
<p className="text-xs text-gray-500 mt-1">
            BS 594987 / KS 02-1025 Laying Thermal Envelopes, Marshall Compaction (≥97%) &amp; Core Thickness Verification • {projectName}
</p>
</div>
<button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg shadow-sm transition"
        >
          + Log Asphalt Batch Ticket
</button>
</div>

      {/* KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Total Paved Tonnage</span>
<p className="text-2xl font-bold text-gray-900 mt-1">{totalTonnageSum.toFixed(2)} T</p>
<span className="text-xs text-gray-400">{totalBatches} truckloads delivered</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Thermal Compliance</span>
<p className="text-2xl font-bold text-emerald-600 mt-1">
            {totalBatches > 0 ? ((compliantCount / totalBatches) * 100).toFixed(1) : '100.0'}%
</p>
<span className="text-xs text-emerald-500">≥140°C delivery / ≥85°C finish</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Core Drills Verified</span>
<p className="text-2xl font-bold text-blue-600 mt-1">{coredCount}</p>
<span className="text-xs text-blue-500">In-situ density &amp; thickness</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Compaction Standard</span>
<p className="text-2xl font-bold text-indigo-600 mt-1">≥97.0%</p>
<span className="text-xs text-indigo-500">Marshall Laboratory Ratio</span>
</div>
</div>

      {/* Filters and Search */}
<div className="flex flex-col sm:flex-row gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 items-center justify-between">
<div className="flex gap-2 w-full sm:w-auto">
<select
            value={filterMix}
            onChange={(e) => setFilterMix(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2"
          >
<option value="ALL">All Asphalt Mix Types</option>
<option value="AC_14_WEARING">AC 14 Wearing Course</option>
<option value="AC_20_BASE">AC 20 Binder/Base Course</option>
<option value="SUPERPAVE_19">Superpave 19.0mm</option>
<option value="SUPERPAVE_12_5">Superpave 12.5mm</option>
<option value="BITUMEN_MACADAM">Dense Bitumen Macadam</option>
</select>
</div>
<div className="w-full sm:w-72">
<input
            type="text"
            placeholder="Search ticket, truck reg, chainage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2"
          />
</div>
</div>

      {/* Batches Table */}
<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 text-sm text-left">
<thead className="bg-gray-50 text-gray-600 font-semibold text-xs ">
<tr>
<th scope="col" className="px-4 py-3">Ticket &amp; Truck</th>
<th scope="col" className="px-4 py-3">Mix &amp; Quantity</th>
<th scope="col" className="px-4 py-3">Chainage Location</th>
<th scope="col" className="px-4 py-3">Thermal Envelope</th>
<th scope="col" className="px-4 py-3">Thermal Status</th>
<th scope="col" className="px-4 py-3">Core Verification</th>
<th scope="col" className="px-4 py-3">Core QA</th>
<th scope="col" className="px-4 py-3 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-100">
              {filteredBatches.length === 0 ? (
<tr>
<td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No asphalt pavement batches recorded.
</td>
</tr>
) : (
                filteredBatches.map((batch) => (
<tr key={batch.id} className="hover:bg-gray-50 transition">
<td className="px-4 py-3">
<div className="font-semibold text-gray-900">{batch.ticketNumber}</div>
<div className="text-xs text-gray-500 font-mono mt-0.5">{batch.truckRegNo}</div>
<div className="text-[11px] text-gray-400">{batch.supplierName}</div>
</td>
<td className="px-4 py-3">
<div className="font-medium text-gray-900">{batch.mixType.replace('_', ' ')}</div>
<div className="text-xs text-blue-600 font-bold">{batch.tonnageTons} Tonnes</div>
</td>
<td className="px-4 py-3">
<div className="text-xs text-gray-800 font-medium">{batch.chainage}</div>
</td>
<td className="px-4 py-3">
<div className="text-xs text-gray-700">Delivery:<strong>{batch.deliveryTempC}°C</strong></div>
<div className="text-xs text-gray-500">Finish:<strong>{batch.finishTempC}°C</strong></div>
</td>
<td className="px-4 py-3">{getThermalBadge(batch.thermalVerdict)}</td>
<td className="px-4 py-3">
                      {batch.coreThicknessMm ? (
<div>
<div className="text-xs text-gray-900">
                            Thick:<strong>{batch.coreThicknessMm} mm</strong>
</div>
<div className="text-xs text-emerald-700 font-bold">
                            Comp: {batch.compactionPercent}%
</div>
</div>
) : (
<span className="text-xs text-gray-400 italic">No cores cut yet</span>
)}
</td>
<td className="px-4 py-3">{getQaBadge(batch.qaVerdict)}</td>
<td className="px-4 py-3 text-right">
<button
                        onClick={() => {
                          setSelectedBatch(batch);
                          setShowCoreModal(true);
}}
                        className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 rounded border border-gray-300 transition"
                      >
                         Core Test
</button>
</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>

      {/* MODAL 1: Log Asphalt Batch Ticket */}
      {showAddModal && (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-asphalt-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
        >
<div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 id="modal-asphalt-title" className="text-lg font-bold text-gray-900">Log Asphalt Concrete Paving Batch</h3>
<p className="text-xs text-gray-500">BS 594987 Plant Delivery &amp; Compaction Thermal Quality</p>
</div>
<button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                
</button>
</div>

            {errorMessage && (
<div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                 {errorMessage}
</div>
)}

<form onSubmit={handleCreateBatch} className="space-y-4 text-sm">
<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="asphalt-ticket-no" className="block text-xs font-medium text-gray-700">Batch Ticket No *</label>
<input
                    id="asphalt-ticket-no"
                    type="text"
                    required
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  />
</div>
<div>
<label htmlFor="asphalt-truck-reg" className="block text-xs font-medium text-gray-700">Truck Registration No *</label>
<input
                    id="asphalt-truck-reg"
                    type="text"
                    required
                    placeholder="e.g. KDF 994L"
                    value={truckReg}
                    onChange={(e) => setTruckReg(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="asphalt-supplier" className="block text-xs font-medium text-gray-700">Asphalt Supplier *</label>
<input
                    id="asphalt-supplier"
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label htmlFor="asphalt-mix-type" className="block text-xs font-medium text-gray-700">Pavement Mix Type *</label>
<select
                    id="asphalt-mix-type"
                    value={mixType}
                    onChange={(e) => setMixType(e.target.value as any)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
<option value="AC_14_WEARING">AC 14 (Wearing Course - 50mm)</option>
<option value="AC_20_BASE">AC 20 (Binder / Base Course - 60mm)</option>
<option value="SUPERPAVE_19">Superpave 19.0mm</option>
<option value="SUPERPAVE_12_5">Superpave 12.5mm</option>
<option value="BITUMEN_MACADAM">Dense Bitumen Macadam (DBM)</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="asphalt-tonnage" className="block text-xs font-medium text-gray-700">Tonnage (Tonnes) *</label>
<input
                    id="asphalt-tonnage"
                    type="number"
                    step="0.1"
                    required
                    value={tonnage}
                    onChange={(e) => setTonnage(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label htmlFor="asphalt-design-thickness" className="block text-xs font-medium text-gray-700">Design Thickness (mm)</label>
<input
                    id="asphalt-design-thickness"
                    type="number"
                    step="1"
                    required
                    value={designThickness}
                    onChange={(e) => setDesignThickness(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

<div className="grid grid-cols-3 gap-3">
<div>
<label htmlFor="asphalt-chainage-start" className="block text-xs font-medium text-gray-700">Chainage Start *</label>
<input
                    id="asphalt-chainage-start"
                    type="text"
                    required
                    placeholder="Ch 12+100"
                    value={chainageStart}
                    onChange={(e) => setChainageStart(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-xs"
                  />
</div>
<div>
<label htmlFor="asphalt-chainage-end" className="block text-xs font-medium text-gray-700">Chainage End *</label>
<input
                    id="asphalt-chainage-end"
                    type="text"
                    required
                    placeholder="Ch 12+350"
                    value={chainageEnd}
                    onChange={(e) => setChainageEnd(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-xs"
                  />
</div>
<div>
<label htmlFor="asphalt-lane-direction" className="block text-xs font-medium text-gray-700">Lane Direction</label>
<select
                    id="asphalt-lane-direction"
                    value={laneDirection}
                    onChange={(e) => setLaneDirection(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-2 text-xs"
                  >
<option value="MAIN_CARRIAGEWAY">Main Carriageway</option>
<option value="NORTHBOUND">Northbound</option>
<option value="SOUTHBOUND">Southbound</option>
<option value="EASTBOUND">Eastbound</option>
<option value="WESTBOUND">Westbound</option>
</select>
</div>
</div>

              {/* Thermal Quality Box */}
<div className="bg-gray-50 border border-gray-200 p-3 rounded-lg space-y-2">
<span className="text-xs font-bold text-gray-700 ">
                  Compaction Temperature Envelope (°C)
</span>
<div className="grid grid-cols-4 gap-2 text-xs">
<div>
<label htmlFor="asphalt-plant-temp" className="block text-gray-500">Plant Discharge</label>
<input
                      id="asphalt-plant-temp"
                      type="number"
                      step="0.5"
                      required
                      value={plantTemp}
                      onChange={(e) => setPlantTemp(e.target.value)}
                      className="mt-1 w-full border rounded px-2 py-1 text-sm bg-white"
                    />
</div>
<div>
<label htmlFor="asphalt-delivery-temp" className="block text-gray-500">Site Delivery (≥140°)</label>
<input
                      id="asphalt-delivery-temp"
                      type="number"
                      step="0.5"
                      required
                      value={deliveryTemp}
                      onChange={(e) => setDeliveryTemp(e.target.value)}
                      className="mt-1 w-full border rounded px-2 py-1 text-sm bg-white font-bold"
                    />
</div>
<div>
<label htmlFor="asphalt-breakdown-temp" className="block text-gray-500">Breakdown Rolling</label>
<input
                      id="asphalt-breakdown-temp"
                      type="number"
                      step="0.5"
                      required
                      value={breakdownTemp}
                      onChange={(e) => setBreakdownTemp(e.target.value)}
                      className="mt-1 w-full border rounded px-2 py-1 text-sm bg-white"
                    />
</div>
<div>
<label htmlFor="asphalt-finish-temp" className="block text-gray-500">Finish Rolling (≥85°)</label>
<input
                      id="asphalt-finish-temp"
                      type="number"
                      step="0.5"
                      required
                      value={finishTemp}
                      onChange={(e) => setFinishTemp(e.target.value)}
                      className="mt-1 w-full border rounded px-2 py-1 text-sm bg-white font-bold"
                    />
</div>
</div>
</div>

<div>
<label htmlFor="asphalt-inspector-name" className="block text-xs font-medium text-gray-700">Inspecting Resident Engineer *</label>
<input
                  id="asphalt-inspector-name"
                  type="text"
                  required
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-black disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Pavement Batch Ticket'}
</button>
</div>
</form>
</div>
</div>
)}

      {/* MODAL 2: Record Core Drill Extraction */}
      {showCoreModal && selectedBatch && (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-core-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
        >
<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 id="modal-core-title" className="text-lg font-bold text-gray-900">Record Pavement Core Extraction</h3>
<p className="text-xs text-gray-500">Batch: {selectedBatch.ticketNumber} • {selectedBatch.chainage}</p>
</div>
<button
                type="button"
                onClick={() => setShowCoreModal(false)}
                aria-label="Close modal"
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                
</button>
</div>

            {errorMessage && (
<div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                 {errorMessage}
</div>
)}

<form onSubmit={handleRecordCore} className="space-y-4 text-sm">
<div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs space-y-1">
<div><strong>Design Nominal Thickness:</strong> {selectedBatch.designThicknessMm || '50.00'} mm</div>
<div><strong>Required Compaction:</strong> ≥97.00% Marshall Bulk Density</div>
</div>

<div>
<label htmlFor="core-thickness" className="block text-xs font-medium text-gray-700">Extracted Core Thickness (mm) *</label>
<input
                  id="core-thickness"
                  type="number"
                  step="0.5"
                  required
                  value={coreThickness}
                  onChange={(e) => setCoreThickness(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-bold text-gray-900"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="core-density" className="block text-xs font-medium text-gray-700">In-Situ Core Density (g/cm³) *</label>
<input
                    id="core-density"
                    type="number"
                    step="0.001"
                    required
                    value={coreDensity}
                    onChange={(e) => setCoreDensity(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  />
</div>
<div>
<label htmlFor="marshall-density" className="block text-xs font-medium text-gray-700">Marshall Lab Density (g/cm³) *</label>
<input
                    id="marshall-density"
                    type="number"
                    step="0.001"
                    required
                    value={marshallDensity}
                    onChange={(e) => setMarshallDensity(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  />
</div>
</div>

<div className="bg-gray-100 p-3 rounded-lg flex justify-between items-center text-xs">
<div>
<span className="text-gray-500">Achieved Compaction:</span>
<div className="text-base font-bold text-indigo-700">
                    {((parseFloat(coreDensity) / parseFloat(marshallDensity)) * 100).toFixed(2)}%
</div>
</div>
<div>
<span className="text-gray-500">Thickness Deviation:</span>
<div className="text-base font-bold text-gray-900">
                    {(parseFloat(coreThickness) - parseFloat(selectedBatch.designThicknessMm || '50.0')).toFixed(1)} mm
</div>
</div>
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={() => setShowCoreModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Core Verification'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
