import React, { useEffect, useState} from 'react';
import { api } from '../lib/api';
import {
  DischargeUpdateModal,
  RegisterTicketModal,
  RmcDeliveriesTable,
  RmcFiltersBar,
  RmcHeaderControls,
  RmcKpiCards,
  SlumpTestModal,
} from './RmcTransitTrackerView.parts';

export interface RmcSlumpTestRecord {
  id: string;
  testTime: string;
  specifiedSlumpMm: number;
  measuredSlumpMm: number;
  deviationMm: number;
  isWithinTolerance: boolean;
  verdict: 'WITHIN_TOLERANCE' | 'SLUMP_TOO_HIGH' | 'SLUMP_TOO_LOW';
  concreteTemperatureC?: string | null;
  testedByInspector: string;
}

export interface RmcDeliveryRecord {
  id: string;
  deliveryTicketNo: string;
  supplierName: string;
  truckRegistrationNo: string;
  driverName?: string | null;
  driverPhone?: string | null;
  concreteClass: string;
  orderedVolumeM3: string;
  pourLocationElement: string;
  slumpSpecifiedMm: number;
  waterAddedAtPlantLiters?: string | null;
  dispatchedAt: string;
  arrivedAt?: string | null;
  dischargeStartedAt?: string | null;
  dischargeCompletedAt?: string | null;
  waterAddedOnSiteLiters: string;
  rejectionReason?: string | null;
  transitDurationMinutes?: number | null;
  status: 'IN_TRANSIT' | 'ARRIVED' | 'POURING' | 'COMPLETED' | 'REJECTED_COLD_JOINT_RISK' | 'REJECTED_SLUMP_FAILURE';
  slumpTestsCount?: number;
  latestSlumpMm?: number | null;
  latestSlumpVerdict?: string | null;
  slumpTests?: RmcSlumpTestRecord[];
}

interface RmcTransitTrackerViewProps {
  projectId: string;
  projectName?: string;
  initialDeliveries?: RmcDeliveryRecord[];
  onRegisterDelivery?: (delivery: any) => Promise<void>;
  onRecordSlumpTest?: (deliveryId: string, test: any) => Promise<void>;
  onUpdateDischarge?: (deliveryId: string, update: any) => Promise<void>;
}

const DEFAULT_DELIVERIES: RmcDeliveryRecord[] = [
  {
    id: 'rmc-001',
    deliveryTicketNo: 'RMC-BAM-88412',
    supplierName: 'Bamburi Special Products Ltd',
    truckRegistrationNo: 'KDH 482B',
    driverName: 'Joseph Mutua',
    driverPhone: '+254 711 223 344',
    concreteClass: 'CLASS_30_20',
    orderedVolumeM3: '7.50',
    pourLocationElement: 'Zone B Suspended Slab Grid 4-8',
    slumpSpecifiedMm: 125,
    waterAddedAtPlantLiters: '1450.00',
    dispatchedAt: new Date(Date.now() - 42 * 60000).toISOString(),
    waterAddedOnSiteLiters: '0.00',
    transitDurationMinutes: 42,
    status: 'IN_TRANSIT',
    slumpTestsCount: 0,
    slumpTests: [],
},
  {
    id: 'rmc-002',
    deliveryTicketNo: 'RMC-RAV-44109',
    supplierName: 'Ravir Concrete Kenya',
    truckRegistrationNo: 'KCQ 109M',
    driverName: 'Dennis Otieno',
    driverPhone: '+254 722 889 900',
    concreteClass: 'CLASS_25_20',
    orderedVolumeM3: '8.00',
    pourLocationElement: 'Basement 1 Retaining Wall B1-W3',
    slumpSpecifiedMm: 100,
    waterAddedAtPlantLiters: '1600.00',
    dispatchedAt: new Date(Date.now() - 105 * 60000).toISOString(),
    arrivedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    waterAddedOnSiteLiters: '0.00',
    transitDurationMinutes: 95,
    status: 'ARRIVED',
    slumpTestsCount: 1,
    latestSlumpMm: 95,
    latestSlumpVerdict: 'WITHIN_TOLERANCE',
    slumpTests: [
      {
        id: 'st-001',
        testTime: new Date(Date.now() - 8 * 60000).toISOString(),
        specifiedSlumpMm: 100,
        measuredSlumpMm: 95,
        deviationMm: -5,
        isWithinTolerance: true,
        verdict: 'WITHIN_TOLERANCE',
        concreteTemperatureC: '26.8',
        testedByInspector: 'John Kiprono (RE Inspector)',
},
    ],
},
  {
    id: 'rmc-003',
    deliveryTicketNo: 'RMC-ECO-10294',
    supplierName: 'Eco-Crete Readymix Ltd',
    truckRegistrationNo: 'KBZ 992P',
    driverName: 'Erick Cheruiyot',
    driverPhone: '+254 733 445 566',
    concreteClass: 'CLASS_30_20',
    orderedVolumeM3: '6.00',
    pourLocationElement: 'Lift Shaft Core Wall Grid C-3',
    slumpSpecifiedMm: 150,
    waterAddedAtPlantLiters: '1200.00',
    dispatchedAt: new Date(Date.now() - 145 * 60000).toISOString(),
    arrivedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    waterAddedOnSiteLiters: '0.00',
    transitDurationMinutes: 130,
    status: 'REJECTED_COLD_JOINT_RISK',
    rejectionReason: 'Exceeded BS EN 206 120-minute hydration window in Mombasa Rd traffic gridlock',
    slumpTestsCount: 0,
    slumpTests: [],
},
];

export const RmcTransitTrackerView: React.FC<RmcTransitTrackerViewProps> = ({
  projectId,
  projectName = 'Kilimani Commercial Complex',
  initialDeliveries = DEFAULT_DELIVERIES,
  onRegisterDelivery,
  onRecordSlumpTest,
  onUpdateDischarge,
}) => {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [deliveries, setDeliveries] = useState<RmcDeliveryRecord[]>(initialDeliveries);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const json = await api.get<any>(`/api/v1/projects/${projectId}/rmc-deliveries`);
      const list = (json.deliveries || []) as any[];
      setDeliveries(list.map((d) => ({
        id: d.id,
        deliveryTicketNo: d.deliveryTicketNo,
        supplierName: d.supplierName,
        truckRegistrationNo: d.truckRegistrationNo,
        driverName: d.driverName ?? null,
        driverPhone: d.driverPhone ?? null,
        concreteClass: d.concreteClass,
        orderedVolumeM3: d.orderedVolumeM3?.toString?.() ?? String(d.orderedVolumeM3 ?? '0'),
        pourLocationElement: d.pourLocationElement,
        slumpSpecifiedMm: d.latestSlumpMm ?? 0,
        waterAddedAtPlantLiters: null,
        dispatchedAt: d.dispatchedAt,
        arrivedAt: d.arrivedAt ?? null,
        dischargeStartedAt: null,
        dischargeCompletedAt: null,
        waterAddedOnSiteLiters: d.waterAddedOnSiteLiters?.toString?.() ?? '0.00',
        rejectionReason: null,
        transitDurationMinutes: d.transitDurationMinutes ?? null,
        status: d.status as RmcDeliveryRecord['status'],
        slumpTestsCount: d.slumpTestsCount ?? 0,
        latestSlumpMm: d.latestSlumpMm ?? null,
        latestSlumpVerdict: d.latestSlumpVerdict ?? null,
        slumpTests: [],
})));
} catch {
      setDeliveries([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showSlumpModal, setShowSlumpModal] = useState<boolean>(false);
  const [showDischargeModal, setShowDischargeModal] = useState<boolean>(false);
  const [selectedDelivery, setSelectedDelivery] = useState<RmcDeliveryRecord | null>(null);

  // New Delivery Form State
  const [ticketNo, setTicketNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [truckReg, setTruckReg] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [concreteClass, setConcreteClass] = useState('CLASS_30_20');
  const [orderedVolume, setOrderedVolume] = useState('7.50');
  const [pourLocation, setPourLocation] = useState('');
  const [specifiedSlump, setSpecifiedSlump] = useState<number>(125);
  const [minutesAgo, setMinutesAgo] = useState<number>(30);

  // Slump Test Form State
  const [measuredSlump, setMeasuredSlump] = useState<number>(120);
  const [concreteTemp, setConcreteTemp] = useState<string>('27.0');
  const [inspectorName, setInspectorName] = useState('Site QA Engineer');

  // Discharge Form State
  const [waterTamperLiters, setWaterTamperLiters] = useState<string>('0.00');
  const [dischargeStatus, setDischargeStatus] = useState<'POURING' | 'COMPLETED' | 'REJECTED_COLD_JOINT_RISK'>('COMPLETED');
  const [rejectionNotes, setRejectionNotes] = useState<string>('');

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus;
    const matchesSearch =
      d.deliveryTicketNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.truckRegistrationNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.pourLocationElement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
});

  const totalTrucks = deliveries.length;
  const inTransitCount = deliveries.filter((d) => d.status === 'IN_TRANSIT').length;
  const totalVolumeM3 = deliveries.reduce((acc, d) => acc + parseFloat(d.orderedVolumeM3 || '0'), 0);
  const rejectedCount = deliveries.filter((d) => d.status.startsWith('REJECTED')).length;

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLive) {
      try {
        const dispatchedAt = new Date(Date.now() - minutesAgo * 60000).toISOString();
        await api.post(`/api/v1/projects/${projectId}/rmc-deliveries`, {
          deliveryTicketNo: ticketNo,
          supplierName,
          truckRegistrationNo: truckReg,
          driverName: driverName || null,
          driverPhone: driverPhone || null,
          concreteClass,
          orderedVolumeM3: parseFloat(orderedVolume),
          dispatchedAt,
          pourLocationElement: pourLocation,
        });
        await reload();
        setShowAddModal(false);
        setTicketNo('');
        setTruckReg('');
        setPourLocation('');
} catch { /* keep modal open on failure */}
      return;
}

    const dispatchedAt = new Date(Date.now() - minutesAgo * 60000).toISOString();
    const newRecord: RmcDeliveryRecord = {
      id: `rmc-${Date.now()}`,
      deliveryTicketNo: ticketNo,
      supplierName,
      truckRegistrationNo: truckReg,
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
      concreteClass,
      orderedVolumeM3: parseFloat(orderedVolume).toFixed(2),
      pourLocationElement: pourLocation,
      slumpSpecifiedMm: specifiedSlump,
      dispatchedAt,
      waterAddedOnSiteLiters: '0.00',
      transitDurationMinutes: minutesAgo,
      status: 'IN_TRANSIT',
      slumpTestsCount: 0,
      slumpTests: [],
};

    if (onRegisterDelivery) {
      await onRegisterDelivery(newRecord);
}
    setDeliveries([newRecord, ...deliveries]);
    setShowAddModal(false);
    setTicketNo('');
    setTruckReg('');
    setPourLocation('');
};

  const handleRecordSlump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/rmc-deliveries/${selectedDelivery.id}/slump-tests`, {
          specifiedSlumpMm: Math.min(250, Math.max(20, selectedDelivery.slumpSpecifiedMm || measuredSlump)),
          measuredSlumpMm: measuredSlump,
          slumpType: 'TRUE_SLUMP',
          concreteTemperatureC: parseFloat(concreteTemp) || 25,
          ambientTemperatureC: null,
          testedByInspector: inspectorName,
          cubesCastBatchNo: null,
        });
        await reload();
        setShowSlumpModal(false);
} catch { /* keep modal open on failure */}
      return;
}

    const deviation = measuredSlump - selectedDelivery.slumpSpecifiedMm;
    const isWithinTol = Math.abs(deviation)<= 25;
    const verdict =
      isWithinTol
        ? 'WITHIN_TOLERANCE'
        : deviation > 25
        ? 'SLUMP_TOO_HIGH'
        : 'SLUMP_TOO_LOW';

    const testRecord: RmcSlumpTestRecord = {
      id: `st-${Date.now()}`,
      testTime: new Date().toISOString(),
      specifiedSlumpMm: selectedDelivery.slumpSpecifiedMm,
      measuredSlumpMm: measuredSlump,
      deviationMm: deviation,
      isWithinTolerance: isWithinTol,
      verdict,
      concreteTemperatureC: concreteTemp,
      testedByInspector: inspectorName,
};

    if (onRecordSlumpTest) {
      await onRecordSlumpTest(selectedDelivery.id, testRecord);
}

    setDeliveries((prev) =>
      prev.map((d) => {
        if (d.id === selectedDelivery.id) {
          return {
            ...d,
            slumpTestsCount: (d.slumpTestsCount || 0) + 1,
            latestSlumpMm: measuredSlump,
            latestSlumpVerdict: verdict,
            slumpTests: [testRecord, ...(d.slumpTests || [])],
};
}
        return d;
})
);
    setShowSlumpModal(false);
};

  const handleDischargeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    if (isLive) {
      try {
        const nowIso = new Date().toISOString();
        await api.patch(`/api/v1/projects/${projectId}/rmc-deliveries/${selectedDelivery.id}/discharge`, {
          arrivedAt: nowIso,
          ...(dischargeStatus === 'POURING' ? { dischargeStartedAt: nowIso} : {}),
          ...(dischargeStatus === 'COMPLETED' ? { dischargeCompletedAt: nowIso} : {}),
          waterAddedOnSiteLiters: parseFloat(waterTamperLiters) || 0,
          rejectionReason: rejectionNotes || null,
          status: dischargeStatus,
        });
        await reload();
        setShowDischargeModal(false);
} catch { /* keep modal open on failure */}
      return;
}

    if (onUpdateDischarge) {
      await onUpdateDischarge(selectedDelivery.id, {
        waterAddedOnSiteLiters: waterTamperLiters,
        status: dischargeStatus,
        rejectionReason: rejectionNotes || undefined,
});
}

    setDeliveries((prev) =>
      prev.map((d) => {
        if (d.id === selectedDelivery.id) {
          return {
            ...d,
            waterAddedOnSiteLiters: parseFloat(waterTamperLiters).toFixed(2),
            status: dischargeStatus,
            rejectionReason: rejectionNotes || d.rejectionReason,
            dischargeCompletedAt: dischargeStatus === 'COMPLETED' ? new Date().toISOString() : d.dischargeCompletedAt,
};
}
        return d;
})
);
    setShowDischargeModal(false);
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading RMC deliveries...</div>;
}
  return (
<div className="space-y-6">
      {/* Header and KPI cards */}
<RmcHeaderControls
        projectName={projectName}
        onAddTicket={() => setShowAddModal(true)}
      />

      {/* KPI Stats */}
<RmcKpiCards
        totalTrucks={totalTrucks}
        inTransitCount={inTransitCount}
        totalVolumeM3Text={totalVolumeM3.toFixed(2)}
        rejectedCount={rejectedCount}
      />

      {/* Filters and Search */}
<RmcFiltersBar
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Deliveries Table */}
<RmcDeliveriesTable
        filteredDeliveries={filteredDeliveries}
        onSlumpTest={(delivery) => {
          setSelectedDelivery(delivery);
          setShowSlumpModal(true);
}}
        onDischarge={(delivery) => {
          setSelectedDelivery(delivery);
          setShowDischargeModal(true);
}}
      />

      {/* MODAL 1: Register New RMC Ticket */}
      {showAddModal && (
<RegisterTicketModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateDelivery}
          ticketNo={ticketNo}
          setTicketNo={setTicketNo}
          truckReg={truckReg}
          setTruckReg={setTruckReg}
          supplierName={supplierName}
          setSupplierName={setSupplierName}
          concreteClass={concreteClass}
          setConcreteClass={setConcreteClass}
          orderedVolume={orderedVolume}
          setOrderedVolume={setOrderedVolume}
          specifiedSlump={specifiedSlump}
          setSpecifiedSlump={setSpecifiedSlump}
          pourLocation={pourLocation}
          setPourLocation={setPourLocation}
          driverName={driverName}
          setDriverName={setDriverName}
          driverPhone={driverPhone}
          setDriverPhone={setDriverPhone}
          minutesAgo={minutesAgo}
          setMinutesAgo={setMinutesAgo}
        />
)}

      {/* MODAL 2: Record Slump Cone Test */}
      {showSlumpModal && selectedDelivery && (
<SlumpTestModal
          onClose={() => setShowSlumpModal(false)}
          onSubmit={handleRecordSlump}
          delivery={selectedDelivery}
          measuredSlump={measuredSlump}
          setMeasuredSlump={setMeasuredSlump}
          concreteTemp={concreteTemp}
          setConcreteTemp={setConcreteTemp}
          inspectorName={inspectorName}
          setInspectorName={setInspectorName}
        />
)}

      {/* MODAL 3: Update Discharge & Water Tamper Audit */}
      {showDischargeModal && selectedDelivery && (
<DischargeUpdateModal
          onClose={() => setShowDischargeModal(false)}
          onSubmit={handleDischargeUpdate}
          delivery={selectedDelivery}
          dischargeStatus={dischargeStatus}
          setDischargeStatus={setDischargeStatus}
          waterTamperLiters={waterTamperLiters}
          setWaterTamperLiters={setWaterTamperLiters}
          rejectionNotes={rejectionNotes}
          setRejectionNotes={setRejectionNotes}
        />
)}
</div>
);
};
