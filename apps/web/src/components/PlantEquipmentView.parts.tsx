import React from 'react';
import { statusLabel } from '../lib/status-labels';
import type {
  EquipmentDailyLogItem,
  PlantEquipmentItem,
  PlantEquipmentSummary,
} from './PlantEquipmentView';

export const PlantHeaderControls: React.FC<{
  projectName: string;
  onAddMachine: () => void;
  onAddLog: () => void;
}> = ({ projectName, onAddMachine, onAddLog }) => (
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
            onClick={onAddMachine}
            className="px-3 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Register Plant Machine
</button>
<button
            onClick={onAddLog}
            className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Log Daily Hours & Fuel
</button>
</div>
</div>
);

export const PlantKpiCards: React.FC<{
  summary: PlantEquipmentSummary;
  fuelDiscrepancyAlertCount: number;
}> = ({ summary, fuelDiscrepancyAlertCount }) => (
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
            Total Machinery Fleet
</span>
<p className="text-2xl font-bold text-gray-900 mt-1">
            {summary.totalEquipment} Units
</p>
<span className="text-xs text-indigo-700 font-medium">
            Excavators, Mixers, Cranes, Gensets
</span>
</div>

<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
            Operational Availability
</span>
<p className="text-2xl font-bold text-emerald-700 mt-1">
            {summary.operationalCount} / {summary.totalEquipment} Active
</p>
<span className="text-xs text-gray-500">
            {((summary.operationalCount / (summary.totalEquipment || 1)) * 100).toFixed(0)}% Fleet Uptime
</span>
</div>

<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
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
<span className="text-xs font-semibold text-gray-500 ">
            Fuel Discrepancy Risk Flags
</span>
<p
            className={`text-2xl font-bold mt-1 ${
              fuelDiscrepancyAlertCount > 0 ? 'text-red-700' : 'text-gray-900'
}`}
          >
            {fuelDiscrepancyAlertCount} Suspected
</p>
<span className="text-xs text-red-700 font-medium">
            Burn rate &gt; 25 L/hr or fuel without hours
</span>
</div>
</div>
);

export const PlantTabs: React.FC<{
  activeTab: 'MACHINERY' | 'FUEL_AUDIT';
  setActiveTab: React.Dispatch<React.SetStateAction<'MACHINERY' | 'FUEL_AUDIT'>>;
  equipmentCount: number;
  logsCount: number;
}> = ({ activeTab, setActiveTab, equipmentCount, logsCount }) => (
<div className="flex border-b border-gray-200 gap-6">
<button
          onClick={() => setActiveTab('MACHINERY')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'MACHINERY'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
}`}
        >
          Machinery Register ({equipmentCount})
</button>
<button
          onClick={() => setActiveTab('FUEL_AUDIT')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'FUEL_AUDIT'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
}`}
        >
          Daily Hours &amp; Fuel Siphoning Audit ({logsCount})
</button>
</div>
);

export const MachineryRegisterTable: React.FC<{
  equipmentList: PlantEquipmentItem[];
  formatRatePerUnit: (rateKes: string) => string;
}> = ({ equipmentList, formatRatePerUnit }) => (
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
<td className="px-4 py-3 tabular-nums font-medium text-gray-900">
                      KES {formatRatePerUnit(item.ratePerUnitKes)} / {item.rateUnit.replace('PER_', '').toLowerCase()}
</td>
<td className="px-4 py-3 text-gray-600 text-xs">
<div>{item.registrationNo || 'N/A'}</div>
<div className="text-gray-400">{item.supplierName || 'Self-Owned'}</div>
</td>
<td className="px-4 py-3 tabular-nums text-gray-900 font-bold">
                      {item.currentHoursMeter} hrs
</td>
<td className="px-4 py-3">
<span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {statusLabel(item.status)}
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);

export const FuelAuditTable: React.FC<{
  logsList: EquipmentDailyLogItem[];
  equipmentList: PlantEquipmentItem[];
  formatFuelCost: (costKes: string) => string;
}> = ({ logsList, equipmentList, formatFuelCost }) => (
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
<div className="text-xs text-gray-500 tabular-nums">
                          {machine?.equipmentCode}
</div>
</td>
<td className="px-4 py-3 text-gray-700 text-xs">
                        {log.operatorName}
</td>
<td className="px-4 py-3 tabular-nums text-gray-900">
<span className="font-bold">{log.operatingHours} hrs</span>
                        {parseFloat(log.idleOrBreakdownHours) > 0 && (
<span className="text-xs text-amber-700 block">
                            Idle: {log.idleOrBreakdownHours} hrs
</span>
)}
</td>
<td className="px-4 py-3 tabular-nums text-gray-900">
<div>{log.fuelLitersIssued} L</div>
<div className="text-xs text-gray-500">
                          KES {formatFuelCost(log.totalFuelCostKes)}
</div>
</td>
<td className="px-4 py-3 tabular-nums font-bold">
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
                             SUSPECTED DISCREPANCY
</div>
) : isElevated ? (
<div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                             ELEVATED BURN
</div>
) : (
<div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                             NORMAL CONSUMPTION
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
);

export const RegisterMachineModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  equipmentCode: string;
  setEquipmentCode: React.Dispatch<React.SetStateAction<string>>;
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  equipmentType: string;
  setEquipmentType: React.Dispatch<React.SetStateAction<string>>;
  ownershipType: 'OWNED' | 'HIRED_DRY' | 'HIRED_WET';
  setOwnershipType: React.Dispatch<React.SetStateAction<'OWNED' | 'HIRED_DRY' | 'HIRED_WET'>>;
  ratePerUnitKes: string;
  setRatePerUnitKes: React.Dispatch<React.SetStateAction<string>>;
  rateUnit: 'PER_HOUR' | 'PER_DAY' | 'PER_MONTH';
  setRateUnit: React.Dispatch<React.SetStateAction<'PER_HOUR' | 'PER_DAY' | 'PER_MONTH'>>;
  registrationNo: string;
  setRegistrationNo: React.Dispatch<React.SetStateAction<string>>;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  currentHoursMeter: string;
  setCurrentHoursMeter: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  equipmentCode,
  setEquipmentCode,
  name,
  setName,
  equipmentType,
  setEquipmentType,
  ownershipType,
  setOwnershipType,
  ratePerUnitKes,
  setRatePerUnitKes,
  rateUnit,
  setRateUnit,
  registrationNo,
  setRegistrationNo,
  supplierName,
  setSupplierName,
  currentHoursMeter,
  setCurrentHoursMeter,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">
                Register Heavy Plant / Machinery
</h3>
<button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4">
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
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
                  />
</div>
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-semibold rounded-lg"
                >
                  Save Equipment
</button>
</div>
</form>
</div>
</div>
);

export const EquipmentLogModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  equipmentList: PlantEquipmentItem[];
  selectedEquipmentId: string;
  setSelectedEquipmentId: React.Dispatch<React.SetStateAction<string>>;
  logDate: string | undefined;
  setLogDate: React.Dispatch<React.SetStateAction<string | undefined>>;
  operatorName: string;
  setOperatorName: React.Dispatch<React.SetStateAction<string>>;
  openingHours: string;
  closingHours: string;
  operatingHours: string;
  onHoursChange: (open: string, close: string) => void;
  idleHours: string;
  setIdleHours: React.Dispatch<React.SetStateAction<string>>;
  fuelLiters: string;
  setFuelLiters: React.Dispatch<React.SetStateAction<string>>;
  fuelCostPerLiter: string;
  setFuelCostPerLiter: React.Dispatch<React.SetStateAction<string>>;
  activities: string;
  setActivities: React.Dispatch<React.SetStateAction<string>>;
  supervisorName: string;
  setSupervisorName: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  equipmentList,
  selectedEquipmentId,
  setSelectedEquipmentId,
  logDate,
  setLogDate,
  operatorName,
  setOperatorName,
  openingHours,
  closingHours,
  operatingHours,
  onHoursChange,
  idleHours,
  setIdleHours,
  fuelLiters,
  setFuelLiters,
  fuelCostPerLiter,
  setFuelCostPerLiter,
  activities,
  setActivities,
  supervisorName,
  setSupervisorName,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">
                Log Equipment Hours &amp; Diesel Consumption
</h3>
<button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4">
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
                    onChange={(e) => onHoursChange(e.target.value, closingHours)}
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
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
                    onChange={(e) => onHoursChange(openingHours, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums bg-gray-50 font-bold"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
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
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-lg"
                >
                  Record Utilization &amp; Run Fuel Audit
</button>
</div>
</form>
</div>
</div>
);
