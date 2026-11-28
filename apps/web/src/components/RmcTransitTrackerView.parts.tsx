import React from 'react';
import { formatTime } from '../lib/format';
import type { RmcDeliveryRecord } from './RmcTransitTrackerView';

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

export const RmcHeaderControls: React.FC<{
  projectName: string;
  onAddTicket: () => void;
}> = ({ projectName, onAddTicket }) => (
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
            onClick={onAddTicket}
            className="inline-flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            + Log Batch Plant Ticket
</button>
</div>
</div>
);

export const RmcKpiCards: React.FC<{
  totalTrucks: number;
  inTransitCount: number;
  totalVolumeM3Text: string;
  rejectedCount: number;
}> = ({ totalTrucks, inTransitCount, totalVolumeM3Text, rejectedCount }) => (
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Total Truckloads</span>
<p className="text-2xl font-bold text-gray-900 mt-1">{totalTrucks}</p>
<span className="text-xs text-gray-400">Total: {totalVolumeM3Text} m³</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">In Transit</span>
<p className="text-2xl font-bold text-blue-700 mt-1">{inTransitCount}</p>
<span className="text-xs text-blue-700">Live Hydration Tracking</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Cold Joint Rejected</span>
<p className="text-2xl font-bold text-red-700 mt-1">{rejectedCount}</p>
<span className="text-xs text-red-700">&gt;120m transit or slump fail</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Slump Standard (BS EN 12350-2)</span>
<p className="text-2xl font-bold text-emerald-700 mt-1">±25 mm</p>
<span className="text-xs text-emerald-700">Allowable tolerance</span>
</div>
</div>
);

export const RmcFiltersBar: React.FC<{
  filterStatus: string;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}> = ({ filterStatus, setFilterStatus, searchQuery, setSearchQuery }) => (
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
);

export const RmcDeliveriesTable: React.FC<{
  filteredDeliveries: RmcDeliveryRecord[];
  onSlumpTest: (delivery: RmcDeliveryRecord) => void;
  onDischarge: (delivery: RmcDeliveryRecord) => void;
}> = ({ filteredDeliveries, onSlumpTest, onDischarge }) => (
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
<div className="text-xs text-blue-700 font-semibold">{delivery.concreteClass.replaceAll('_', ' ')} • {delivery.orderedVolumeM3} m³</div>
</td>
<td className="px-4 py-3">
<div className="text-gray-900 font-medium">{delivery.pourLocationElement}</div>
<div className="text-xs text-gray-500">Spec Slump: {delivery.slumpSpecifiedMm} mm</div>
</td>
<td className="px-4 py-3">
                        {getTransitBadge(elapsedMinutes)}
<div className="text-xs text-gray-400 mt-1">
                          Dispatched: {formatTime(new Date(delivery.dispatchedAt))}
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
<span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Pending Cone Test
</span>
)}
</td>
<td className="px-4 py-3">
                        {parseFloat(delivery.waterAddedOnSiteLiters) > 0 ? (
<span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-300">
                             +{delivery.waterAddedOnSiteLiters} L Tampered!
</span>
) : (
<span className="text-xs text-emerald-700 font-medium">0.00 L (Compliant)</span>
)}
</td>
<td className="px-4 py-3">{getStatusBadge(delivery.status)}</td>
<td className="px-4 py-3 text-right">
<div className="flex gap-2 justify-end">
<button
                            onClick={() => onSlumpTest(delivery)}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-300 transition"
                          >
                             Slump Test
</button>
<button
                            onClick={() => onDischarge(delivery)}
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
);

export const RegisterTicketModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  ticketNo: string;
  setTicketNo: React.Dispatch<React.SetStateAction<string>>;
  truckReg: string;
  setTruckReg: React.Dispatch<React.SetStateAction<string>>;
  supplierName: string;
  setSupplierName: React.Dispatch<React.SetStateAction<string>>;
  concreteClass: string;
  setConcreteClass: React.Dispatch<React.SetStateAction<string>>;
  orderedVolume: string;
  setOrderedVolume: React.Dispatch<React.SetStateAction<string>>;
  specifiedSlump: number;
  setSpecifiedSlump: React.Dispatch<React.SetStateAction<number>>;
  pourLocation: string;
  setPourLocation: React.Dispatch<React.SetStateAction<string>>;
  driverName: string;
  setDriverName: React.Dispatch<React.SetStateAction<string>>;
  driverPhone: string;
  setDriverPhone: React.Dispatch<React.SetStateAction<string>>;
  minutesAgo: number;
  setMinutesAgo: React.Dispatch<React.SetStateAction<number>>;
}> = ({
  onClose,
  onSubmit,
  ticketNo,
  setTicketNo,
  truckReg,
  setTruckReg,
  supplierName,
  setSupplierName,
  concreteClass,
  setConcreteClass,
  orderedVolume,
  setOrderedVolume,
  specifiedSlump,
  setSpecifiedSlump,
  pourLocation,
  setPourLocation,
  driverName,
  setDriverName,
  driverPhone,
  setDriverPhone,
  minutesAgo,
  setMinutesAgo,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">Log RMC Batch Delivery Ticket</h3>
<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4 text-sm">
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
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
</button>
<button type="submit" className="px-4 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800">
                  Save Ticket &amp; Start Transit
</button>
</div>
</form>
</div>
</div>
);

export const SlumpTestModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  delivery: RmcDeliveryRecord;
  measuredSlump: number;
  setMeasuredSlump: React.Dispatch<React.SetStateAction<number>>;
  concreteTemp: string;
  setConcreteTemp: React.Dispatch<React.SetStateAction<string>>;
  inspectorName: string;
  setInspectorName: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  delivery,
  measuredSlump,
  setMeasuredSlump,
  concreteTemp,
  setConcreteTemp,
  inspectorName,
  setInspectorName,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 className="text-lg font-bold text-gray-900">BS EN 12350-2 Slump Cone Test</h3>
<p className="text-xs text-gray-500">Ticket: {delivery.deliveryTicketNo} • Truck: {delivery.truckRegistrationNo}</p>
</div>
<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4 text-sm">
<div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs space-y-1">
<div><strong>Specified Mix Slump:</strong> {delivery.slumpSpecifiedMm} mm</div>
<div><strong>Allowable Tolerance:</strong> {delivery.slumpSpecifiedMm - 25} mm to {delivery.slumpSpecifiedMm + 25} mm (±25 mm)</div>
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
                  Deviation: {measuredSlump - delivery.slumpSpecifiedMm > 0 ? `+${measuredSlump - delivery.slumpSpecifiedMm}` : measuredSlump - delivery.slumpSpecifiedMm} mm •{' '}
                  {Math.abs(measuredSlump - delivery.slumpSpecifiedMm)<= 25 ? (
<span className="text-emerald-700 font-bold"> PASS (Within ±25 mm tolerance)</span>
) : (
<span className="text-red-700 font-bold"> FAIL (Exceeds allowable tolerance)</span>
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
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
</button>
<button type="submit" className="px-4 py-2 bg-emerald-700 text-white font-medium rounded-lg hover:bg-emerald-800">
                  Save Slump Test Verdict
</button>
</div>
</form>
</div>
</div>
);

export const DischargeUpdateModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  delivery: RmcDeliveryRecord;
  dischargeStatus: 'POURING' | 'COMPLETED' | 'REJECTED_COLD_JOINT_RISK';
  setDischargeStatus: React.Dispatch<React.SetStateAction<'POURING' | 'COMPLETED' | 'REJECTED_COLD_JOINT_RISK'>>;
  waterTamperLiters: string;
  setWaterTamperLiters: React.Dispatch<React.SetStateAction<string>>;
  rejectionNotes: string;
  setRejectionNotes: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  delivery,
  dischargeStatus,
  setDischargeStatus,
  waterTamperLiters,
  setWaterTamperLiters,
  rejectionNotes,
  setRejectionNotes,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
<div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 className="text-lg font-bold text-gray-900">Update Discharge &amp; Quality Audit</h3>
<p className="text-xs text-gray-500">Ticket: {delivery.deliveryTicketNo}</p>
</div>
<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
                
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4 text-sm">
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
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
</button>
<button type="submit" className="px-4 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800">
                  Save Discharge Record
</button>
</div>
</form>
</div>
</div>
);
