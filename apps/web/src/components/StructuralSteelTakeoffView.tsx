import React, { useEffect, useState} from 'react';

export interface StructuralSteelMemberItem {
  id: string;
  memberMark: string;
  sectionType: string;
  sectionDesignation: string;
  unitWeightKgPerM: string;
  paintAreaM2PerM: string;
  lengthMeters: string;
  quantity: number;
  totalLengthMeters: string;
  totalWeightKg: string;
  totalPaintAreaM2: string;
  connectionBoltsCount: number;
}

export interface StructuralSteelTakeoffRecord {
  id: string;
  takeoffNo: string;
  structureTitle: string;
  drawingReference?: string | null;
  steelGrade: 'S275JR' | 'S355JR' | 'S355J2';
  totalTonnage: string;
  totalPaintAreaM2: string;
  memberCount: number;
  status: 'DRAFT' | 'QS_APPROVED' | 'ORDERED' | 'FABRICATED' | 'ERECTED';
  createdAt: string;
  members?: StructuralSteelMemberItem[];
}

interface StructuralSteelTakeoffViewProps {
  projectId: string;
  projectName?: string;
  initialTakeoffs?: StructuralSteelTakeoffRecord[];
  onCreateTakeoff?: (takeoff: any) => Promise<void>;
  onUpdateStatus?: (takeoffId: string, status: string) => Promise<void>;
}

// Kenya / British Standard Sections library (BS 4 / BS EN 10056 / KS 02-104)
const STEEL_SECTIONS_LIB: Record<
  string,
  { designation: string; type: string; unitWeightKgPerM: string; paintAreaM2PerM: string}
> = {
  'UB 406x178x74': { designation: 'UB 406x178x74', type: 'UB', unitWeightKgPerM: '74.200', paintAreaM2PerM: '1.510'},
  'UB 406x178x67': { designation: 'UB 406x178x67', type: 'UB', unitWeightKgPerM: '67.100', paintAreaM2PerM: '1.500'},
  'UB 305x165x40': { designation: 'UB 305x165x40', type: 'UB', unitWeightKgPerM: '40.300', paintAreaM2PerM: '1.230'},
  'UC 203x203x46': { designation: 'UC 203x203x46', type: 'UC', unitWeightKgPerM: '46.100', paintAreaM2PerM: '1.200'},
  'UC 254x254x73': { designation: 'UC 254x254x73', type: 'UC', unitWeightKgPerM: '73.100', paintAreaM2PerM: '1.500'},
  'RHS 100x50x4.0': { designation: 'RHS 100x50x4.0', type: 'RHS', unitWeightKgPerM: '8.770', paintAreaM2PerM: '0.290'},
  'RHS 150x100x5.0': { designation: 'RHS 150x100x5.0', type: 'RHS', unitWeightKgPerM: '18.700', paintAreaM2PerM: '0.480'},
  'SHS 100x100x5.0': { designation: 'SHS 100x100x5.0', type: 'SHS', unitWeightKgPerM: '14.800', paintAreaM2PerM: '0.380'},
  'SHS 150x150x6.0': { designation: 'SHS 150x150x6.0', type: 'SHS', unitWeightKgPerM: '27.100', paintAreaM2PerM: '0.580'},
  'CHS 114.3x4.5': { designation: 'CHS 114.3x4.5', type: 'CHS', unitWeightKgPerM: '12.200', paintAreaM2PerM: '0.360'},
  'CHS 168.3x5.0': { designation: 'CHS 168.3x5.0', type: 'CHS', unitWeightKgPerM: '20.100', paintAreaM2PerM: '0.530'},
  'L 100x100x10': { designation: 'L 100x100x10', type: 'ANGLE', unitWeightKgPerM: '15.000', paintAreaM2PerM: '0.390'},
  'L 150x90x10': { designation: 'L 150x90x10', type: 'ANGLE', unitWeightKgPerM: '18.200', paintAreaM2PerM: '0.470'},
};

const DEFAULT_TAKEOFFS: StructuralSteelTakeoffRecord[] = [
  {
    id: 'st-001',
    takeoffNo: 'STL-TKF-WH01',
    structureTitle: 'Warehouse Main Portal Frame Grid 1-8',
    drawingReference: 'STR/STL/W01-REV2',
    steelGrade: 'S355JR',
    totalTonnage: '11.422',
    totalPaintAreaM2: '262.60',
    memberCount: 3,
    status: 'QS_APPROVED',
    createdAt: new Date().toISOString(),
    members: [
      {
        id: 'stm-1',
        memberMark: 'RAFTER-R1',
        sectionType: 'UB',
        sectionDesignation: 'UB 406x178x74',
        unitWeightKgPerM: '74.20',
        paintAreaM2PerM: '1.510',
        lengthMeters: '12.500',
        quantity: 8,
        totalLengthMeters: '100.000',
        totalWeightKg: '7420.00',
        totalPaintAreaM2: '151.00',
        connectionBoltsCount: 64,
},
      {
        id: 'stm-2',
        memberMark: 'COLUMN-C1',
        sectionType: 'UC',
        sectionDesignation: 'UC 203x203x46',
        unitWeightKgPerM: '46.10',
        paintAreaM2PerM: '1.200',
        lengthMeters: '8.000',
        quantity: 8,
        totalLengthMeters: '64.000',
        totalWeightKg: '2950.40',
        totalPaintAreaM2: '76.80',
        connectionBoltsCount: 32,
},
      {
        id: 'stm-3',
        memberMark: 'PURLIN-P1',
        sectionType: 'RHS',
        sectionDesignation: 'RHS 100x50x4.0',
        unitWeightKgPerM: '8.77',
        paintAreaM2PerM: '0.290',
        lengthMeters: '6.000',
        quantity: 20,
        totalLengthMeters: '120.000',
        totalWeightKg: '1051.20',
        totalPaintAreaM2: '34.80',
        connectionBoltsCount: 40,
},
    ],
},
  {
    id: 'st-002',
    takeoffNo: 'STL-TKF-MZ02',
    structureTitle: 'Office Mezzanine Floor Framing Grid B-D',
    drawingReference: 'STR/STL/MZ-02',
    steelGrade: 'S275JR',
    totalTonnage: '6.840',
    totalPaintAreaM2: '172.40',
    memberCount: 2,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    members: [],
},
];

export const StructuralSteelTakeoffView: React.FC<StructuralSteelTakeoffViewProps> = ({
  projectId,
  projectName = 'Kilimani Commercial Complex',
  initialTakeoffs = DEFAULT_TAKEOFFS,
  onCreateTakeoff,
  onUpdateStatus,
}) => {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [takeoffs, setTakeoffs] = useState<StructuralSteelTakeoffRecord[]>(initialTakeoffs);
  const [selectedTakeoff, setSelectedTakeoff] = useState<StructuralSteelTakeoffRecord | null>(initialTakeoffs[0] || null);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/structural-steel-takeoffs`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.takeoffs || []) as any[];
      const mapped = list.map((t) => ({
        ...t,
        steelGrade: t.steelGrade as StructuralSteelTakeoffRecord['steelGrade'],
        status: t.status as StructuralSteelTakeoffRecord['status'],
        members: undefined,
})) as StructuralSteelTakeoffRecord[];
      setTakeoffs(mapped);
      setSelectedTakeoff(mapped[0] ?? null);
} catch {
      setTakeoffs([]);
      setSelectedTakeoff(null);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const handleSelectTakeoff = async (takeoff: StructuralSteelTakeoffRecord) => {
    if (isLive && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(takeoff.id)) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/structural-steel-takeoffs/${takeoff.id}`, { credentials: 'include'});
        if (res.ok) {
          const detail = await res.json();
          setSelectedTakeoff({ ...takeoff, ...detail, members: detail.members ?? []});
          return;
}
} catch { /* fall through to local selection */}
}
    setSelectedTakeoff(takeoff);
};
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Takeoff Creation Form State
  const [takeoffNo, setTakeoffNo] = useState(`STL-${Date.now().toString().slice(-4)}`);
  const [structureTitle, setStructureTitle] = useState('');
  const [drawingRef, setDrawingRef] = useState('');
  const [steelGrade, setSteelGrade] = useState<'S275JR' | 'S355JR' | 'S355J2'>('S355JR');

  // Interactive Member Rows for Form
  const [memberRows, setMemberRows] = useState<
    Array<{
      memberMark: string;
      sectionDesignation: string;
      lengthMeters: string;
      quantity: number;
      connectionBoltsCount: number;
}>
  >([
    {
      memberMark: 'RAFTER-R1',
      sectionDesignation: 'UB 406x178x74',
      lengthMeters: '12.500',
      quantity: 8,
      connectionBoltsCount: 64,
},
    {
      memberMark: 'COLUMN-C1',
      sectionDesignation: 'UC 203x203x46',
      lengthMeters: '8.000',
      quantity: 8,
      connectionBoltsCount: 32,
},
  ]);

  const addMemberRow = () => {
    setMemberRows([
      ...memberRows,
      {
        memberMark: `MBR-${memberRows.length + 1}`,
        sectionDesignation: 'RHS 100x50x4.0',
        lengthMeters: '6.000',
        quantity: 10,
        connectionBoltsCount: 20,
},
    ]);
};

  const removeMemberRow = (index: number) => {
    setMemberRows(memberRows.filter((_, i) => i !== index));
};

  const updateMemberRow = (
    index: number,
    field: 'memberMark' | 'sectionDesignation' | 'lengthMeters' | 'quantity' | 'connectionBoltsCount',
    value: any
) => {
    const updated = [...memberRows];
    const cur = updated[index];
    if (cur) {
      updated[index] = { ...cur, [field]: value};
      setMemberRows(updated);
}
};

  // Live modal totals calculation
  const calculateModalTotals = () => {
    let totalWeight = 0;
    let totalPaint = 0;
    for (const m of memberRows) {
      const sec = STEEL_SECTIONS_LIB[m.sectionDesignation] || { unitWeightKgPerM: '0', paintAreaM2PerM: '0'};
      const len = parseFloat(m.lengthMeters) || 0;
      const qty = m.quantity || 0;
      const totLen = len * qty;
      totalWeight += totLen * parseFloat(sec.unitWeightKgPerM);
      totalPaint += totLen * parseFloat(sec.paintAreaM2PerM);
}
    return {
      tonnage: (totalWeight / 1000).toFixed(3),
      paintArea: totalPaint.toFixed(2),
};
};

  const modalTotals = calculateModalTotals();

  const handleCreateTakeoff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/structural-steel-takeoffs`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            takeoffNo,
            structureTitle,
            drawingReference: drawingRef || null,
            steelGrade,
            members: memberRows.map((m) => {
              const sec = STEEL_SECTIONS_LIB[m.sectionDesignation] || { type: 'UB', unitWeightKgPerM: '0', paintAreaM2PerM: '0'};
              return {
                memberMark: m.memberMark,
                sectionType: sec.type,
                sectionDesignation: m.sectionDesignation,
                unitWeightKgPerM: sec.unitWeightKgPerM,
                paintAreaM2PerM: sec.paintAreaM2PerM,
                lengthMeters: m.lengthMeters,
                quantity: m.quantity,
                connectionBoltsCount: m.connectionBoltsCount,
};
}),
}),
});
        if (res.ok) {
          await reload();
          setShowAddModal(false);
          setStructureTitle('');
          setDrawingRef('');
}
} catch { /* keep modal open on failure */}
      return;
}

    const createdMembers: StructuralSteelMemberItem[] = memberRows.map((m, idx) => {
      const sec = STEEL_SECTIONS_LIB[m.sectionDesignation] || {
        type: 'UB',
        unitWeightKgPerM: '0',
        paintAreaM2PerM: '0',
};
      const len = parseFloat(m.lengthMeters) || 0;
      const qty = m.quantity || 0;
      const totLen = len * qty;
      const weight = totLen * parseFloat(sec.unitWeightKgPerM);
      const paint = totLen * parseFloat(sec.paintAreaM2PerM);

      return {
        id: `stm-${Date.now()}-${idx}`,
        memberMark: m.memberMark,
        sectionType: sec.type,
        sectionDesignation: m.sectionDesignation,
        unitWeightKgPerM: sec.unitWeightKgPerM,
        paintAreaM2PerM: sec.paintAreaM2PerM,
        lengthMeters: len.toFixed(3),
        quantity: qty,
        totalLengthMeters: totLen.toFixed(3),
        totalWeightKg: weight.toFixed(2),
        totalPaintAreaM2: paint.toFixed(2),
        connectionBoltsCount: m.connectionBoltsCount,
};
});

    const newTakeoff: StructuralSteelTakeoffRecord = {
      id: `st-${Date.now()}`,
      takeoffNo,
      structureTitle,
      drawingReference: drawingRef || undefined,
      steelGrade,
      totalTonnage: modalTotals.tonnage,
      totalPaintAreaM2: modalTotals.paintArea,
      memberCount: createdMembers.length,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      members: createdMembers,
};

    if (onCreateTakeoff) {
      await onCreateTakeoff({
        takeoffNo,
        structureTitle,
        drawingReference: drawingRef || undefined,
        steelGrade,
        members: memberRows.map((m) => {
          const sec = STEEL_SECTIONS_LIB[m.sectionDesignation] || { type: 'UB'};
          return {
            memberMark: m.memberMark,
            sectionType: sec.type,
            sectionDesignation: m.sectionDesignation,
            lengthMeters: m.lengthMeters,
            quantity: m.quantity,
            connectionBoltsCount: m.connectionBoltsCount,
};
}),
});
}

    setTakeoffs([newTakeoff, ...takeoffs]);
    setSelectedTakeoff(newTakeoff);
    setShowAddModal(false);
    setStructureTitle('');
    setDrawingRef('');
};

  const handleStatusChange = async (takeoffId: string, newStatus: any) => {
    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/structural-steel-takeoffs/${takeoffId}/status`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ status: newStatus}),
});
        if (res.ok) {
          await reload();
          setSelectedTakeoff((prev) => (prev && prev.id === takeoffId ? { ...prev, status: newStatus} : prev));
}
} catch { /* keep current state on failure */}
      return;
}
    if (onUpdateStatus) {
      await onUpdateStatus(takeoffId, newStatus);
}
    setTakeoffs((prev) =>
      prev.map((t) => (t.id === takeoffId ? { ...t, status: newStatus} : t))
);
    if (selectedTakeoff && selectedTakeoff.id === takeoffId) {
      setSelectedTakeoff({ ...selectedTakeoff, status: newStatus});
}
};

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return<span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">Draft Takeoff</span>;
      case 'QS_APPROVED':
        return<span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">QS Approved</span>;
      case 'ORDERED':
        return<span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">Mill Ordered</span>;
      case 'FABRICATED':
      case 'FABRICATION_RELEASED':
        return<span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800">Fabricated</span>;
      case 'ERECTED':
        return<span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">Site Erected</span>;
      default:
        return<span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">{status}</span>;
}
};

  const filteredTakeoffs = takeoffs.filter((t) => {
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesSearch =
      t.takeoffNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.structureTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.drawingReference && t.drawingReference.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
});

  const totalTonnageSum = takeoffs.reduce((acc, t) => acc + parseFloat(t.totalTonnage || '0'), 0);
  const totalPaintAreaSum = takeoffs.reduce((acc, t) => acc + parseFloat(t.totalPaintAreaM2 || '0'), 0);

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading steel takeoffs...</div>;
}

  return (
<div className="space-y-6">
      {/* Header and Action */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
<div>
<h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
<span></span> Structural Steel Framing &amp; Fabrication Takeoff Engine
</h2>
<p className="text-xs text-gray-500 mt-1">
            BS 4 / BS EN 10056 / KS 02-104 Section Properties, Tonnage &amp; Intumescent Coating Estimator • {projectName}
</p>
</div>
<button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
        >
          + New Steel Takeoff
</button>
</div>

      {/* KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Total Steel Tonnage</span>
<p className="text-2xl font-bold text-gray-900 mt-1">{totalTonnageSum.toFixed(3)} T</p>
<span className="text-xs text-gray-400">{(totalTonnageSum * 1000).toLocaleString()} kg Total</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Intumescent Paint Area</span>
<p className="text-2xl font-bold text-indigo-600 mt-1">{totalPaintAreaSum.toFixed(2)} m²</p>
<span className="text-xs text-indigo-500">Surface Fireproofing / Primer</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Total Schedules</span>
<p className="text-2xl font-bold text-blue-600 mt-1">{takeoffs.length}</p>
<span className="text-xs text-blue-500">Frames, Mezzanines, Trusses</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Standard Specification</span>
<p className="text-2xl font-bold text-emerald-600 mt-1">S355JR</p>
<span className="text-xs text-emerald-500">KS / BS High-Yield Steel</span>
</div>
</div>

      {/* Main Layout: List & Detail View */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Takeoffs List */}
<div className="lg:col-span-1 space-y-3">
<div className="flex gap-2">
<input
              type="text"
              placeholder="Search takeoffs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 text-sm rounded-lg px-3 py-2"
            />
<select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-gray-300 text-sm rounded-lg px-2 py-2 text-xs"
            >
<option value="ALL">All</option>
<option value="DRAFT">Draft</option>
<option value="QS_APPROVED">Approved</option>
<option value="ORDERED">Ordered</option>
<option value="FABRICATED">Fabricated</option>
<option value="ERECTED">Erected</option>
</select>
</div>

<div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filteredTakeoffs.length === 0 ? (
<div className="p-4 text-center text-gray-400 text-sm">No takeoffs found.</div>
) : (
              filteredTakeoffs.map((takeoff) => (
<div
                  key={takeoff.id}
                  onClick={() => void handleSelectTakeoff(takeoff)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedTakeoff?.id === takeoff.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
}`}
                >
<div className="flex justify-between items-start">
<div>
<span className="font-semibold text-gray-900 text-sm">{takeoff.takeoffNo}</span>
<h4 className="text-xs text-gray-700 font-medium mt-0.5">{takeoff.structureTitle}</h4>
</div>
                    {getStatusBadge(takeoff.status)}
</div>
<div className="flex justify-between items-center text-xs text-gray-500 mt-2">
<span> {takeoff.totalTonnage} T</span>
<span> {takeoff.totalPaintAreaM2} m²</span>
<span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{takeoff.steelGrade}</span>
</div>
</div>
))
)}
</div>
</div>

        {/* Right: Selected Takeoff Detail & Members Table */}
<div className="lg:col-span-2">
          {selectedTakeoff ? (
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
<div>
<div className="flex items-center gap-2">
<h3 className="text-lg font-bold text-gray-900">{selectedTakeoff.takeoffNo}</h3>
                    {getStatusBadge(selectedTakeoff.status)}
</div>
<p className="text-sm text-gray-600 font-medium">{selectedTakeoff.structureTitle}</p>
                  {selectedTakeoff.drawingReference && (
<span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mt-1 inline-block">
                       Drawing Ref: {selectedTakeoff.drawingReference}
</span>
)}
</div>

<div className="flex items-center gap-2">
<span className="text-xs text-gray-500">Status:</span>
<select
                    value={selectedTakeoff.status}
                    onChange={(e) => handleStatusChange(selectedTakeoff.id, e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
                  >
<option value="DRAFT">DRAFT</option>
<option value="QS_APPROVED">QS_APPROVED</option>
<option value="ORDERED">ORDERED</option>
<option value="FABRICATED">FABRICATED</option>
<option value="ERECTED">ERECTED</option>
</select>
</div>
</div>

              {/* Takeoff Totals Strip */}
<div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg text-center">
<div>
<span className="text-xs text-gray-500">Total Weight / Tonnage</span>
<div className="text-base font-bold text-gray-900">{selectedTakeoff.totalTonnage} Tonnes</div>
</div>
<div>
<span className="text-xs text-gray-500">Intumescent Paint Area</span>
<div className="text-base font-bold text-indigo-600">{selectedTakeoff.totalPaintAreaM2} m²</div>
</div>
<div>
<span className="text-xs text-gray-500">Steel Grade Spec</span>
<div className="text-base font-bold text-emerald-600">{selectedTakeoff.steelGrade}</div>
</div>
</div>

              {/* Members Table */}
<div>
<h4 className="text-xs font-bold text-gray-700 mb-2">
                  Takeoff Members Bill (BS 4 Standard Sections)
</h4>
<div className="overflow-x-auto border border-gray-200 rounded-lg">
<table className="min-w-full divide-y divide-gray-200 text-xs text-left">
<thead className="bg-gray-50 text-gray-600 font-semibold ">
<tr>
<th className="px-3 py-2">Mark</th>
<th className="px-3 py-2">Section Designation</th>
<th className="px-3 py-2">Length</th>
<th className="px-3 py-2">Qty</th>
<th className="px-3 py-2">Total Length</th>
<th className="px-3 py-2">Unit Wt (kg/m)</th>
<th className="px-3 py-2">Total Wt (kg)</th>
<th className="px-3 py-2">Paint Area (m²)</th>
<th className="px-3 py-2">Bolts</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-100">
                      {selectedTakeoff.members && selectedTakeoff.members.length > 0 ? (
                        selectedTakeoff.members.map((m) => (
<tr key={m.id} className="hover:bg-gray-50">
<td className="px-3 py-2 font-bold text-gray-900">{m.memberMark}</td>
<td className="px-3 py-2 font-medium text-indigo-700">{m.sectionDesignation}</td>
<td className="px-3 py-2">{m.lengthMeters} m</td>
<td className="px-3 py-2 font-semibold">{m.quantity}</td>
<td className="px-3 py-2">{m.totalLengthMeters} m</td>
<td className="px-3 py-2 text-gray-500">{m.unitWeightKgPerM}</td>
<td className="px-3 py-2 font-bold text-gray-900">{m.totalWeightKg}</td>
<td className="px-3 py-2 text-indigo-600 font-semibold">{m.totalPaintAreaM2}</td>
<td className="px-3 py-2">{m.connectionBoltsCount} pcs</td>
</tr>
))
) : (
<tr>
<td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                            No member takeoff rows recorded for this schedule.
</td>
</tr>
)}
</tbody>
</table>
</div>
</div>
</div>
) : (
<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Select a takeoff from the list to view framing details and member takeoffs.
</div>
)}
</div>
</div>

      {/* MODAL: Create New Steel Takeoff */}
      {showAddModal && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 className="text-lg font-bold text-gray-900">New Structural Steel Framing Takeoff</h3>
<p className="text-xs text-gray-500">BS 4 / KS 02-104 Member Schedule &amp; Surface Area Estimator</p>
</div>
<button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>

<form onSubmit={handleCreateTakeoff} className="space-y-4 text-sm">
<div className="grid grid-cols-3 gap-3">
<div>
<label className="block text-xs font-medium text-gray-700">Takeoff No *</label>
<input
                    type="text"
                    required
                    value={takeoffNo}
                    onChange={(e) => setTakeoffNo(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Structure Title *</label>
<input
                    type="text"
                    required
                    placeholder="e.g. Warehouse Main Portal Frame"
                    value={structureTitle}
                    onChange={(e) => setStructureTitle(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Drawing Reference</label>
<input
                    type="text"
                    placeholder="e.g. STR/STL/W01-REV2"
                    value={drawingRef}
                    onChange={(e) => setDrawingRef(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">Steel Specification Grade</label>
<select
                  value={steelGrade}
                  onChange={(e) => setSteelGrade(e.target.value as any)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
                >
<option value="S355JR">S355JR (High-Yield Structural Steel - 355 N/mm²)</option>
<option value="S275JR">S275JR (Standard Structural Steel - 275 N/mm²)</option>
<option value="S355J2">S355J2 (Impact Tested Structural Steel -20°C)</option>
</select>
</div>

              {/* Members Schedule Table Input */}
<div>
<div className="flex justify-between items-center mb-2">
<h4 className="text-xs font-bold text-gray-700 ">Structural Members Schedule</h4>
<button
                    type="button"
                    onClick={addMemberRow}
                    className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded border border-indigo-200 hover:bg-indigo-100"
                  >
                    + Add Member
</button>
</div>

<div className="space-y-2">
                  {memberRows.map((row, idx) => (
<div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs">
<div className="w-24">
<input
                          type="text"
                          placeholder="Mark"
                          value={row.memberMark}
                          onChange={(e) => updateMemberRow(idx, 'memberMark', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs font-bold"
                        />
</div>
<div className="flex-1">
<select
                          value={row.sectionDesignation}
                          onChange={(e) => updateMemberRow(idx, 'sectionDesignation', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs"
                        >
                          {Object.keys(STEEL_SECTIONS_LIB).map((sec) => (
<option key={sec} value={sec}>
                              {sec} ({STEEL_SECTIONS_LIB[sec]?.unitWeightKgPerM} kg/m)
</option>
))}
</select>
</div>
<div className="w-20">
<input
                          type="number"
                          step="0.001"
                          placeholder="Length (m)"
                          value={row.lengthMeters}
                          onChange={(e) => updateMemberRow(idx, 'lengthMeters', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs"
                        />
</div>
<div className="w-16">
<input
                          type="number"
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => updateMemberRow(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full border rounded px-2 py-1 text-xs"
                        />
</div>
<div className="w-16">
<input
                          type="number"
                          placeholder="Bolts"
                          value={row.connectionBoltsCount}
                          onChange={(e) => updateMemberRow(idx, 'connectionBoltsCount', parseInt(e.target.value) || 0)}
                          className="w-full border rounded px-2 py-1 text-xs"
                        />
</div>
                      {memberRows.length > 1 && (
<button
                          type="button"
                          onClick={() => removeMemberRow(idx)}
                          className="text-red-500 hover:text-red-700 px-1 font-bold text-sm"
                        >
                          
</button>
)}
</div>
))}
</div>
</div>

              {/* Calculated Totals Preview */}
<div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex justify-around text-center">
<div>
<span className="text-xs text-indigo-700 font-medium">Estimated Tonnage</span>
<div className="text-lg font-bold text-indigo-900">{modalTotals.tonnage} T</div>
</div>
<div>
<span className="text-xs text-indigo-700 font-medium">Estimated Paint Area</span>
<div className="text-lg font-bold text-indigo-900">{modalTotals.paintArea} m²</div>
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
<button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">
                  Save Takeoff Schedule
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
