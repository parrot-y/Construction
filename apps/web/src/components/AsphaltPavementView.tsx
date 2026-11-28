import React, { useEffect, useState} from 'react';
import { api, apiErrorMessage } from '../lib/api';
import {
  AddAsphaltBatchModal,
  AsphaltBatchesTable,
  AsphaltFiltersBar,
  AsphaltHeaderControls,
  AsphaltKpiCards,
  CoreTestModal,
} from './AsphaltPavementView.parts';

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
      const json = await api.get<any>(`/api/v1/projects/${projectId}/asphalt-batches`);
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
          await api.post(`/api/v1/projects/${projectId}/asphalt-batches`, {
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
});
          await reload();
          setShowAddModal(false);
          setTruckReg('');
          return;
} catch { /* fall through to local */}
}

      if (onRegisterBatch) {
        await onRegisterBatch(newRecord);
}

      setBatches([newRecord, ...batches]);
      setShowAddModal(false);
      setTruckReg('');
} catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Failed to register asphalt batch'));
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
          await api.patch(`/api/v1/projects/${projectId}/asphalt-batches/${selectedBatch.id}/core-test`, {
            coreThicknessMm: coreThick,
            coreDensityGCm3: cDens,
            marshallDensityGCm3: mDens,
            inspectedBy: inspectorName,
});
          await reload();
          setShowCoreModal(false);
          return;
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
} catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Failed to record core test'));
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
<AsphaltHeaderControls
        projectName={projectName}
        onAddBatch={() => setShowAddModal(true)}
      />

      {/* KPI Cards */}
<AsphaltKpiCards
        totalTonnageText={totalTonnageSum.toFixed(2)}
        totalBatches={totalBatches}
        thermalComplianceText={totalBatches > 0 ? ((compliantCount / totalBatches) * 100).toFixed(1) : '100.0'}
        coredCount={coredCount}
      />

      {/* Filters and Search */}
<AsphaltFiltersBar
        filterMix={filterMix}
        setFilterMix={setFilterMix}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Batches Table */}
<AsphaltBatchesTable
        filteredBatches={filteredBatches}
        onCoreTest={(batch) => {
          setSelectedBatch(batch);
          setShowCoreModal(true);
}}
      />

      {/* MODAL 1: Log Asphalt Batch Ticket */}
      {showAddModal && (
<AddAsphaltBatchModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateBatch}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          ticketNo={ticketNo}
          setTicketNo={setTicketNo}
          truckReg={truckReg}
          setTruckReg={setTruckReg}
          supplierName={supplierName}
          setSupplierName={setSupplierName}
          mixType={mixType}
          setMixType={setMixType}
          tonnage={tonnage}
          setTonnage={setTonnage}
          designThickness={designThickness}
          setDesignThickness={setDesignThickness}
          chainageStart={chainageStart}
          setChainageStart={setChainageStart}
          chainageEnd={chainageEnd}
          setChainageEnd={setChainageEnd}
          laneDirection={laneDirection}
          setLaneDirection={setLaneDirection}
          plantTemp={plantTemp}
          setPlantTemp={setPlantTemp}
          deliveryTemp={deliveryTemp}
          setDeliveryTemp={setDeliveryTemp}
          breakdownTemp={breakdownTemp}
          setBreakdownTemp={setBreakdownTemp}
          finishTemp={finishTemp}
          setFinishTemp={setFinishTemp}
          inspectorName={inspectorName}
          setInspectorName={setInspectorName}
        />
)}

      {/* MODAL 2: Record Core Drill Extraction */}
      {showCoreModal && selectedBatch && (
<CoreTestModal
          onClose={() => setShowCoreModal(false)}
          onSubmit={handleRecordCore}
          batch={selectedBatch}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          coreThickness={coreThickness}
          setCoreThickness={setCoreThickness}
          coreDensity={coreDensity}
          setCoreDensity={setCoreDensity}
          marshallDensity={marshallDensity}
          setMarshallDensity={setMarshallDensity}
          compactionPctText={((parseFloat(coreDensity) / parseFloat(marshallDensity)) * 100).toFixed(2)}
          thicknessDeviationText={(parseFloat(coreThickness) - parseFloat(selectedBatch.designThicknessMm || '50.0')).toFixed(1)}
        />
)}
</div>
);
};
