import React from 'react';
import { statusLabel } from '../lib/status-labels';
import { formatTime } from '../lib/format';
import type {
  PlantMaintenanceAlertItem,
  TelematicsDeviceItem,
  TelematicsPingItem,
} from './PlantTelematicsView';

export const TelematicsHeaderBanner: React.FC<{
  projectName: string;
  onOpenRegisterModal: () => void;
}> = ({ projectName, onOpenRegisterModal }) => (
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div>
<div className="flex items-center gap-3">
<h2 className="text-xl font-bold text-slate-800">Plant GPS Telematics &amp; Remote Fuel Flow Ingestion</h2>
<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              IOT ACTIVE
</span>
</div>
<p className="text-sm text-slate-500 mt-1">
            Site: {projectName} | Direct CANBUS / OBD2 / Modbus Telemetry &amp; Diesel Siphoning Anomaly Detection (M24 &amp; M32)
</p>
</div>
<div className="flex gap-2">
<button
            onClick={onOpenRegisterModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
<span>Register Telematics Hardware</span>
</button>
</div>
</div>
);

export const SiphoningAlertBanner: React.FC<{ count: number }> = ({ count }) => (
<div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 shadow-sm flex items-start gap-4">
<div className="p-2 bg-rose-100 rounded-lg text-rose-700 font-bold text-xl"></div>
<div className="flex-1">
<h4 className="font-bold text-rose-900 text-sm">
              Critical Fuel Discrepancy Flagged ({count} Incident Detected)
</h4>
<p className="text-xs text-rose-800 mt-1">
              Sudden diesel volume drop &gt;30 Liters detected while machinery engine was STOPPED/IDLE. Automatic WhatsApp safety alerts dispatched to site supervisor and plant engineering personnel.
</p>
</div>
</div>
);

export const FleetOverviewCards: React.FC<{
  devices: TelematicsDeviceItem[];
  pings: TelematicsPingItem[];
  activeSiphoningPings: TelematicsPingItem[];
}> = ({ devices, pings, activeSiphoningPings }) => (
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Active Devices</p>
<p className="text-xl font-bold text-slate-800 mt-1">{devices.length} IoT Units</p>
<p className="text-xs text-emerald-700 mt-1">All units reporting online</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Total Pings Received</p>
<p className="text-xl font-bold text-slate-800 mt-1">{pings.length}</p>
<p className="text-xs text-slate-600 mt-1">Live telemetry stream</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Monitored Fuel Volume</p>
<p className="text-xl font-bold text-slate-800 mt-1">650.00 L</p>
<p className="text-xs text-slate-500 mt-1">Total calibrated capacity</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-rose-700 ">Fuel Discrepancies</p>
<p className="text-xl font-bold text-rose-700 mt-1">{activeSiphoningPings.length}</p>
<p className="text-xs text-rose-700 mt-1">&gt;30L sudden drop events</p>
</div>
</div>
);

export const CanBusDiagnosticsDashboard: React.FC<{
  devices: TelematicsDeviceItem[];
  selectedImei: string;
  onSelectedImeiChange: (imei: string) => void;
  latestPing: TelematicsPingItem | undefined;
  coolantNum: number;
  isOverheatFatal: boolean;
  isOverheatWarning: boolean;
}> = ({ devices, selectedImei, onSelectedImeiChange, latestPing, coolantNum, isOverheatFatal, isOverheatWarning }) => (
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
<div>
<h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
<span>CAN-bus Live Diagnostics Dashboard</span>
<span className="px-2 py-0.5 rounded text-[11px] tabular-nums bg-blue-100 text-blue-800 border border-blue-200">
                J1939 / OBD-II
</span>
</h3>
<p className="text-xs text-slate-500 mt-0.5">
              Real-time ECU parameter identification (PID) stream &amp; thermal overheat surveillance
</p>
</div>
<div className="flex items-center gap-2">
<span className="text-xs font-medium text-slate-500">Machinery Unit:</span>
<select
              value={selectedImei}
              onChange={(e) => onSelectedImeiChange(e.target.value)}
              className="text-xs font-semibold p-1.5 rounded-lg border border-slate-300 bg-white text-slate-800"
            >
              {devices.map((d) => (
<option key={d.id} value={d.deviceImei}>
                  {d.equipmentCode} • {d.equipmentName}
</option>
))}
</select>
</div>
</div>

        {/* Diagnostic Gauges Grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Gauge 1: Coolant Temperature Dial/Meter */}
<div className={`p-4 rounded-xl border transition-all ${
            isOverheatFatal
              ? 'bg-rose-50 border-rose-400 text-rose-900'
              : isOverheatWarning
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-800'
}`}>
<div className="flex justify-between items-center mb-1">
<span className="text-[11px] font-bold text-slate-500">Coolant Temp (PID 0x05)</span>
<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isOverheatFatal
                  ? 'bg-rose-700 text-white animate-pulse'
                  : isOverheatWarning
                  ? 'bg-amber-700 text-white'
                  : 'bg-emerald-100 text-emerald-800'
}`}>
                {isOverheatFatal ? 'FATAL SHUTDOWN' : isOverheatWarning ? 'WARNING' : 'NORMAL'}
</span>
</div>
<div className="text-2xl tabular-nums font-extrabold mt-1">
              {latestPing?.coolantTempC || '92.4'}°C
</div>
            {/* Overheat Threshold Indicator */}
<div className="mt-2 text-[10px] space-y-1">
<div className="flex justify-between text-slate-500 tabular-nums">
<span>Safe &lt;103°C</span>
<span className="text-amber-700 font-bold">Warn 103°C</span>
<span className="text-rose-700 font-bold">Limit 108°C</span>
</div>
<div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
<div
                  className={`h-1.5 rounded-full ${
                    isOverheatFatal ? 'bg-rose-700' : isOverheatWarning ? 'bg-amber-700' : 'bg-emerald-700'
}`}
                  style={{ width: `${Math.min(100, Math.max(10, ((coolantNum) / 120) * 100))}%`}}
                />
</div>
<div className="text-[10px] text-slate-500 font-medium pt-0.5">
                Overheat threshold indicator: {isOverheatFatal ? 'Critical >108°C Exceeded!' : isOverheatWarning ? 'High >103°C' : 'Within normal limits'}
</div>
</div>
</div>

          {/* Gauge 2: Oil Temperature */}
<div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
<div className="flex justify-between items-center mb-1">
<span className="text-[11px] font-bold text-slate-500">Engine Oil Temp</span>
<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">PID 0x5C</span>
</div>
<div className="text-2xl tabular-nums font-extrabold text-slate-800 mt-1">
              {latestPing?.oilTempC || '98.5'}°C
</div>
<p className="text-[10px] text-slate-500 mt-2">Lubrication envelope: &lt;120.0°C</p>
</div>

          {/* Gauge 3: Engine RPM */}
<div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
<div className="flex justify-between items-center mb-1">
<span className="text-[11px] font-bold text-slate-500">Engine Speed</span>
<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">PID 0x0C</span>
</div>
<div className="text-2xl tabular-nums font-extrabold text-slate-800 mt-1">
              {latestPing?.engineRpm || (latestPing?.engineStatus === 'STOPPED' ? 0 : 1850)} RPM
</div>
<p className="text-[10px] text-slate-500 mt-2">Operating range: 800 - 2,200 RPM</p>
</div>

          {/* Gauge 4: Battery Voltage */}
<div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
<div className="flex justify-between items-center mb-1">
<span className="text-[11px] font-bold text-slate-500">Battery Voltage</span>
<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">24V System</span>
</div>
<div className="text-2xl tabular-nums font-extrabold text-slate-800 mt-1">
              {latestPing?.batteryVoltage || '24.20'} V
</div>
<p className="text-[10px] text-slate-500 mt-2">Alternator charging: 23.5V - 28.5V</p>
</div>

          {/* Gauge 5: ECU DTC Active Codes Badge */}
<div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
<div className="flex justify-between items-center mb-1">
<span className="text-[11px] font-bold text-slate-500">ECU DTC Codes</span>
<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">OBD-II Faults</span>
</div>
<div className="mt-1">
              {latestPing?.dtcFaultCodes ? (
<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-300 tabular-nums text-xs font-bold">
<span></span>
<span>{latestPing.dtcFaultCodes}</span>
</div>
) : (
<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold">
<span></span>
<span>No Active DTCs</span>
</div>
)}
</div>
<p className="text-[10px] text-slate-500 mt-2">SAE J1939 Diagnostic Trouble Codes</p>
</div>
</div>
</div>
);

export const SiphoningIncidentFeed: React.FC<{ events: TelematicsPingItem[] }> = ({ events }) => (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
<div className="p-4 border-b border-slate-200 flex justify-between items-center">
<div>
<h3 className="font-bold text-slate-800 text-sm">Fuel Discrepancy Anomaly Incident Feed</h3>
<p className="text-xs text-slate-500">Deep telemetry fuel drain rate analysis and anomaly variance detection</p>
</div>
<span className="text-xs font-semibold px-2 py-1 bg-rose-100 text-rose-800 rounded border border-rose-200">
            {events.length} Anomaly Events
</span>
</div>

<div className="overflow-x-auto">
<table className="w-full text-left text-xs text-slate-600">
<thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
<tr>
<th className="p-3">Severity</th>
<th className="p-3">Equipment</th>
<th className="p-3">Engine Status</th>
<th className="p-3">Fuel Drop Volume</th>
<th className="p-3">Drop Rate (L/h)</th>
<th className="p-3">Anomaly Classification</th>
<th className="p-3">Incident Time</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {events.length === 0 ? (
<tr>
<td colSpan={7} className="p-4 text-center text-slate-600">
                    No fuel discrepancies detected. Machinery fuel consumption operating normally.
</td>
</tr>
) : (
                events.map((evt) => (
<tr key={evt.id} className="hover:bg-slate-50 transition-colors">
<td className="p-3">
<span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          evt.anomalySeverity === 'CRITICAL' || evt.isSiphoningEvent
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : evt.anomalySeverity === 'HIGH'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
}`}
                      >
                        {evt.anomalySeverity || (evt.isSiphoningEvent ? 'CRITICAL' : 'NORMAL')}
</span>
</td>
<td className="p-3 font-medium text-slate-800">
<div>{evt.equipmentName}</div>
<div className="text-[10px] tabular-nums text-slate-600">{evt.equipmentCode}</div>
</td>
<td className="p-3">
<span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.engineStatus === 'RUNNING'
                            ? 'bg-emerald-100 text-emerald-800'
                            : evt.engineStatus === 'IDLE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
}`}
                      >
                        {evt.engineStatus}
</span>
</td>
<td className="p-3 tabular-nums font-bold text-rose-700">
                      -{evt.fuelDropLiters || '40.00'} Liters
</td>
<td className="p-3 tabular-nums font-semibold text-slate-800">
                      {evt.dropRateLPerHour || '480.00'} L/h
</td>
<td className="p-3">
                      {evt.isSiphoningEvent ? (
<span className="font-semibold text-rose-700">Rapid Fuel Level Drop Event</span>
) : (
<span className="text-slate-600">Monitored Fuel Drop</span>
)}
</td>
<td className="p-3 text-slate-600">
                      {formatTime(new Date(evt.pingTimestamp))}
</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>
);

export const MaintenanceAlertsFeed: React.FC<{
  alerts: PlantMaintenanceAlertItem[];
  onAcknowledge: (alert: PlantMaintenanceAlertItem) => void;
}> = ({ alerts, onAcknowledge }) => (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
<div className="p-4 border-b border-slate-200 flex justify-between items-center">
<div>
<h3 className="font-bold text-slate-800 text-sm">Plant Maintenance &amp; Predictive Alerts Feed</h3>
<p className="text-xs text-slate-500">CAN-bus thermal violations, ECU DTC trouble codes, and theft alerts</p>
</div>
<span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-800 rounded border border-amber-200">
            {alerts.filter((a) => a.status === 'ACTIVE').length} Active Alerts
</span>
</div>

<div className="divide-y divide-slate-100">
          {alerts.length === 0 ? (
<div className="p-6 text-center text-slate-600 text-xs">
              No active or acknowledged maintenance alerts. Machinery in good mechanical condition.
</div>
) : (
            alerts.map((alert) => (
<div key={alert.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
<div className="space-y-1">
<div className="flex items-center gap-2">
<span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        alert.severity === 'FATAL_SHUTDOWN' || alert.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : alert.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
}`}
                    >
                      {alert.severity}
</span>
<span className="tabular-nums text-xs font-bold text-slate-700">{alert.alertCode}</span>
<span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        alert.status === 'ACTIVE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}`}
                    >
                      {statusLabel(alert.status)}
</span>
</div>
<h4 className="font-bold text-slate-900 text-sm">{alert.title}</h4>
<p className="text-xs text-slate-600">{alert.description}</p>
                  {alert.recommendedAction && (
<p className="text-xs text-slate-500 italic">
                      Recommended: {alert.recommendedAction}
</p>
)}
                  {alert.status === 'ACKNOWLEDGED' && alert.acknowledgedBy && (
<p className="text-[11px] text-emerald-700 font-medium">
                       Acknowledged by {alert.acknowledgedBy} at{' '}
                      {alert.acknowledgedAt ? formatTime(new Date(alert.acknowledgedAt)) : 'recently'}
</p>
)}
</div>

<div>
                  {alert.status === 'ACTIVE' ? (
<button
                      onClick={() => onAcknowledge(alert)}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-sm whitespace-nowrap"
                    >
                      Acknowledge Alert
</button>
) : (
<span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold whitespace-nowrap">
                      Acknowledged
</span>
)}
</div>
</div>
))
)}
</div>
</div>
);

export const TelematicsSimulatorSection: React.FC<{
  feedback: string | null;
  onSimulateSiphoning: () => void;
  onSubmit: (e: React.FormEvent) => void;
  devices: TelematicsDeviceItem[];
  selectedImei: string;
  setSelectedImei: React.Dispatch<React.SetStateAction<string>>;
  simEngineStatus: 'RUNNING' | 'IDLE' | 'STOPPED';
  setSimEngineStatus: React.Dispatch<React.SetStateAction<'RUNNING' | 'IDLE' | 'STOPPED'>>;
  simRpm: string;
  setSimRpm: React.Dispatch<React.SetStateAction<string>>;
  simFuelPct: string;
  setSimFuelPct: React.Dispatch<React.SetStateAction<string>>;
  simCoolant: string;
  setSimCoolant: React.Dispatch<React.SetStateAction<string>>;
  simOil: string;
  setSimOil: React.Dispatch<React.SetStateAction<string>>;
  simVoltage: string;
  setSimVoltage: React.Dispatch<React.SetStateAction<string>>;
  simDtc: string;
  setSimDtc: React.Dispatch<React.SetStateAction<string>>;
  isSubmitting: boolean;
  fuelLitersText: string;
  tankCap: number;
}> = ({
  feedback,
  onSimulateSiphoning,
  onSubmit,
  devices,
  selectedImei,
  setSelectedImei,
  simEngineStatus,
  setSimEngineStatus,
  simRpm,
  setSimRpm,
  simFuelPct,
  setSimFuelPct,
  simCoolant,
  setSimCoolant,
  simOil,
  setSimOil,
  simVoltage,
  setSimVoltage,
  simDtc,
  setSimDtc,
  isSubmitting,
  fuelLitersText,
  tankCap,
}) => (
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="border-b border-slate-100 pb-3 flex justify-between items-center">
<div>
<h3 className="font-bold text-slate-800 text-sm">Remote Telematics &amp; Flow Meter Ingestion Simulator</h3>
<p className="text-xs text-slate-500">
              Simulate MQTT / CANBUS payload ingestion from remote plant machinery modems
</p>
</div>
<button
            type="button"
            onClick={onSimulateSiphoning}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-sm"
          >
            Simulate 40L Rapid Fuel Drop
</button>
</div>

        {feedback && (
<div
            className={`p-3 rounded-lg text-xs font-medium border ${
              feedback.includes('CRITICAL') ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
}`}
          >
            {feedback}
</div>
)}

<form onSubmit={onSubmit} className="space-y-4 text-xs">
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div>
<label className="block font-semibold text-slate-700 mb-1">Target Machinery / IMEI</label>
<select
                value={selectedImei}
                onChange={(e) => setSelectedImei(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {devices.map((d) => (
<option key={d.id} value={d.deviceImei}>
                    {d.equipmentCode} - {d.equipmentName} ({d.protocol})
</option>
))}
</select>
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">Engine Operational Status</label>
<select
                value={simEngineStatus}
                onChange={(e) => setSimEngineStatus(e.target.value as any)}
                className="w-full p-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
<option value="RUNNING">RUNNING (Working under load)</option>
<option value="IDLE">IDLE (Engine idling)</option>
<option value="STOPPED">STOPPED (Engine shut down)</option>
</select>
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">Engine RPM</label>
<input
                type="number"
                value={simEngineStatus === 'STOPPED' ? 0 : simRpm}
                onChange={(e) => setSimRpm(e.target.value)}
                disabled={simEngineStatus === 'STOPPED'}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums text-slate-800 disabled:bg-slate-100"
                required
              />
</div>

<div>
<label className="block font-semibold text-slate-700 mb-1">Fuel Tank Level (%)</label>
<input
                type="text"
                value={simFuelPct}
                onChange={(e) => setSimFuelPct(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums text-slate-800"
                required
              />
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div>
<label className="block font-semibold text-slate-700 mb-1">Coolant Temp (°C)</label>
<input
                type="text"
                value={simCoolant}
                onChange={(e) => setSimCoolant(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums text-slate-800"
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Oil Temp (°C)</label>
<input
                type="text"
                value={simOil}
                onChange={(e) => setSimOil(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums text-slate-800"
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Supply Battery (V)</label>
<input
                type="text"
                value={simVoltage}
                onChange={(e) => setSimVoltage(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums text-slate-800"
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">ECU DTC Codes (optional)</label>
<input
                type="text"
                placeholder="e.g. P0115, P0217"
                value={simDtc}
                onChange={(e) => setSimDtc(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 tabular-nums text-slate-800"
              />
</div>
</div>

<div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
<div>
<span className="text-slate-600 font-medium">Calibrated Fuel Volume in Tank:</span>
<span className="tabular-nums font-bold text-slate-900">{fuelLitersText} Liters</span>
<span className="text-slate-600"> (Capacity: {tankCap} L)</span>
</div>
<button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-sm"
            >
              {isSubmitting ? 'Ingesting...' : 'Ingest Telematics Ping'}
</button>
</div>
</form>
</div>
);

export const PingsLedger: React.FC<{ pings: TelematicsPingItem[] }> = ({ pings }) => (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
<div className="p-4 border-b border-slate-200 flex justify-between items-center">
<div>
<h3 className="font-bold text-slate-800 text-sm">Machinery IoT Telemetry Feed &amp; Fuel Flow Log</h3>
<p className="text-xs text-slate-500">Live ping stream with automatic diesel siphoning analysis</p>
</div>
<span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded">
            {pings.length} Pings Logged
</span>
</div>

<div className="overflow-x-auto">
<table className="w-full text-left text-xs text-slate-600">
<thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
<tr>
<th className="p-3">Equipment</th>
<th className="p-3">Device IMEI</th>
<th className="p-3">Engine Status</th>
<th className="p-3">Fuel Level (%)</th>
<th className="p-3">Fuel Volume (L)</th>
<th className="p-3">Burn / Theft Analysis</th>
<th className="p-3">Ping Timestamp</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {pings.map((p) => (
<tr key={p.id} className="hover:bg-slate-50 transition-colors">
<td className="p-3 font-medium text-slate-800">
<div>{p.equipmentName}</div>
<div className="text-[10px] font-mono tabular-nums text-slate-600">{p.equipmentCode}</div>
</td>
<td className="p-3 tabular-nums text-slate-700">{p.deviceImei}</td>
<td className="p-3">
<span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.engineStatus === 'RUNNING'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.engineStatus === 'IDLE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
}`}
                    >
                      {p.engineStatus}
</span>
</td>
<td className="p-3 tabular-nums font-bold text-slate-800">{p.fuelLevelPercent}%</td>
<td className="p-3 tabular-nums font-bold text-slate-900">{p.calculatedFuelLiters} L</td>
<td className="p-3">
                    {p.isSiphoningEvent ? (
<span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        DIESEL DISCREPANCY FLAG
</span>
) : (
<span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        NORMAL BURN
</span>
)}
</td>
<td className="p-3 text-slate-600">{formatTime(new Date(p.pingTimestamp))}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
