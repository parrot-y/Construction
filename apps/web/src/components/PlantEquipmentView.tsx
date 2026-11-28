import React, { useEffect, useState} from 'react';
import { api } from '../lib/api';
import {
  EquipmentLogModal,
  FuelAuditTable,
  MachineryRegisterTable,
  PlantHeaderControls,
  PlantKpiCards,
  PlantTabs,
  RegisterMachineModal,
} from './PlantEquipmentView.parts';

export interface PlantEquipmentItem {
  id: string;
  equipmentCode: string;
  name: string;
  equipmentType: string;
  ownershipType: 'OWNED' | 'HIRED_DRY' | 'HIRED_WET';
  ratePerUnitKes: string;
  rateUnit: 'PER_HOUR' | 'PER_DAY' | 'PER_MONTH';
  registrationNo?: string | null;
  supplierName?: string | null;
  currentHoursMeter: string;
  status: 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'BREAKDOWN' | 'DECOMMISSIONED';
  createdAt: string;
}

export interface EquipmentDailyLogItem {
  id: string;
  equipmentId: string;
  logDate: string;
  operatorName: string;
  openingHoursMeter: string;
  closingHoursMeter: string;
  operatingHours: string;
  idleOrBreakdownHours: string;
  fuelLitersIssued: string;
  fuelCostPerLiterKes: string;
  totalFuelCostKes: string;
  fuelBurnLitersPerHour: string;
  fuelEfficiencyStatus: 'NORMAL' | 'ELEVATED_BURN' | 'SUSPECTED_DISCREPANCY' | 'SUSPECTED_SIPHONING';
  activitiesPerformed?: string | null;
  verifiedBySupervisor: string;
}

export interface PlantEquipmentSummary {
  totalEquipment: number;
  operationalCount: number;
  totalHoursLogged: string;
}

interface PlantEquipmentViewProps {
  projectId: string;
  projectName?: string;
  equipment?: PlantEquipmentItem[];
  logs?: EquipmentDailyLogItem[];
  summary?: PlantEquipmentSummary;
  userRole?: string;
  onCreateEquipment?: (data: any) => Promise<void>;
  onRecordLog?: (data: any) => Promise<void>;
}

export const PlantEquipmentView: React.FC<PlantEquipmentViewProps> = ({
  projectId,
  projectName = 'Current Project',
  equipment: initialEquipment,
  logs: initialLogs,
  summary: initialSummary,
  userRole: _userRole = 'SITE_SUPERVISOR',
  onCreateEquipment,
  onRecordLog,
}) => {
  const [equipmentList, setEquipmentList] = useState<PlantEquipmentItem[]>(
    initialEquipment || (import.meta.env.DEV ? [
      {
        id: 'eq-1',
        equipmentCode: 'EXC-001',
        name: 'CAT 320D Hydraulic Excavator',
        equipmentType: 'EXCAVATOR',
        ownershipType: 'HIRED_WET',
        ratePerUnitKes: '6500.00',
        rateUnit: 'PER_HOUR',
        registrationNo: 'KDF 819B',
        supplierName: 'Simba Heavy Plant Hire Ltd',
        currentHoursMeter: '1430.50',
        status: 'OPERATIONAL',
        createdAt: '2026-11-01T08:00:00Z',
},
      {
        id: 'eq-2',
        equipmentCode: 'MIX-002',
        name: 'Winget 400L Diesel Concrete Mixer',
        equipmentType: 'CONCRETE_MIXER',
        ownershipType: 'OWNED',
        ratePerUnitKes: '3500.00',
        rateUnit: 'PER_DAY',
        registrationNo: null,
        supplierName: null,
        currentHoursMeter: '580.00',
        status: 'OPERATIONAL',
        createdAt: '2026-10-15T09:00:00Z',
},
      {
        id: 'eq-3',
        equipmentCode: 'GEN-003',
        name: 'Cummins 150kVA Silent Diesel Generator',
        equipmentType: 'GENERATOR',
        ownershipType: 'HIRED_DRY',
        ratePerUnitKes: '12000.00',
        rateUnit: 'PER_DAY',
        registrationNo: 'KDC 402P',
        supplierName: 'Apex Machinery Fleet',
        currentHoursMeter: '890.20',
        status: 'OPERATIONAL',
        createdAt: '2026-10-20T10:00:00Z',
},
    ] : [])
);

  const [logsList, setLogsList] = useState<EquipmentDailyLogItem[]>(
    initialLogs || (import.meta.env.DEV ? [
      {
        id: 'log-1',
        equipmentId: 'eq-1',
        logDate: '2026-11-03',
        operatorName: 'Peter Kamau Mwangi',
        openingHoursMeter: '1420.50',
        closingHoursMeter: '1428.50',
        operatingHours: '8.00',
        idleOrBreakdownHours: '0.50',
        fuelLitersIssued: '96.00',
        fuelCostPerLiterKes: '185.00',
        totalFuelCostKes: '17760.00',
        fuelBurnLitersPerHour: '12.00',
        fuelEfficiencyStatus: 'NORMAL',
        activitiesPerformed: 'Basement foundation raft excavation and spoil haulage',
        verifiedBySupervisor: 'Eng. John Mwangi',
},
      {
        id: 'log-2',
        equipmentId: 'eq-1',
        logDate: '2026-11-04',
        operatorName: 'Peter Kamau Mwangi',
        openingHoursMeter: '1428.50',
        closingHoursMeter: '1430.50',
        operatingHours: '2.00',
        idleOrBreakdownHours: '6.00',
        fuelLitersIssued: '90.00',
        fuelCostPerLiterKes: '185.00',
        totalFuelCostKes: '16650.00',
        fuelBurnLitersPerHour: '45.00',
        fuelEfficiencyStatus: 'SUSPECTED_DISCREPANCY',
        activitiesPerformed: 'Idle standby with light soil shifting',
        verifiedBySupervisor: 'Eng. John Mwangi',
},
    ] : [])
);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const json = await api.get<{ equipment?: any[] }>(`/api/v1/projects/${projectId}/equipment`);
      const list = (json.equipment || []) as any[];
      setEquipmentList(list.map((e) => ({
        ...e,
        ratePerUnitKes: e.ratePerUnitKes?.toString?.() ?? String(e.ratePerUnitKes ?? 0),
        currentHoursMeter: e.currentHoursMeter?.toString?.() ?? String(e.currentHoursMeter ?? 0),
})));
      // No GET endpoint exists for daily logs; keep caller-provided logs, else clear demo rows.
      setLogsList(initialLogs || []);
} catch {
      setEquipmentList([]); setLogsList(initialLogs || []);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId, initialLogs]);

  useEffect(() => { void reload();}, [reload]);

  const [activeTab, setActiveTab] = useState<'MACHINERY' | 'FUEL_AUDIT'>('MACHINERY');
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [showAddLogModal, setShowAddLogModal] = useState(false);

  // Form states for registering machinery
  const [equipmentCode, setEquipmentCode] = useState('');
  const [name, setName] = useState('');
  const [equipmentType, setEquipmentType] = useState('EXCAVATOR');
  const [ownershipType, setOwnershipType] = useState<'OWNED' | 'HIRED_DRY' | 'HIRED_WET'>('OWNED');
  const [ratePerUnitKes, setRatePerUnitKes] = useState('5000.00');
  const [rateUnit, setRateUnit] = useState<'PER_HOUR' | 'PER_DAY' | 'PER_MONTH'>('PER_DAY');
  const [registrationNo, setRegistrationNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [currentHoursMeter, setCurrentHoursMeter] = useState('0.00');

  // Form states for daily log
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(equipmentList[0]?.id || '');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [operatorName, setOperatorName] = useState('');
  const [openingHours, setOpeningHours] = useState('0.00');
  const [closingHours, setClosingHours] = useState('0.00');
  const [operatingHours, setOperatingHours] = useState('0.00');
  const [idleHours, setIdleHours] = useState('0.00');
  const [fuelLiters, setFuelLiters] = useState('0.00');
  const [fuelCostPerLiter, setFuelCostPerLiter] = useState('185.00');
  const [activities, setActivities] = useState('');
  const [supervisorName, setSupervisorName] = useState('Eng. John Mwangi');

  const handleHoursChange = (open: string, close: string) => {
    setOpeningHours(open);
    setClosingHours(close);
    const o = parseFloat(open) || 0;
    const c = parseFloat(close) || 0;
    const diff = Math.max(0, c - o);
    setOperatingHours(diff.toFixed(2));
};

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      equipmentCode,
      name,
      equipmentType,
      ownershipType,
      ratePerUnitKes,
      rateUnit,
      registrationNo: registrationNo || null,
      supplierName: supplierName || null,
      currentHoursMeter,
};

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/equipment`, payload);
        await reload();
        setShowAddMachineModal(false);
        setEquipmentCode('');
        setName('');
        return;
} catch { /* fall through to local */}
}

    if (onCreateEquipment) {
      await onCreateEquipment(payload);
}

    const newItem: PlantEquipmentItem = {
      id: `eq-${Date.now()}`,
      equipmentCode,
      name,
      equipmentType,
      ownershipType,
      ratePerUnitKes,
      rateUnit,
      registrationNo: registrationNo || null,
      supplierName: supplierName || null,
      currentHoursMeter,
      status: 'OPERATIONAL',
      createdAt: new Date().toISOString(),
};

    setEquipmentList([...equipmentList, newItem]);
    setShowAddMachineModal(false);
    setEquipmentCode('');
    setName('');
};

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      equipmentId: selectedEquipmentId,
      logDate,
      operatorName,
      openingHoursMeter: openingHours,
      closingHoursMeter: closingHours,
      operatingHours,
      idleOrBreakdownHours: idleHours,
      fuelLitersIssued: fuelLiters,
      fuelCostPerLiterKes: fuelCostPerLiter,
      activitiesPerformed: activities,
      verifiedBySupervisor: supervisorName,
};

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/equipment-logs`, payload);
        await reload();
        setShowAddLogModal(false);
        return;
} catch { /* fall through to local */}
}

    if (onRecordLog) {
      await onRecordLog(payload);
}

    const oHours = parseFloat(operatingHours) || 0;
    const fLiters = parseFloat(fuelLiters) || 0;
    const fPrice = parseFloat(fuelCostPerLiter) || 185;
    const burn = oHours > 0 ? fLiters / oHours : 0;
    let status: 'NORMAL' | 'ELEVATED_BURN' | 'SUSPECTED_DISCREPANCY' | 'SUSPECTED_SIPHONING' = 'NORMAL';
    if ((oHours === 0 && fLiters > 0) || burn > 25.0) {
      status = 'SUSPECTED_DISCREPANCY';
} else if (burn > 18.0) {
      status = 'ELEVATED_BURN';
}

    const newLog: EquipmentDailyLogItem = {
      id: `log-${Date.now()}`,
      equipmentId: selectedEquipmentId,
      logDate: logDate || new Date().toISOString().slice(0, 10),
      operatorName,
      openingHoursMeter: openingHours,
      closingHoursMeter: closingHours,
      operatingHours,
      idleOrBreakdownHours: idleHours,
      fuelLitersIssued: fuelLiters,
      fuelCostPerLiterKes: fuelCostPerLiter,
      totalFuelCostKes: (fLiters * fPrice).toFixed(2),
      fuelBurnLitersPerHour: burn.toFixed(2),
      fuelEfficiencyStatus: status,
      activitiesPerformed: activities,
      verifiedBySupervisor: supervisorName,
};

    setLogsList([newLog, ...logsList]);
    setShowAddLogModal(false);
};

  const summary = (initialSummary && !isLive) ? initialSummary : {
    totalEquipment: equipmentList.length,
    operationalCount: equipmentList.filter((e) => e.status === 'OPERATIONAL').length,
    totalHoursLogged: equipmentList
      .reduce((sum, e) => sum + (parseFloat(e.currentHoursMeter) || 0), 0)
      .toFixed(2),
};

  const fuelDiscrepancyAlertCount = logsList.filter(
    (l) => l.fuelEfficiencyStatus === 'SUSPECTED_DISCREPANCY' || l.fuelEfficiencyStatus === 'SUSPECTED_SIPHONING'
).length;

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading plant equipment...</div>;
}

  return (
<div className="space-y-6">
      {/* Header & Benchmark Banner */}
<PlantHeaderControls
        projectName={projectName}
        onAddMachine={() => setShowAddMachineModal(true)}
        onAddLog={() => setShowAddLogModal(true)}
      />

      {/* Summary KPI Cards */}
<PlantKpiCards
        summary={summary}
        fuelDiscrepancyAlertCount={fuelDiscrepancyAlertCount}
      />

      {/* Tabs */}
<PlantTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        equipmentCount={equipmentList.length}
        logsCount={logsList.length}
      />

      {/* Tab 1: Machinery Fleet List */}
      {activeTab === 'MACHINERY' && (
<MachineryRegisterTable
          equipmentList={equipmentList}
          formatRatePerUnit={(rate) => parseFloat(rate).toLocaleString('en-KE', { minimumFractionDigits: 2})}
        />
)}

      {/* Tab 2: Fuel Utilization & Siphoning Audit */}
      {activeTab === 'FUEL_AUDIT' && (
<FuelAuditTable
          logsList={logsList}
          equipmentList={equipmentList}
          formatFuelCost={(cost) => parseFloat(cost).toLocaleString('en-KE')}
        />
)}

      {/* Modal: Register Machine */}
      {showAddMachineModal && (
<RegisterMachineModal
          onClose={() => setShowAddMachineModal(false)}
          onSubmit={handleCreateEquipment}
          equipmentCode={equipmentCode}
          setEquipmentCode={setEquipmentCode}
          name={name}
          setName={setName}
          equipmentType={equipmentType}
          setEquipmentType={setEquipmentType}
          ownershipType={ownershipType}
          setOwnershipType={setOwnershipType}
          ratePerUnitKes={ratePerUnitKes}
          setRatePerUnitKes={setRatePerUnitKes}
          rateUnit={rateUnit}
          setRateUnit={setRateUnit}
          registrationNo={registrationNo}
          setRegistrationNo={setRegistrationNo}
          supplierName={supplierName}
          setSupplierName={setSupplierName}
          currentHoursMeter={currentHoursMeter}
          setCurrentHoursMeter={setCurrentHoursMeter}
        />
)}

      {/* Modal: Daily Hours & Fuel Utilization Log */}
      {showAddLogModal && (
<EquipmentLogModal
          onClose={() => setShowAddLogModal(false)}
          onSubmit={handleCreateLog}
          equipmentList={equipmentList}
          selectedEquipmentId={selectedEquipmentId}
          setSelectedEquipmentId={setSelectedEquipmentId}
          logDate={logDate}
          setLogDate={setLogDate}
          operatorName={operatorName}
          setOperatorName={setOperatorName}
          openingHours={openingHours}
          closingHours={closingHours}
          operatingHours={operatingHours}
          onHoursChange={handleHoursChange}
          idleHours={idleHours}
          setIdleHours={setIdleHours}
          fuelLiters={fuelLiters}
          setFuelLiters={setFuelLiters}
          fuelCostPerLiter={fuelCostPerLiter}
          setFuelCostPerLiter={setFuelCostPerLiter}
          activities={activities}
          setActivities={setActivities}
          supervisorName={supervisorName}
          setSupervisorName={setSupervisorName}
        />
)}
</div>
);
};
