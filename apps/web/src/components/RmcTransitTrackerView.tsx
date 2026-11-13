import React, { useEffect, useState} from 'react';

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
      const res = await fetch(`/api/v1/projects/${projectId}/rmc-deliveries`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
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

  const calculateMinutesSince = (isoTime: string): number => {
    return Math.max(0, Math.round((Date.now() - new Date(isoTime).getTime()) / 60000));
};

  const getTransitBadge = (minutes: number) => {
    if (minutes<= 90) {
      return (
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
           Optimal ({minutes}m / ≤90m)
</span>
);
}
    if (minutes<= 120) {
      return (
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
           Warning: Hydration Alert ({minutes}m / ≤120m)
</span>
);
}
    return (
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
         REJECT: Cold Joint Risk ({minutes}m &gt; 120m)
</span>
);
};

  const getStatusBadge = (status: RmcDeliveryRecord['status']) => {
    switch (status) {
      case 'IN_TRANSIT':
        return<span className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800">In Transit</span>;
      case 'ARRIVED':
        return<span className="px-2.5 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800">Arrived On Site</span>;
      case 'POURING':
        return<span className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800">Pouring Active</span>;
      case 'COMPLETED':
        return<span className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800">Discharged &amp; Poured</span>;
      case 'REJECTED_COLD_JOINT_RISK':
        return<span className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800">Rejected (Cold Joint)</span>;
      case 'REJECTED_SLUMP_FAILURE':
        return<span className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-100 text-rose-800">Rejected (Slump Out of Spec)</span>;
}
};

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
        const res = await fetch(`/api/v1/projects/${projectId}/rmc-deliveries`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            deliveryTicketNo: ticketNo,
            supplierName,
            truckRegistrationNo: truckReg,
            driverName: driverName || null,
            driverPhone: driverPhone || null,
            concreteClass,
            orderedVolumeM3: parseFloat(orderedVolume),
            dispatchedAt,
            pourLocationElement: pourLocation,
}),
});
        if (res.ok) {
          await reload();
          setShowAddModal(false);
          setTicketNo('');
          setTruckReg('');
          setPourLocation('');
}
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
        const res = await fetch(`/api/v1/projects/${projectId}/rmc-deliveries/${selectedDelivery.id}/slump-tests`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            specifiedSlumpMm: Math.min(250, Math.max(20, selectedDelivery.slumpSpecifiedMm || measuredSlump)),
            measuredSlumpMm: measuredSlump,
            slumpType: 'TRUE_SLUMP',
            concreteTemperatureC: parseFloat(concreteTemp) || 25,
            ambientTemperatureC: null,
            testedByInspector: inspectorName,
            cubesCastBatchNo: null,
}),
});
        if (res.ok) {
          await reload();
          setShowSlumpModal(false);
}
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
        const res = await fetch(`/api/v1/projects/${projectId}/rmc-deliveries/${selectedDelivery.id}/discharge`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            arrivedAt: nowIso,
            ...(dischargeStatus === 'POURING' ? { dischargeStartedAt: nowIso} : {}),
            ...(dischargeStatus === 'COMPLETED' ? { dischargeCompletedAt: nowIso} : {}),
            waterAddedOnSiteLiters: parseFloat(waterTamperLiters) || 0,
            rejectionReason: rejectionNotes || null,
            status: dischargeStatus,
}),
});
        if (res.ok) {
          await reload();
          setShowDischargeModal(false);
}
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
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
<div>
<h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
<span></span> Ready-Mix Concrete (RMC) Transit &amp; Slump Tracker
</h2>
<p className="text-xs text-gray-500 mt-1">
            BS EN 206 / KS 02-598 Cold-Joint Early Defense &amp; BS EN 12350-2 On-Site Slump Verification • {projectName}
</p>
</div>
<div className="flex gap-2">
<button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            + Log Batch Plant Ticket
</button>
</div>
</div>

      {/* KPI Stats */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Total Truckloads</span>
<p className="text-2xl font-bold text-gray-900 mt-1">{totalTrucks}</p>
<span className="text-xs text-gray-400">Total: {totalVolumeM3.toFixed(2)} m³</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">In Transit</span>
<p className="text-2xl font-bold text-blue-600 mt-1">{inTransitCount}</p>
<span className="text-xs text-blue-500">Live Hydration Tracking</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Cold Joint Rejected</span>
<p className="text-2xl font-bold text-red-600 mt-1">{rejectedCount}</p>
<span className="text-xs text-red-500">&gt;120m transit or slump fail</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Slump Standard (BS EN 12350-2)</span>
<p className="text-2xl font-bold text-emerald-600 mt-1">±25 mm</p>
<span className="text-xs text-emerald-500">Allowable tolerance</span>
</div>
</div>

      {/* Filters and Search */}
<div className="flex flex-col sm:flex-row gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 items-center justify-between">
<div className="flex gap-2 w-full sm:w-auto">
<select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
<option value="ALL">All Delivery Statuses</option>
<option value="IN_TRANSIT">In Transit</option>
<option value="ARRIVED">Arrived On Site</option>
<option value="POURING">Pouring Active</option>
<option value="COMPLETED">Discharged / Completed</option>
<option value="REJECTED_COLD_JOINT_RISK">Rejected (Cold Joint)</option>
</select>
</div>
<div className="w-full sm:w-72">
<input
            type="text"
            placeholder="Search ticket, truck reg, element..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          />
</div>
</div>

      {/* Deliveries Table */}
<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 text-sm text-left">
<thead className="bg-gray-50 text-gray-600 font-semibold text-xs ">
<tr>
<th className="px-4 py-3">Ticket &amp; Truck</th>
<th className="px-4 py-3">Supplier &amp; Mix</th>
<th className="px-4 py-3">Pour Location</th>
<th className="px-4 py-3">Transit Time</th>
<th className="px-4 py-3">Slump Verification</th>
<th className="px-4 py-3">Water Tamper</th>
<th className="px-4 py-3">Status</th>
<th className="px-4 py-3 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-100">
              {filteredDeliveries.length === 0 ? (
<tr>
<td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No RMC batch deliveries found matching the criteria.
</td>
</tr>
) : (
                filteredDeliveries.map((delivery) => {
                  const elapsedMinutes = delivery.transitDurationMinutes ?? calculateMinutesSince(delivery.dispatchedAt);
                  return (
<tr key={delivery.id} className="hover:bg-gray-50 transition">
<td className="px-4 py-3">
<div className="font-semibold text-gray-900">{delivery.deliveryTicketNo}</div>
<div className="text-xs text-gray-500 font-mono tabular-nums mt-0.5">{delivery.truckRegistrationNo}</div>
                        {delivery.driverName && (
<div className="text-xs text-gray-400 mt-0.5"> {delivery.driverName}</div>
)}
</td>
<td className="px-4 py-3">
<div className="font-medium text-gray-800">{delivery.supplierName}</div>
<div className="text-xs text-blue-600 font-semibold">{delivery.concreteClass.replaceAll('_', ' ')} • {delivery.orderedVolumeM3} m³</div>
</td>
<td className="px-4 py-3">
<div className="text-gray-900 font-medium">{delivery.pourLocationElement}</div>
<div className="text-xs text-gray-500">Spec Slump: {delivery.slumpSpecifiedMm} mm</div>
</td>
<td className="px-4 py-3">
                        {getTransitBadge(elapsedMinutes)}
<div className="text-xs text-gray-400 mt-1">
                          Dispatched: {new Date(delivery.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
</div>
</td>
<td className="px-4 py-3">
                        {delivery.latestSlumpMm ? (
<div>
<span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                delivery.latestSlumpVerdict === 'WITHIN_TOLERANCE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
}`}
                            >
                              {delivery.latestSlumpMm} mm ({delivery.latestSlumpMm - delivery.slumpSpecifiedMm > 0 ? `+${delivery.latestSlumpMm - delivery.slumpSpecifiedMm}` : delivery.latestSlumpMm - delivery.slumpSpecifiedMm} mm)
</span>
<div className="text-xs text-gray-400 mt-0.5">{delivery.slumpTestsCount} test(s) recorded</div>
</div>
) : (
<span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Pending Cone Test
</span>
)}
</td>
<td className="px-4 py-3">
                        {parseFloat(delivery.waterAddedOnSiteLiters) > 0 ? (
<span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-300">
                             +{delivery.waterAddedOnSiteLiters} L Tampered!
</span>
) : (
<span className="text-xs text-emerald-600 font-medium">0.00 L (Compliant)</span>
)}
</td>
<td className="px-4 py-3">{getStatusBadge(delivery.status)}</td>
<td className="px-4 py-3 text-right">
<div className="flex gap-2 justify-end">
<button
                            onClick={() => {
                              setSelectedDelivery(delivery);
                              setShowSlumpModal(true);
}}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-300 transition"
                          >
                             Slump Test
</button>
<button
                            onClick={() => {
                              setSelectedDelivery(delivery);
                              setShowDischargeModal(true);
}}
                            className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded border border-gray-300 transition"
                          >
                             Discharge
</button>
</div>
</td>
</tr>
);
})
)}
</tbody>
</table>
</div>
</div>

      {/* MODAL 1: Register New RMC Ticket */}
      {showAddModal && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">Log RMC Batch Delivery Ticket</h3>
<button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>
<form onSubmit={handleCreateDelivery} className="space-y-4 text-sm">
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-medium text-gray-700">Delivery Ticket No *</label>
<input
                    type="text"
                    required
                    placeholder="e.g. RMC-BAM-10492"
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Truck Reg No *</label>
<input
                    type="text"
                    required
                    placeholder="e.g. KDH 482B"
                    value={truckReg}
                    onChange={(e) => setTruckReg(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-medium text-gray-700">Supplier Name *</label>
<input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Concrete Class *</label>
<select
                    value={concreteClass}
                    onChange={(e) => setConcreteClass(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
<option value="CLASS_15_20">Class 15/20 (Blinding)</option>
<option value="CLASS_20_20">Class 20/20 (Mass Concrete)</option>
<option value="CLASS_25_20">Class 25/20 (Columns / Beams)</option>
<option value="CLASS_30_20">Class 30/20 (Suspended Slabs)</option>
<option value="CLASS_35_20">Class 35/20 (High Strength)</option>
<option value="CLASS_40_20">Class 40/20 (Prestressed / Heavy)</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-medium text-gray-700">Ordered Volume (m³) *</label>
<input
                    type="number"
                    step="0.1"
                    required
                    value={orderedVolume}
                    onChange={(e) => setOrderedVolume(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Target Slump (mm) *</label>
<input
                    type="number"
                    required
                    value={specifiedSlump}
                    onChange={(e) => setSpecifiedSlump(parseInt(e.target.value) || 100)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">Pour Location / Structural Element *</label>
<input
                  type="text"
                  required
                  placeholder="e.g. 5th Floor Suspended Slab Grid B3-C6"
                  value={pourLocation}
                  onChange={(e) => setPourLocation(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
</div>

<div className="grid grid-cols-3 gap-3">
<div>
<label className="block text-xs font-medium text-gray-700">Driver Name</label>
<input
                    type="text"
                    placeholder="e.g. Joseph Mutua"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Driver Phone</label>
<input
                    type="text"
                    placeholder="e.g. +254 711 223 344"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Dispatched (Mins Ago)</label>
<input
                    type="number"
                    value={minutesAgo}
                    onChange={(e) => setMinutesAgo(parseInt(e.target.value) || 0)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
</button>
<button type="submit" className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
                  Save Ticket &amp; Start Transit
</button>
</div>
</form>
</div>
</div>
)}

      {/* MODAL 2: Record Slump Cone Test */}
      {showSlumpModal && selectedDelivery && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 className="text-lg font-bold text-gray-900">BS EN 12350-2 Slump Cone Test</h3>
<p className="text-xs text-gray-500">Ticket: {selectedDelivery.deliveryTicketNo} • Truck: {selectedDelivery.truckRegistrationNo}</p>
</div>
<button onClick={() => setShowSlumpModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>
<form onSubmit={handleRecordSlump} className="space-y-4 text-sm">
<div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs space-y-1">
<div><strong>Specified Mix Slump:</strong> {selectedDelivery.slumpSpecifiedMm} mm</div>
<div><strong>Allowable Tolerance:</strong> {selectedDelivery.slumpSpecifiedMm - 25} mm to {selectedDelivery.slumpSpecifiedMm + 25} mm (±25 mm)</div>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">Measured Slump Cone Height (mm) *</label>
<input
                  type="number"
                  required
                  min="0"
                  max="300"
                  value={measuredSlump}
                  onChange={(e) => setMeasuredSlump(parseInt(e.target.value) || 0)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-bold text-gray-900"
                />
<div className="text-xs mt-1">
                  Deviation: {measuredSlump - selectedDelivery.slumpSpecifiedMm > 0 ? `+${measuredSlump - selectedDelivery.slumpSpecifiedMm}` : measuredSlump - selectedDelivery.slumpSpecifiedMm} mm •{' '}
                  {Math.abs(measuredSlump - selectedDelivery.slumpSpecifiedMm)<= 25 ? (
<span className="text-emerald-600 font-bold"> PASS (Within ±25 mm tolerance)</span>
) : (
<span className="text-red-600 font-bold"> FAIL (Exceeds allowable tolerance)</span>
)}
</div>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">Concrete Temperature (°C)</label>
<input
                  type="text"
                  value={concreteTemp}
                  onChange={(e) => setConcreteTemp(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
<span className="text-xs text-gray-400">Max allowable per KS standard: 32°C</span>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">Testing QA Inspector *</label>
<input
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
                  onClick={() => setShowSlumpModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
</button>
<button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700">
                  Save Slump Test Verdict
</button>
</div>
</form>
</div>
</div>
)}

      {/* MODAL 3: Update Discharge & Water Tamper Audit */}
      {showDischargeModal && selectedDelivery && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 className="text-lg font-bold text-gray-900">Update Discharge &amp; Quality Audit</h3>
<p className="text-xs text-gray-500">Ticket: {selectedDelivery.deliveryTicketNo}</p>
</div>
<button onClick={() => setShowDischargeModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>
<form onSubmit={handleDischargeUpdate} className="space-y-4 text-sm">
<div>
<label className="block text-xs font-medium text-gray-700">Delivery Status</label>
<select
                  value={dischargeStatus}
                  onChange={(e) => setDischargeStatus(e.target.value as any)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
                >
<option value="POURING">Pouring Active</option>
<option value="COMPLETED">Discharge Completed &amp; Poured</option>
<option value="REJECTED_COLD_JOINT_RISK">Reject Delivery (Cold Joint Risk)</option>
</select>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">
                  Unapproved Water Added On Site (Liters)
</label>
<input
                  type="number"
                  step="0.5"
                  value={waterTamperLiters}
                  onChange={(e) => setWaterTamperLiters(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
<p className="text-xs text-gray-500 mt-1">
                  Per BS EN 206, adding unapproved water dilutes the water/cement ratio and degrades compressive strength by up to 30%.
</p>
</div>

              {dischargeStatus.startsWith('REJECTED') && (
<div>
<label className="block text-xs font-medium text-gray-700">Rejection Reason *</label>
<textarea
                    required
                    rows={3}
                    placeholder="Provide justification e.g. Hydration transit exceeded 120 minutes or slump segregated"
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
)}

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={() => setShowDischargeModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
</button>
<button type="submit" className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
                  Save Discharge Record
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
