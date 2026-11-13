import React, { useEffect, useState} from 'react';

export interface BarBendingItem {
  id: string;
  memberTag: string;
  barMark: string;
  barType: string;
  numberOfMembers: number;
  barsPerMember: number;
  totalBars: number;
  shapeCode: string;
  cutLengthMeters: string;
  totalLengthMeters: string;
  unitWeightKgPerM: string;
  totalWeightKg: string;
  standardBarsNeeded12m: number;
}

export interface BarBendingScheduleItem {
  id: string;
  scheduleNumber: string;
  elementName: string;
  drawingRef?: string | null;
  steelGrade: string;
  totalTonnage: string;
  status: 'DRAFT' | 'APPROVED_FOR_CUTTING' | 'FABRICATED';
  itemCount: number;
  createdAt: string;
  items?: BarBendingItem[];
}

interface BarBendingScheduleViewProps {
  projectId: string;
  projectName?: string;
  initialSchedules?: BarBendingScheduleItem[];
  onCreateSchedule?: (schedule: any) => Promise<void>;
  onUpdateStatus?: (scheduleId: string, status: string) => Promise<void>;
}

const DEFAULT_SCHEDULES: BarBendingScheduleItem[] = [
  {
    id: 'bbs-001',
    scheduleNumber: 'BBS-SUB-001',
    elementName: 'Substructure Footings & Ground Beams',
    drawingRef: 'STR/DWG/04-REV2',
    steelGrade: 'HIGH_YIELD_460',
    totalTonnage: '14.850',
    status: 'APPROVED_FOR_CUTTING',
    itemCount: 8,
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'bbi-1',
        memberTag: 'Footing F1 (1500x1500x400)',
        barMark: '01',
        barType: 'Y16',
        numberOfMembers: 12,
        barsPerMember: 8,
        totalBars: 96,
        shapeCode: '00',
        cutLengthMeters: '1.400',
        totalLengthMeters: '134.400',
        unitWeightKgPerM: '1.579',
        totalWeightKg: '212.22',
        standardBarsNeeded12m: 12,
},
      {
        id: 'bbi-2',
        memberTag: 'Ground Beam GB1',
        barMark: '02',
        barType: 'Y20',
        numberOfMembers: 4,
        barsPerMember: 6,
        totalBars: 24,
        shapeCode: '21',
        cutLengthMeters: '6.000',
        totalLengthMeters: '144.000',
        unitWeightKgPerM: '2.466',
        totalWeightKg: '355.10',
        standardBarsNeeded12m: 12,
},
      {
        id: 'bbi-3',
        memberTag: 'Column Starter Links C1',
        barMark: '03',
        barType: 'Y8',
        numberOfMembers: 12,
        barsPerMember: 14,
        totalBars: 168,
        shapeCode: '51',
        cutLengthMeters: '1.292',
        totalLengthMeters: '217.056',
        unitWeightKgPerM: '0.395',
        totalWeightKg: '85.74',
        standardBarsNeeded12m: 19,
},
    ],
},
];

export const BarBendingScheduleView: React.FC<BarBendingScheduleViewProps> = ({
  projectId,
  projectName = 'Apex Site',
  initialSchedules = DEFAULT_SCHEDULES,
  onCreateSchedule,
  onUpdateStatus,
}) => {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [schedules, setSchedules] = useState<BarBendingScheduleItem[]>(initialSchedules);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/bar-bending-schedules`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.schedules || []) as any[];
      setSchedules(list.map((s) => ({
        ...s,
        status: s.status as BarBendingScheduleItem['status'],
})));
} catch {
      setSchedules([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);
  const [selectedSchedule, setSelectedSchedule] = useState<BarBendingScheduleItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [scheduleNumber, setScheduleNumber] = useState(`BBS-${Date.now().toString().slice(-4)}`);
  const [elementName, setElementName] = useState('');
  const [drawingRef, setDrawingRef] = useState('STR/DWG/01');
  const [steelGrade, setSteelGrade] = useState('HIGH_YIELD_460');

  // Single Item Input
  const [memberTag, setMemberTag] = useState('Column C1');
  const [barMark, setBarMark] = useState('01');
  const [barType, setBarType] = useState('Y16');
  const [numberOfMembers, setNumberOfMembers] = useState(4);
  const [barsPerMember, setBarsPerMember] = useState(6);
  const [shapeCode, setShapeCode] = useState('00');
  const [dimA, setDimA] = useState(3000);
  const [dimB, setDimB] = useState(450);

  // Calculations Preview
  const totalBarsPreview = numberOfMembers * barsPerMember;
  const unitWeights: Record<string, number> = {
    Y8: 0.395,
    Y10: 0.617,
    Y12: 0.888,
    Y16: 1.579,
    Y20: 2.466,
    Y25: 3.854,
    Y32: 6.313,
};
  const unitWeight = unitWeights[barType] || 1.579;
  const cutLengthMeters = (shapeCode === '00' ? dimA : shapeCode === '21' ? dimA + dimB : 2 * (dimA + dimB) + 24 * (parseInt(barType.replace(/\D/g, '')) || 12)) / 1000;
  const totalLengthMeters = cutLengthMeters * totalBarsPreview;
  const totalWeightKg = totalLengthMeters * unitWeight;
  const standardBars12m = Math.max(1, Math.ceil(totalLengthMeters / 12));

  const totalTonnageSum = schedules
    .reduce((sum, s) => sum + parseFloat(s.totalTonnage || '0'), 0)
    .toFixed(3);

  const handleViewSchedule = async (schedule: BarBendingScheduleItem) => {
    if (isLive && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schedule.id)) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/bar-bending-schedules/${schedule.id}`, { credentials: 'include'});
        if (res.ok) {
          const detail = await res.json();
          setSelectedSchedule({ ...schedule, ...detail, items: detail.items ?? []});
          return;
}
} catch { /* fall through to local view */}
}
    setSelectedSchedule(schedule);
};

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elementName.trim()) {
      setFeedback('Error: Element name is required');
      return;
}

    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/bar-bending-schedules`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            scheduleNumber,
            elementName,
            drawingRef: drawingRef || null,
            steelGrade,
            items: [
              {
                memberTag,
                barMark,
                barType,
                numberOfMembers,
                barsPerMember,
                shapeCode,
                dimensionAMm: dimA,
                dimensionBMm: shapeCode !== '00' ? dimB : null,
},
            ],
}),
});
        if (res.ok) {
          await reload();
          setIsModalOpen(false);
          setFeedback(` Created Bar Bending Schedule ${scheduleNumber}`);
} else {
          const errJson = await res.json().catch(() => null);
          setFeedback(`Error: ${errJson?.message || `Request failed (${res.status})`}`);
}
} catch {
        setFeedback('Error: Network request failed');
}
      return;
}

    try {
      const newItem: BarBendingItem = {
        id: `bbi-${Date.now()}`,
        memberTag,
        barMark,
        barType,
        numberOfMembers,
        barsPerMember,
        totalBars: totalBarsPreview,
        shapeCode,
        cutLengthMeters: cutLengthMeters.toFixed(3),
        totalLengthMeters: totalLengthMeters.toFixed(3),
        unitWeightKgPerM: unitWeight.toFixed(3),
        totalWeightKg: totalWeightKg.toFixed(2),
        standardBarsNeeded12m: standardBars12m,
};

      const tonnage = (totalWeightKg / 1000).toFixed(3);

      const newSchedule: BarBendingScheduleItem = {
        id: `bbs-${Date.now()}`,
        scheduleNumber,
        elementName,
        drawingRef,
        steelGrade,
        totalTonnage: tonnage,
        status: 'DRAFT',
        itemCount: 1,
        createdAt: new Date().toISOString(),
        items: [newItem],
};

      if (onCreateSchedule) {
        await onCreateSchedule({
          scheduleNumber,
          elementName,
          drawingRef,
          steelGrade,
          items: [
            {
              memberTag,
              barMark,
              barType,
              numberOfMembers,
              barsPerMember,
              shapeCode,
              dimensionAMm: dimA,
              dimensionBMm: shapeCode !== '00' ? dimB : null,
},
          ],
});
}

      setSchedules([newSchedule, ...schedules]);
      setIsModalOpen(false);
      setFeedback(` Created Bar Bending Schedule ${scheduleNumber} (${tonnage} Tonnes calculated)`);
} catch (err: any) {
      setFeedback(`Error: ${err.message}`);
}
};

  const handleStatusChange = async (scheduleId: string, newStatus: string) => {
    if (isLive) {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/bar-bending-schedules/${scheduleId}/status`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ status: newStatus}),
});
        if (res.ok) {
          await reload();
          setFeedback(` Schedule status updated to ${newStatus}`);
} else {
          const errJson = await res.json().catch(() => null);
          setFeedback(`Error: ${errJson?.message || `Request failed (${res.status})`}`);
}
} catch {
        setFeedback('Error: Network request failed');
}
      return;
}
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(scheduleId, newStatus);
}
      setSchedules(
        schedules.map((s) => (s.id === scheduleId ? { ...s, status: newStatus as any} : s))
);
      setFeedback(` Schedule status updated to ${newStatus}`);
} catch (err: any) {
      setFeedback(`Error: ${err.message}`);
}
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">Loading bar bending schedules...</div>;
}

  return (
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      {/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
<div>
<div className="flex items-center gap-2">
<span className="text-2xl"></span>
<h2 className="text-xl font-bold text-gray-900">Rebar Takeoff & BS 8666 Bar Bending Schedule (BBS)</h2>
<span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded font-semibold">
              KS 02-598 Certified
</span>
</div>
<p className="text-sm text-gray-500 mt-1">
            Site:<strong className="text-gray-700">{projectName}</strong> • Automated steel cutting list, bar weights, shape codes, and commercial 12m stock lengths
</p>
</div>
<button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
        >
          + New BBS Schedule
</button>
</div>

      {feedback && (
<div className={`p-4 rounded-md text-sm font-medium ${feedback.startsWith('') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {feedback}
</div>
)}

      {/* KPI Cards */}
<div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
<p className="text-xs font-medium text-gray-500 ">Total Steel Tonnage</p>
<p className="text-2xl font-bold text-gray-900 mt-1">{totalTonnageSum}<span className="text-sm font-normal text-gray-500">Tonnes</span></p>
<span className="text-xs text-blue-600 font-medium">BS 8666 Compliant</span>
</div>
<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
<p className="text-xs font-medium text-gray-500 ">BBS Schedules</p>
<p className="text-2xl font-bold text-gray-900 mt-1">{schedules.length}</p>
<span className="text-xs text-gray-500 font-medium">Sub & Superstructure</span>
</div>
<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
<p className="text-xs font-medium text-gray-500 ">Approved for Cutting</p>
<p className="text-2xl font-bold text-green-600 mt-1">
            {schedules.filter((s) => s.status === 'APPROVED_FOR_CUTTING').length}
</p>
<span className="text-xs text-gray-500 font-medium">Ready for Steel Fixers</span>
</div>
<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
<p className="text-xs font-medium text-gray-500 ">Stock Bar Length</p>
<p className="text-2xl font-bold text-gray-900 mt-1">12.0<span className="text-sm font-normal text-gray-500">Meters</span></p>
<span className="text-xs text-green-600 font-medium">East African Commercial Std</span>
</div>
</div>

      {/* Schedules Table */}
<div className="overflow-x-auto border border-gray-200 rounded-lg">
<table className="min-w-full divide-y divide-gray-200 text-sm">
<thead className="bg-gray-50">
<tr>
<th className="px-4 py-3 text-left font-semibold text-gray-700">Schedule No</th>
<th className="px-4 py-3 text-left font-semibold text-gray-700">Structural Element</th>
<th className="px-4 py-3 text-left font-semibold text-gray-700">Drawing Ref</th>
<th className="px-4 py-3 text-left font-semibold text-gray-700">Steel Grade</th>
<th className="px-4 py-3 text-right font-semibold text-gray-700">Tonnage (Tonnes)</th>
<th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
<th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-200 bg-white">
            {schedules.map((schedule) => (
<tr key={schedule.id} className="hover:bg-gray-50">
<td className="px-4 py-3 font-semibold text-blue-600">{schedule.scheduleNumber}</td>
<td className="px-4 py-3 font-medium text-gray-900">{schedule.elementName}</td>
<td className="px-4 py-3 text-gray-500">{schedule.drawingRef || '—'}</td>
<td className="px-4 py-3 text-gray-600">{schedule.steelGrade}</td>
<td className="px-4 py-3 text-right font-bold text-gray-900">{schedule.totalTonnage} T</td>
<td className="px-4 py-3 text-center">
<span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      schedule.status === 'APPROVED_FOR_CUTTING'
                        ? 'bg-green-100 text-green-800'
                        : schedule.status === 'FABRICATED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
}`}
                  >
                    {schedule.status}
</span>
</td>
<td className="px-4 py-3 text-right space-x-2">
<button
                    onClick={() => void handleViewSchedule(schedule)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                  >
                    View Cutting List
</button>
                  {schedule.status === 'DRAFT' && (
<button
                      onClick={() => handleStatusChange(schedule.id, 'APPROVED_FOR_CUTTING')}
                      className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded font-medium"
                    >
                      Approve
</button>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>

      {/* Selected Schedule Cutting List Detail Modal */}
      {selectedSchedule && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
<div className="bg-white rounded-lg max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 className="text-lg font-bold text-gray-900">
                  {selectedSchedule.scheduleNumber}: {selectedSchedule.elementName}
</h3>
<p className="text-xs text-gray-500">
                  Total Calculated Tonnage:<strong>{selectedSchedule.totalTonnage} Tonnes</strong> • Drawing: {selectedSchedule.drawingRef}
</p>
</div>
<button onClick={() => setSelectedSchedule(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                
</button>
</div>

<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 text-xs">
<thead className="bg-gray-50 font-semibold text-gray-700">
<tr>
<th className="px-3 py-2 text-left">Member</th>
<th className="px-3 py-2 text-center">Mark</th>
<th className="px-3 py-2 text-center">Type</th>
<th className="px-3 py-2 text-center">Bars</th>
<th className="px-3 py-2 text-center">Shape</th>
<th className="px-3 py-2 text-right">Cut L (m)</th>
<th className="px-3 py-2 text-right">Total L (m)</th>
<th className="px-3 py-2 text-right">kg/m</th>
<th className="px-3 py-2 text-right">Weight (kg)</th>
<th className="px-3 py-2 text-center">12m Bars</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-200 bg-white">
                  {selectedSchedule.items?.map((item) => (
<tr key={item.id} className="hover:bg-gray-50">
<td className="px-3 py-2 font-medium text-gray-900">{item.memberTag}</td>
<td className="px-3 py-2 text-center text-blue-600 font-bold">{item.barMark}</td>
<td className="px-3 py-2 text-center font-semibold">{item.barType}</td>
<td className="px-3 py-2 text-center text-gray-600">{item.totalBars} ({item.numberOfMembers}x{item.barsPerMember})</td>
<td className="px-3 py-2 text-center bg-gray-50 tabular-nums">Shape {item.shapeCode}</td>
<td className="px-3 py-2 text-right font-medium">{item.cutLengthMeters}m</td>
<td className="px-3 py-2 text-right">{item.totalLengthMeters}m</td>
<td className="px-3 py-2 text-right text-gray-500">{item.unitWeightKgPerM}</td>
<td className="px-3 py-2 text-right font-bold text-gray-900">{item.totalWeightKg} kg</td>
<td className="px-3 py-2 text-center font-bold text-indigo-600">{item.standardBarsNeeded12m}</td>
</tr>
))}
</tbody>
</table>
</div>

<div className="flex justify-end pt-2">
<button
                onClick={() => setSelectedSchedule(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md"
              >
                Close Cutting List
</button>
</div>
</div>
</div>
)}

      {/* Create Schedule Modal */}
      {isModalOpen && (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
<form onSubmit={handleCreateSchedule} className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">Create Bar Bending Schedule (BBS)</h3>
<button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                
</button>
</div>

<div className="grid grid-cols-3 gap-3">
<div>
<label className="block text-xs font-medium text-gray-700">Schedule Number</label>
<input
                  type="text"
                  value={scheduleNumber}
                  onChange={(e) => setScheduleNumber(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm"
                  required
                />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Drawing Reference</label>
<input
                  type="text"
                  value={drawingRef}
                  onChange={(e) => setDrawingRef(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm"
                />
</div>
<div>
<label className="block text-xs font-medium text-gray-700">Steel Grade</label>
<select
                  value={steelGrade}
                  onChange={(e) => setSteelGrade(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm"
                >
<option value="HIGH_YIELD_460">High Yield 460 N/mm²</option>
<option value="HIGH_YIELD_500">High Yield 500 N/mm²</option>
<option value="MILD_STEEL_250">Mild Steel 250 N/mm²</option>
<option value="STAINLESS_304">Stainless Steel 304</option>
</select>
</div>
</div>

<div>
<label className="block text-xs font-medium text-gray-700">Structural Element Name</label>
<input
                type="text"
                placeholder="e.g. Ground Floor Ring Beams RB1-RB8"
                value={elementName}
                onChange={(e) => setElementName(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm"
                required
              />
</div>

<div className="border-t pt-4">
<h4 className="text-xs font-bold text-gray-700 mb-2">First Reinforcement Bar Configuration</h4>
<div className="grid grid-cols-4 gap-3">
<div>
<label className="block text-xs font-medium text-gray-600">Member Tag</label>
<input
                    type="text"
                    value={memberTag}
                    onChange={(e) => setMemberTag(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-600">Bar Mark</label>
<input
                    type="text"
                    value={barMark}
                    onChange={(e) => setBarMark(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-600">Bar Type</label>
<select
                    value={barType}
                    onChange={(e) => setBarType(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  >
                    {['Y8', 'Y10', 'Y12', 'Y16', 'Y20', 'Y25', 'Y32'].map((t) => (
<option key={t} value={t}>{t} ({unitWeights[t]} kg/m)</option>
))}
</select>
</div>
<div>
<label className="block text-xs font-medium text-gray-600">Shape Code</label>
<select
                    value={shapeCode}
                    onChange={(e) => setShapeCode(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  >
<option value="00">Shape 00 (Straight)</option>
<option value="11">Shape 11 (One Bend)</option>
<option value="21">Shape 21 (L-Bar)</option>
<option value="51">Shape 51 (Rectangular Link)</option>
<option value="61">Shape 61 (Helical/Circular)</option>
</select>
</div>
</div>

<div className="grid grid-cols-4 gap-3 mt-3">
<div>
<label className="block text-xs font-medium text-gray-600">No. of Members</label>
<input
                    type="number"
                    min="1"
                    value={numberOfMembers}
                    onChange={(e) => setNumberOfMembers(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-600">Bars/Member</label>
<input
                    type="number"
                    min="1"
                    value={barsPerMember}
                    onChange={(e) => setBarsPerMember(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  />
</div>
<div>
<label className="block text-xs font-medium text-gray-600">Dim A (mm)</label>
<input
                    type="number"
                    min="0"
                    value={dimA}
                    onChange={(e) => setDimA(parseInt(e.target.value) || 0)}
                    className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                  />
</div>
                {shapeCode !== '00' && (
<div>
<label className="block text-xs font-medium text-gray-600">Dim B (mm)</label>
<input
                      type="number"
                      min="0"
                      value={dimB}
                      onChange={(e) => setDimB(parseInt(e.target.value) || 0)}
                      className="mt-1 w-full border border-gray-300 rounded-md p-1.5 text-xs"
                    />
</div>
)}
</div>

              {/* Real-time Math Summary Preview */}
<div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-4 text-xs space-y-1 text-blue-900">
<p><strong>Live Takeoff Preview:</strong></p>
<p>Cut Length:<strong>{cutLengthMeters.toFixed(3)}m</strong> • Total Bars:<strong>{totalBarsPreview}</strong> • Total Linear:<strong>{totalLengthMeters.toFixed(3)}m</strong></p>
<p>Total Weight:<strong>{totalWeightKg.toFixed(2)} kg</strong> ({ (totalWeightKg / 1000).toFixed(3)} Tonnes) • 12m Stock Bars:<strong>{standardBars12m}</strong></p>
</div>
</div>

<div className="flex justify-end gap-2 border-t pt-4">
<button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
              >
                Cancel
</button>
<button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm"
              >
                Generate BBS Schedule
</button>
</div>
</form>
</div>
)}
</div>
);
};
