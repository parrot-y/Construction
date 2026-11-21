import React, { useEffect, useState} from 'react';
import { api } from '../lib/api';
import {
  AddWorkerModal,
  CreateMusterRollModal,
  LaborHeaderControls,
  LaborKpiCards,
  LaborTabs,
  MusterRollsTable,
  ReviewDisburseModal,
  WorkersRosterTable,
} from './LaborMusterRollView.parts';

export interface SiteLaborerItem {
  id: string;
  workerCode: string;
  fullName: string;
  nationalIdNo: string;
  phoneNumber: string;
  tradeCategory: string;
  skillLevel: 'CASUAL_MTU_WA_MKONO' | 'SEMI_SKILLED' | 'ARTISAN_FUNDI' | 'CHARGEHAND_FOREMAN';
  dailyRateKes: string;
  isActive: boolean;
  createdAt: string;
}

export interface LaborMusterRollItem {
  id: string;
  payrollNo: string;
  weekEndingDate: string;
  totalWorkers: number;
  totalManDays: string;
  grossWagesKes: string;
  statutoryDeductionsKes: string;
  netWagesPayableKes: string;
  status: 'DRAFT' | 'PENDING_VERIFICATION' | 'QS_APPROVED' | 'DISBURSED' | 'REJECTED';
  disbursementReference?: string | null;
  disbursedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

export interface LaborSummary {
  totalWorkers: number;
  activeWorkers: number;
  fundisCount: number;
  casualsCount: number;
}

interface LaborMusterRollViewProps {
  projectId: string;
  projectName?: string;
  laborers?: SiteLaborerItem[];
  musterRolls?: LaborMusterRollItem[];
  summary?: LaborSummary;
  userRole?: string;
  onCreateLaborer?: (data: any) => Promise<void>;
  onCreateMusterRoll?: (data: any) => Promise<void>;
  onReviewMusterRoll?: (musterRollId: string, status: string, disbursementReference?: string) => Promise<void>;
}

export const LaborMusterRollView: React.FC<LaborMusterRollViewProps> = ({
  projectId,
  projectName = 'Current Project',
  laborers: initialLaborers,
  musterRolls: initialMusterRolls,
  summary: initialSummary,
  userRole: _userRole = 'SITE_SUPERVISOR',
  onCreateLaborer,
  onCreateMusterRoll,
  onReviewMusterRoll,
}) => {
  const [laborerList, setLaborerList] = useState<SiteLaborerItem[]>(
    initialLaborers || (import.meta.env.DEV ? [
      {
        id: 'lab-1',
        workerCode: 'LAB-MSN-01',
        fullName: 'Juma Otieno Ochieng',
        nationalIdNo: '29841520',
        phoneNumber: '+254711223344',
        tradeCategory: 'MASON',
        skillLevel: 'ARTISAN_FUNDI',
        dailyRateKes: '1600.00',
        isActive: true,
        createdAt: '2026-11-01T08:00:00Z',
},
      {
        id: 'lab-2',
        workerCode: 'LAB-CRP-02',
        fullName: 'Boniface Kimani Mwangi',
        nationalIdNo: '24567890',
        phoneNumber: '+254722556677',
        tradeCategory: 'CARPENTER',
        skillLevel: 'ARTISAN_FUNDI',
        dailyRateKes: '1800.00',
        isActive: true,
        createdAt: '2026-11-01T08:00:00Z',
},
      {
        id: 'lab-3',
        workerCode: 'LAB-CAS-03',
        fullName: 'Ezekiel Kiprop Korir',
        nationalIdNo: '33445566',
        phoneNumber: '+254700112233',
        tradeCategory: 'CASUAL_LABORER',
        skillLevel: 'CASUAL_MTU_WA_MKONO',
        dailyRateKes: '850.00',
        isActive: true,
        createdAt: '2026-11-01T08:00:00Z',
},
    ] : [])
);

  const [musterRollsList, setMusterRollsList] = useState<LaborMusterRollItem[]>(
    initialMusterRolls || (import.meta.env.DEV ? [
      {
        id: 'mr-1',
        payrollNo: 'MR-WK44-001',
        weekEndingDate: '2026-11-06',
        totalWorkers: 3,
        totalManDays: '15.00',
        grossWagesKes: '21250.00',
        statutoryDeductionsKes: '0.00',
        netWagesPayableKes: '21250.00',
        status: 'PENDING_VERIFICATION',
        disbursementReference: null,
        disbursedAt: null,
        approvedBy: null,
        createdAt: '2026-11-03T10:00:00Z',
},
      {
        id: 'mr-2',
        payrollNo: 'MR-WK43-098',
        weekEndingDate: '2026-10-30',
        totalWorkers: 3,
        totalManDays: '18.00',
        grossWagesKes: '25500.00',
        statutoryDeductionsKes: '0.00',
        netWagesPayableKes: '25500.00',
        status: 'DISBURSED',
        disbursementReference: 'MPESA-B2C-PAYROLL-882910',
        disbursedAt: '2026-10-31T12:00:00Z',
        approvedBy: 'Arch. David Muthomi (QS)',
        createdAt: '2026-10-30T17:00:00Z',
},
    ] : [])
);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const [labRes, rollRes] = await Promise.allSettled([
        api.get<any>(`/api/v1/projects/${projectId}/laborers`),
        api.get<any>(`/api/v1/projects/${projectId}/muster-rolls`),
      ]);
      if (labRes.status === 'fulfilled') {
        const lj = labRes.value;
        const labs = (lj.laborers || lj.data || []) as any[];
        setLaborerList(labs.map((l) => ({
          id: l.id, workerCode: l.workerCode, fullName: l.fullName,
          nationalIdNo: l.nationalIdNo, phoneNumber: l.phoneNumber,
          tradeCategory: l.tradeCategory, skillLevel: l.skillLevel,
          dailyRateKes: l.dailyRateKes?.toString?.() ?? String(l.dailyRateKes ?? 0),
          isActive: l.isActive ?? true, createdAt: l.createdAt ?? '',
})));
}
      if (rollRes.status === 'fulfilled') {
        const rj = rollRes.value;
        const rolls = (rj.musterRolls || rj.data || []) as any[];
        setMusterRollsList(rolls.map((r) => ({
          id: r.id, payrollNo: r.payrollNo, weekEndingDate: r.weekEndingDate,
          totalWorkers: r.totalWorkers, totalManDays: r.totalManDays?.toString?.() ?? String(r.totalManDays ?? 0),
          grossWagesKes: r.grossWagesKes?.toString?.() ?? String(r.grossWagesKes ?? 0),
          statutoryDeductionsKes: r.statutoryDeductionsKes?.toString?.() ?? String(r.statutoryDeductionsKes ?? 0),
          netWagesPayableKes: r.netWagesPayableKes?.toString?.() ?? String(r.netWagesPayableKes ?? 0),
          status: r.status, disbursementReference: r.disbursementReference ?? null,
          disbursedAt: r.disbursedAt ?? null, approvedBy: r.approvedBy ?? null,
          createdAt: r.createdAt ?? '',
})));
}
} catch { /* keep demo */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  const [activeTab, setActiveTab] = useState<'MUSTER_ROLLS' | 'WORKERS_ROSTER'>('MUSTER_ROLLS');
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showCreateRollModal, setShowCreateRollModal] = useState(false);
  const [selectedRollForReview, setSelectedRollForReview] = useState<LaborMusterRollItem | null>(null);

  // Add Worker Form
  const [workerCode, setWorkerCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [nationalIdNo, setNationalIdNo] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+254');
  const [tradeCategory, setTradeCategory] = useState('MASON');
  const [skillLevel, setSkillLevel] = useState<'CASUAL_MTU_WA_MKONO' | 'SEMI_SKILLED' | 'ARTISAN_FUNDI' | 'CHARGEHAND_FOREMAN'>('ARTISAN_FUNDI');
  const [dailyRateKes, setDailyRateKes] = useState('1500.00');

  // Create Muster Roll Form
  const [payrollNo, setPayrollNo] = useState('');
  const [weekEndingDate, setWeekEndingDate] = useState(new Date().toISOString().slice(0, 10));
  const [rollNotes, setRollNotes] = useState('');
  const [attendanceEntries, setAttendanceEntries] = useState(
    import.meta.env.DEV
      ? [
          { laborerId: laborerList[0]?.id || '', daysWorked: '6.00', overtimeHours: '0.00', taskAssigned: 'Superstructure masonry walling'},
          { laborerId: laborerList[1]?.id || '', daysWorked: '6.00', overtimeHours: '4.00', taskAssigned: 'Slab soffit formwork propping'},
          { laborerId: laborerList[2]?.id || '', daysWorked: '6.00', overtimeHours: '2.00', taskAssigned: 'Material carriage and concrete mixing'},
        ]
      : [],
  );

  // Review & Disburse Modal Form
  const [reviewStatus, setReviewStatus] = useState<'QS_APPROVED' | 'DISBURSED' | 'REJECTED'>('QS_APPROVED');
  const [disbursementRef, setDisbursementRef] = useState('');

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      workerCode,
      fullName,
      nationalIdNo,
      phoneNumber,
      tradeCategory,
      skillLevel,
      dailyRateKes,
};

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/laborers`, payload);
        await reload(); setShowAddWorkerModal(false); setWorkerCode(''); setFullName(''); setNationalIdNo(''); return;
} catch { /* fall through to local */}
}
    if (onCreateLaborer) {
      await onCreateLaborer(payload);
}

    const newWorker: SiteLaborerItem = {
      id: `lab-${Date.now()}`,
      workerCode,
      fullName,
      nationalIdNo,
      phoneNumber,
      tradeCategory,
      skillLevel,
      dailyRateKes,
      isActive: true,
      createdAt: new Date().toISOString(),
};

    setLaborerList([...laborerList, newWorker]);
    setShowAddWorkerModal(false);
    setWorkerCode('');
    setFullName('');
    setNationalIdNo('');
};

  const handleCreateMusterRoll = async (e: React.FormEvent) => {
    e.preventDefault();

    let grossWages = 0;
    let totalDays = 0;

    const attendances = attendanceEntries.map((entry) => {
      const worker = laborerList.find((l) => l.id === entry.laborerId);
      const rate = parseFloat(worker?.dailyRateKes || '1000');
      const days = parseFloat(entry.daysWorked) || 0;
      const ot = parseFloat(entry.overtimeHours) || 0;
      const otEarnings = ot > 0 ? (rate / 8) * 1.5 * ot : 0;
      const earnings = days * rate + otEarnings;

      grossWages += earnings;
      totalDays += days;

      return {
        laborerId: entry.laborerId,
        attendanceDate: weekEndingDate,
        daysWorked: days.toFixed(2),
        overtimeHours: ot.toFixed(2),
        taskAssigned: entry.taskAssigned,
        verifiedBy: 'Eng. John Mwangi (Site Supervisor)',
};
});

    const payload = {
      payrollNo,
      weekEndingDate,
      notes: rollNotes,
      attendances,
};

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/muster-rolls`, payload);
        await reload(); return;
} catch { /* fall through */}
}
    if (onCreateMusterRoll) {
      await onCreateMusterRoll(payload);
}

    const newRoll: LaborMusterRollItem = {
      id: `mr-${Date.now()}`,
      payrollNo,
      weekEndingDate,
      totalWorkers: attendanceEntries.length,
      totalManDays: totalDays.toFixed(2),
      grossWagesKes: grossWages.toFixed(2),
      statutoryDeductionsKes: '0.00',
      netWagesPayableKes: grossWages.toFixed(2),
      status: 'PENDING_VERIFICATION',
      disbursementReference: null,
      disbursedAt: null,
      approvedBy: null,
      createdAt: new Date().toISOString(),
};

    setMusterRollsList([newRoll, ...musterRollsList]);
    setShowCreateRollModal(false);
};

  const handleReviewRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRollForReview) return;

    if (isLive) {
      try {
        await api.patch(`/api/v1/projects/${projectId}/muster-rolls/${selectedRollForReview.id}`, { status: reviewStatus, disbursementReference: disbursementRef});
        await reload();
} catch { /* ignore */}
}
    if (onReviewMusterRoll) {
      await onReviewMusterRoll(selectedRollForReview.id, reviewStatus, disbursementRef);
}

    setMusterRollsList(
      musterRollsList.map((r) =>
        r.id === selectedRollForReview.id
          ? {
              ...r,
              status: reviewStatus,
              disbursementReference: reviewStatus === 'DISBURSED' ? disbursementRef : r.disbursementReference,
              disbursedAt: reviewStatus === 'DISBURSED' ? new Date().toISOString() : r.disbursedAt,
              approvedBy: reviewStatus === 'QS_APPROVED' ? 'Arch. David Muthomi (QS)' : r.approvedBy,
}
          : r
)
);

    setSelectedRollForReview(null);
};

  const summary = initialSummary || {
    totalWorkers: laborerList.length,
    activeWorkers: laborerList.filter((l) => l.isActive).length,
    fundisCount: laborerList.filter((l) => l.skillLevel === 'ARTISAN_FUNDI' || l.skillLevel === 'CHARGEHAND_FOREMAN').length,
    casualsCount: laborerList.filter((l) => l.skillLevel === 'CASUAL_MTU_WA_MKONO' || l.skillLevel === 'SEMI_SKILLED').length,
};

  const totalDisbursedKes = musterRollsList
    .filter((r) => r.status === 'DISBURSED')
    .reduce((sum, r) => sum + parseFloat(r.netWagesPayableKes), 0);

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading labor muster…</div>;
}
  return (
<div className="space-y-6">
      {/* Header & Controls */}
<LaborHeaderControls
        projectName={projectName}
        onAddWorker={() => setShowAddWorkerModal(true)}
        onCreateRoll={() => setShowCreateRollModal(true)}
      />

      {/* KPI Cards */}
<LaborKpiCards
        summary={summary}
        musterRollsList={musterRollsList}
        totalDisbursedKes={totalDisbursedKes}
      />

      {/* Tabs */}
<LaborTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        musterRollsCount={musterRollsList.length}
        workersCount={laborerList.length}
      />

      {/* Tab 1: Weekly Muster Rolls */}
      {activeTab === 'MUSTER_ROLLS' && (
<MusterRollsTable
          musterRollsList={musterRollsList}
          onReviewRoll={(roll) => setSelectedRollForReview(roll)}
        />
)}

      {/* Tab 2: Laborer Roster */}
      {activeTab === 'WORKERS_ROSTER' && (
<WorkersRosterTable laborerList={laborerList} />
)}

      {/* Modal: Add Worker */}
      {showAddWorkerModal && (
<AddWorkerModal
          onClose={() => setShowAddWorkerModal(false)}
          onSubmit={handleCreateWorker}
          workerCode={workerCode}
          setWorkerCode={setWorkerCode}
          fullName={fullName}
          setFullName={setFullName}
          nationalIdNo={nationalIdNo}
          setNationalIdNo={setNationalIdNo}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          tradeCategory={tradeCategory}
          setTradeCategory={setTradeCategory}
          skillLevel={skillLevel}
          setSkillLevel={setSkillLevel}
          dailyRateKes={dailyRateKes}
          setDailyRateKes={setDailyRateKes}
        />
)}

      {/* Modal: Compile Muster Roll */}
      {showCreateRollModal && (
<CreateMusterRollModal
          onClose={() => setShowCreateRollModal(false)}
          onSubmit={handleCreateMusterRoll}
          payrollNo={payrollNo}
          setPayrollNo={setPayrollNo}
          weekEndingDate={weekEndingDate}
          setWeekEndingDate={setWeekEndingDate}
          rollNotes={rollNotes}
          setRollNotes={setRollNotes}
          attendanceEntries={attendanceEntries}
          setAttendanceEntries={setAttendanceEntries}
          laborerList={laborerList}
        />
)}

      {/* Modal: Review & Disburse */}
      {selectedRollForReview && (
<ReviewDisburseModal
          roll={selectedRollForReview}
          onClose={() => setSelectedRollForReview(null)}
          onSubmit={handleReviewRoll}
          reviewStatus={reviewStatus}
          setReviewStatus={setReviewStatus}
          disbursementRef={disbursementRef}
          setDisbursementRef={setDisbursementRef}
        />
)}
</div>
);
};
