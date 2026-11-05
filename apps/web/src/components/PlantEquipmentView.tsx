import React, { useState } from 'react';

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
  projectId: _projectId,
  projectName = 'Current Project',
  equipment: initialEquipment,
  logs: initialLogs,
  summary: initialSummary,
  userRole: _userRole = 'SITE_SUPERVISOR',
  onCreateEquipment,
  onRecordLog,
}) => {
  const [equipmentList, setEquipmentList] = useState<PlantEquipmentItem[]>(
    initialEquipment || [
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
    ]
  );

  const [logsList, setLogsList] = useState<EquipmentDailyLogItem[]>(
    initialLogs || [
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
    ]
  );

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

  const summary = initialSummary || {
    totalEquipment: equipmentList.length,
    operationalCount: equipmentList.filter((e) => e.status === 'OPERATIONAL').length,
    totalHoursLogged: equipmentList
      .reduce((sum, e) => sum + (parseFloat(e.currentHoursMeter) || 0), 0)
      .toFixed(2),
  };

  const fuelDiscrepancyAlertCount = logsList.filter(
    (l) => l.fuelEfficiencyStatus === 'SUSPECTED_DISCREPANCY' || l.fuelEfficiencyStatus === 'SUSPECTED_SIPHONING'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header & Benchmark Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Plant & Heavy Equipment Manager
          </h2>
          <p className="text-sm text-gray-500">
            {projectName} • Machinery registry, daily hours meter, and automated fuel reconciliation audit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddMachineModal(true)}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Register Plant Machine
          </button>
          <button
            onClick={() => setShowAddLogModal(true)}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Log Daily Hours & Fuel
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Machinery Fleet
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {summary.totalEquipment} Units
          </p>
          <span className="text-xs text-indigo-600 font-medium">
            Excavators, Mixers, Cranes, Gensets
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Operational Availability
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {summary.operationalCount} / {summary.totalEquipment} Active
          </p>
          <span className="text-xs text-gray-500">
            {((summary.operationalCount / (summary.totalEquipment || 1)) * 100).toFixed(0)}% Fleet Uptime
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Cumulative Operating Hours
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {summary.totalHoursLogged} Hrs
          </p>
          <span className="text-xs text-gray-500">Across site lifecycle</span>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-sm ${
            fuelDiscrepancyAlertCount > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-200'
          }`}
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Fuel Discrepancy Risk Flags
          </span>
          <p
            className={`text-2xl font-bold mt-1 ${
              fuelDiscrepancyAlertCount > 0 ? 'text-red-700' : 'text-gray-900'
            }`}
          >
            {fuelDiscrepancyAlertCount} Suspected
          </p>
          <span className="text-xs text-red-600 font-medium">
            Burn rate &gt; 25 L/hr or fuel without hours
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab('MACHINERY')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'MACHINERY'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Machinery Register ({equipmentList.length})
        </button>
        <button
          onClick={() => setActiveTab('FUEL_AUDIT')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'FUEL_AUDIT'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Daily Hours &amp; Fuel Siphoning Audit ({logsList.length})
        </button>
      </div>

      {/* Tab 1: Machinery Fleet List */}
      {activeTab === 'MACHINERY' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-4 py-3">Code / Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Ownership</th>
                  <th className="px-4 py-3">Rate (KES)</th>
                  <th className="px-4 py-3">Reg No / Supplier</th>
                  <th className="px-4 py-3">Meter (Hrs)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {equipmentList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{item.name}</div>
                      <div className="text-xs text-gray-500">{item.equipmentCode}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {item.equipmentType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {item.ownershipType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      KES {parseFloat(item.ratePerUnitKes).toLocaleString('en-KE', { minimumFractionDigits: 2 })} / {item.rateUnit.replace('PER_', '').toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div>{item.registrationNo || 'N/A'}</div>
                      <div className="text-gray-400">{item.supplierName || 'Self-Owned'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-900 font-bold">
                      {item.currentHoursMeter} hrs
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Fuel Utilization & Siphoning Audit */}
      {activeTab === 'FUEL_AUDIT' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3">Operating / Idle Hrs</th>
                  <th className="px-4 py-3">Fuel Issued</th>
                  <th className="px-4 py-3">Burn Rate (L/hr)</th>
                  <th className="px-4 py-3">Efficiency / Variance Audit</th>
                  <th className="px-4 py-3">Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logsList.map((log) => {
                  const machine = equipmentList.find((e) => e.id === log.equipmentId);
                  const isSiphon = log.fuelEfficiencyStatus === 'SUSPECTED_DISCREPANCY' || log.fuelEfficiencyStatus === 'SUSPECTED_SIPHONING';
                  const isElevated = log.fuelEfficiencyStatus === 'ELEVATED_BURN';

                  return (
                    <tr
                      key={log.id}
                      className={
                        isSiphon
                          ? 'bg-red-50 hover:bg-red-100 transition'
                          : isElevated
                          ? 'bg-amber-50 hover:bg-amber-100 transition'
                          : 'hover:bg-gray-50 transition'
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {log.logDate}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {machine?.name || 'Heavy Equipment'}
                        <div className="text-xs text-gray-500 font-mono">
                          {machine?.equipmentCode}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        {log.operatorName}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-900">
                        <span className="font-bold">{log.operatingHours} hrs</span>
                        {parseFloat(log.idleOrBreakdownHours) > 0 && (
                          <span className="text-xs text-amber-600 block">
                            Idle: {log.idleOrBreakdownHours} hrs
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-900">
                        <div>{log.fuelLitersIssued} L</div>
                        <div className="text-xs text-gray-500">
                          KES {parseFloat(log.totalFuelCostKes).toLocaleString('en-KE')}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        <span
                          className={
                            isSiphon
                              ? 'text-red-700 text-base'
                              : isElevated
                              ? 'text-amber-700'
                              : 'text-gray-900'
                          }
                        >
                          {log.fuelBurnLitersPerHour} L/hr
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSiphon ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-200 text-red-900 border border-red-300">
                            ⚠️ SUSPECTED DISCREPANCY
                          </div>
                        ) : isElevated ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                            ⚡ ELEVATED BURN
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            ✓ NORMAL CONSUMPTION
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.verifiedBySupervisor}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Register Machine */}
      {showAddMachineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Register Heavy Plant / Machinery
              </h3>
              <button
                onClick={() => setShowAddMachineModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Equipment Code
                  </label>
                  <input
                    type="text"
                    required
                    value={equipmentCode}
                    onChange={(e) => setEquipmentCode(e.target.value)}
                    placeholder="e.g. EXC-002"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Equipment Type
                  </label>
                  <select
                    value={equipmentType}
                    onChange={(e) => setEquipmentType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="EXCAVATOR">Excavator</option>
                    <option value="CONCRETE_MIXER">Concrete Mixer</option>
                    <option value="TOWER_CRANE">Tower Crane</option>
                    <option value="TIPPER_TRUCK">Tipper Truck</option>
                    <option value="GENERATOR">Generator</option>
                    <option value="WATER_BOWSER">Water Bowser</option>
                    <option value="COMPACTOR_ROLLER">Compactor Roller</option>
                    <option value="VIBRATOR_POKER">Vibrator Poker</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Machine Description / Make &amp; Model
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CAT 320D Hydraulic Excavator"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ownership Type
                  </label>
                  <select
                    value={ownershipType}
                    onChange={(e) => setOwnershipType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="OWNED">Self Owned</option>
                    <option value="HIRED_DRY">Hired (Dry - Fuel By Us)</option>
                    <option value="HIRED_WET">Hired (Wet - Fuel Included)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Registration No / Plate
                  </label>
                  <input
                    type="text"
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value)}
                    placeholder="e.g. KDF 819B"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rental Rate (KES)
                  </label>
                  <input
                    type="text"
                    required
                    value={ratePerUnitKes}
                    onChange={(e) => setRatePerUnitKes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rate Frequency
                  </label>
                  <select
                    value={rateUnit}
                    onChange={(e) => setRateUnit(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="PER_HOUR">Per Operating Hour</option>
                    <option value="PER_DAY">Per Day (8 Hrs)</option>
                    <option value="PER_MONTH">Per Month</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Plant Supplier / Lessor
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Simba Plant Hire Ltd"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Current Hours Meter
                  </label>
                  <input
                    type="text"
                    value={currentHoursMeter}
                    onChange={(e) => setCurrentHoursMeter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddMachineModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
                >
                  Save Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Daily Hours & Fuel Utilization Log */}
      {showAddLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Log Equipment Hours &amp; Diesel Consumption
              </h3>
              <button
                onClick={() => setShowAddLogModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select Equipment
                  </label>
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.equipmentCode} - {eq.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Log Date
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Operator Name
                </label>
                <input
                  type="text"
                  required
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. Peter Kamau Mwangi"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Opening Meter
                  </label>
                  <input
                    type="text"
                    required
                    value={openingHours}
                    onChange={(e) => handleHoursChange(e.target.value, closingHours)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Closing Meter
                  </label>
                  <input
                    type="text"
                    required
                    value={closingHours}
                    onChange={(e) => handleHoursChange(openingHours, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={operatingHours}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono bg-gray-50 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Idle / Breakdown (Hrs)
                  </label>
                  <input
                    type="text"
                    value={idleHours}
                    onChange={(e) => setIdleHours(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Diesel Issued (Litres)
                  </label>
                  <input
                    type="text"
                    required
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Fuel Price / Litre (KES)
                  </label>
                  <input
                    type="text"
                    required
                    value={fuelCostPerLiter}
                    onChange={(e) => setFuelCostPerLiter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Site Activities Performed
                </label>
                <input
                  type="text"
                  value={activities}
                  onChange={(e) => setActivities(e.target.value)}
                  placeholder="e.g. Basement raft foundation digging"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Verified by Supervisor
                </label>
                <input
                  type="text"
                  required
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddLogModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg"
                >
                  Record Utilization &amp; Run Fuel Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
