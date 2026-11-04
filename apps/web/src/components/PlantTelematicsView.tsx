import React, { useState } from 'react';

export interface TelematicsDeviceItem {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  deviceImei: string;
  protocol: 'OBD2' | 'CANBUS' | 'GPS_MODEM' | 'MODBUS_FLOW';
  calibrationTankCapacityLiters: string;
  simPhoneNumber?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'TAMPERED';
  lastHeartbeatAt?: string;
}

export interface TelematicsPingItem {
  id: string;
  equipmentCode: string;
  equipmentName: string;
  deviceImei: string;
  latitude: string;
  longitude: string;
  engineStatus: 'RUNNING' | 'IDLE' | 'STOPPED';
  fuelLevelPercent: string;
  calculatedFuelLiters: string;
  isSiphoningEvent: boolean;
  pingTimestamp: string;
}

interface PlantTelematicsViewProps {
  projectId?: string;
  projectName?: string;
  devices?: TelematicsDeviceItem[];
  pings?: TelematicsPingItem[];
  onRegisterDevice?: (data: any) => Promise<any>;
  onIngestPing?: (data: any) => Promise<any>;
}

export const PlantTelematicsView: React.FC<PlantTelematicsViewProps> = ({
  projectName = 'Upper Hill Commercial Tower',
  devices: initialDevices,
  pings: initialPings,
  onRegisterDevice,
  onIngestPing,
}) => {
  const [devices, setDevices] = useState<TelematicsDeviceItem[]>(
    initialDevices || [
      {
        id: 'dev-001',
        equipmentId: 'eq-001',
        equipmentCode: 'EXC-001',
        equipmentName: 'CAT 320D Hydraulic Excavator',
        deviceImei: '869012059918234',
        protocol: 'CANBUS',
        calibrationTankCapacityLiters: '400.00',
        simPhoneNumber: '+254711998877',
        status: 'ONLINE',
        lastHeartbeatAt: new Date().toISOString(),
      },
      {
        id: 'dev-002',
        equipmentId: 'eq-002',
        equipmentCode: 'CRN-001',
        equipmentName: 'Liebherr 71K Tower Crane',
        deviceImei: '869012058827361',
        protocol: 'GPS_MODEM',
        calibrationTankCapacityLiters: '250.00',
        status: 'ONLINE',
        lastHeartbeatAt: new Date(Date.now() - 300000).toISOString(),
      },
    ]
  );

  const [pings, setPings] = useState<TelematicsPingItem[]>(
    initialPings || [
      {
        id: 'png-01',
        equipmentCode: 'EXC-001',
        equipmentName: 'CAT 320D Hydraulic Excavator',
        deviceImei: '869012059918234',
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: 'RUNNING',
        fuelLevelPercent: '80.00',
        calculatedFuelLiters: '320.00',
        isSiphoningEvent: false,
        pingTimestamp: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: 'png-02',
        equipmentCode: 'EXC-001',
        equipmentName: 'CAT 320D Hydraulic Excavator',
        deviceImei: '869012059918234',
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: 'STOPPED',
        fuelLevelPercent: '70.00',
        calculatedFuelLiters: '280.00',
        isSiphoningEvent: true, // 40L Drop while STOPPED!
        pingTimestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: 'png-03',
        equipmentCode: 'CRN-001',
        equipmentName: 'Liebherr 71K Tower Crane',
        deviceImei: '869012058827361',
        latitude: '-1.292140',
        longitude: '36.821930',
        engineStatus: 'IDLE',
        fuelLevelPercent: '92.00',
        calculatedFuelLiters: '230.00',
        isSiphoningEvent: false,
        pingTimestamp: new Date(Date.now() - 120000).toISOString(),
      },
    ]
  );

  // Ping Simulator State
  const [selectedImei, setSelectedImei] = useState(devices[0]?.deviceImei || '869012059918234');
  const [simEngineStatus, setSimEngineStatus] = useState<'RUNNING' | 'IDLE' | 'STOPPED'>('RUNNING');
  const [simRpm, setSimRpm] = useState('1800');
  const [simFuelPct, setSimFuelPct] = useState('80.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Device Modal State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [newEquipName, setNewEquipName] = useState('Komatsu PC200-8 Excavator');
  const [newEquipCode, setNewEquipCode] = useState('EXC-002');
  const [newImei, setNewImei] = useState(`86901205${Date.now().toString().slice(-7)}`);
  const [newProtocol, setNewProtocol] = useState<'OBD2' | 'CANBUS' | 'GPS_MODEM' | 'MODBUS_FLOW'>('CANBUS');
  const [newTankCap, setNewTankCap] = useState('400.00');
  const [newSimPhone, setNewSimPhone] = useState('+254711223344');

  const selectedDevice = devices.find((d) => d.deviceImei === selectedImei) || devices[0];
  const tankCap = parseFloat(selectedDevice?.calibrationTankCapacityLiters || '400.00');
  const previewFuelLiters = ((parseFloat(simFuelPct) || 0) / 100) * tankCap;

  const handleSimulatePing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    // Calculate whether this is a sudden siphoning event (>30L drop while STOPPED/IDLE)
    const prevPings = pings.filter((p) => p.deviceImei === selectedImei);
    const lastPing = prevPings[0];
    let isSiphoning = false;
    if (lastPing) {
      const drop = parseFloat(lastPing.calculatedFuelLiters) - previewFuelLiters;
      if (drop >= 30 && (simEngineStatus === 'STOPPED' || simEngineStatus === 'IDLE')) {
        isSiphoning = true;
      }
    }

    try {
      if (onIngestPing) {
        await onIngestPing({
          deviceImei: selectedImei,
          latitude: '-1.292100',
          longitude: '36.821900',
          engineStatus: simEngineStatus,
          engineRpm: simEngineStatus === 'STOPPED' ? 0 : parseInt(simRpm, 10),
          cumulativeEngineSeconds: 36000,
          fuelLevelPercent: simFuelPct,
        });
      }

      const equipCode = selectedDevice?.equipmentCode || 'EXC-001';
      const equipName = selectedDevice?.equipmentName || 'CAT 320D Hydraulic Excavator';

      const newPing: TelematicsPingItem = {
        id: `png-${Date.now()}`,
        equipmentCode: equipCode,
        equipmentName: equipName,
        deviceImei: selectedImei,
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: simEngineStatus,
        fuelLevelPercent: simFuelPct,
        calculatedFuelLiters: previewFuelLiters.toFixed(2),
        isSiphoningEvent: isSiphoning,
        pingTimestamp: new Date().toISOString(),
      };

      setPings([newPing, ...pings]);
      const prevVol = lastPing ? parseFloat(lastPing.calculatedFuelLiters) : previewFuelLiters + 40;
      setFeedback(
        isSiphoning
          ? `🚨 CRITICAL SIPHONING ALERT: Rapid fuel drop of ${(prevVol - previewFuelLiters).toFixed(1)}L detected while engine ${simEngineStatus}. Automated emergency WhatsApp dispatched!`
          : `✓ Telematics ping ingested: ${equipName} (${previewFuelLiters.toFixed(1)}L / ${simFuelPct}%) - Status: ${simEngineStatus}.`
      );
    } catch (err: any) {
      setFeedback(`Ping Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerSiphoningSimulation = () => {
    setSimEngineStatus('STOPPED');
    setSimRpm('0');
    // Drop fuel percentage to 70% (280L) from 80% (320L) = 40L drop
    setSimFuelPct('70.00');
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (onRegisterDevice) {
        await onRegisterDevice({
          equipmentId: 'dummy-equip-id',
          deviceImei: newImei,
          protocol: newProtocol,
          simPhoneNumber: newSimPhone,
          calibrationTankCapacityLiters: newTankCap,
        });
      }

      const newDev: TelematicsDeviceItem = {
        id: `dev-${Date.now()}`,
        equipmentId: `eq-${Date.now()}`,
        equipmentCode: newEquipCode,
        equipmentName: newEquipName,
        deviceImei: newImei,
        protocol: newProtocol,
        calibrationTankCapacityLiters: newTankCap,
        simPhoneNumber: newSimPhone,
        status: 'ONLINE',
        lastHeartbeatAt: new Date().toISOString(),
      };

      setDevices([newDev, ...devices]);
      setShowDeviceModal(false);
    } catch (err: any) {
      alert(`Registration error: ${err.message}`);
    }
  };

  const activeSiphoningPings = pings.filter((p) => p.isSiphoningEvent);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">Plant GPS Telematics & Remote Fuel Flow Ingestion</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              IOT ACTIVE
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Site: {projectName} | Direct CANBUS / OBD2 / Modbus Telemetry & Diesel Siphoning Anomaly Detection (M24)
          </p>
        </div>
        <button
          onClick={() => setShowDeviceModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
        >
          <span>Register Telematics Hardware</span>
        </button>
      </div>

      {/* Siphoning Alert Banner if any anomaly present */}
      {activeSiphoningPings.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 shadow-sm flex items-start gap-4">
          <div className="p-2 bg-rose-100 rounded-lg text-rose-700 font-bold text-xl">⚠️</div>
          <div className="flex-1">
            <h4 className="font-bold text-rose-900 text-sm">
              Critical Fuel Theft Anomaly Flagged ({activeSiphoningPings.length} Incident Detected)
            </h4>
            <p className="text-xs text-rose-800 mt-1">
              Sudden diesel volume drop &gt;30 Liters detected while machinery engine was STOPPED/IDLE. Automatic WhatsApp safety alerts dispatched to site supervisor and security personnel.
            </p>
          </div>
        </div>
      )}

      {/* Fleet Telematics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Devices</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{devices.length} IoT Units</p>
          <p className="text-xs text-emerald-600 mt-1">All units reporting online</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pings Received</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{pings.length}</p>
          <p className="text-xs text-slate-400 mt-1">Live telemetry stream</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monitored Fuel Volume</p>
          <p className="text-xl font-bold text-slate-800 mt-1">650.00 L</p>
          <p className="text-xs text-slate-500 mt-1">Total calibrated capacity</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Siphoning Violations</p>
          <p className="text-xl font-bold text-rose-700 mt-1">{activeSiphoningPings.length}</p>
          <p className="text-xs text-rose-600 mt-1">&gt;30L sudden drop events</p>
        </div>
      </div>

      {/* Telematics Simulator Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Remote Telematics & Flow Meter Ingestion Simulator</h3>
            <p className="text-xs text-slate-500">
              Simulate MQTT / CANBUS payload ingestion from remote plant machinery modems
            </p>
          </div>
          <button
            type="button"
            onClick={triggerSiphoningSimulation}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm"
          >
            Simulate 40L Diesel Siphoning Drop
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

        <form onSubmit={handleSimulatePing} className="space-y-4 text-xs">
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
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fuel Tank Level (%)</label>
              <input
                type="text"
                value={simFuelPct}
                onChange={(e) => setSimFuelPct(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
                required
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
            <div>
              <span className="text-slate-600 font-medium">Calibrated Fuel Volume in Tank: </span>
              <span className="font-mono font-bold text-slate-900">{previewFuelLiters.toFixed(2)} Liters</span>
              <span className="text-slate-400"> (Capacity: {tankCap} L)</span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
            >
              {isSubmitting ? 'Ingesting...' : 'Ingest Telematics Ping'}
            </button>
          </div>
        </form>
      </div>

      {/* Telematics Pings Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Machinery IoT Telemetry Feed & Fuel Flow Log</h3>
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
                    <div className="text-[10px] font-mono text-slate-400">{p.equipmentCode}</div>
                  </td>
                  <td className="p-3 font-mono text-slate-700">{p.deviceImei}</td>
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
                  <td className="p-3 font-mono font-bold text-slate-800">{p.fuelLevelPercent}%</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{p.calculatedFuelLiters} L</td>
                  <td className="p-3">
                    {p.isSiphoningEvent ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        DIESEL SIPHONING FLAG
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        NORMAL BURN
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400">{new Date(p.pingTimestamp).toLocaleTimeString('en-KE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Device Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">Register Telematics Device</h3>
              <button
                onClick={() => setShowDeviceModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Equipment Name</label>
                <input
                  type="text"
                  value={newEquipName}
                  onChange={(e) => setNewEquipName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Equipment Code</label>
                  <input
                    type="text"
                    value={newEquipCode}
                    onChange={(e) => setNewEquipCode(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Protocol</label>
                  <select
                    value={newProtocol}
                    onChange={(e) => setNewProtocol(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  >
                    <option value="CANBUS">CANBUS (Heavy Plant J1939)</option>
                    <option value="OBD2">OBD2 (Fleet Trucks)</option>
                    <option value="GPS_MODEM">GPS MODEM (Standalone)</option>
                    <option value="MODBUS_FLOW">MODBUS FLOW (Fuel meter)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hardware Device IMEI</label>
                <input
                  type="text"
                  value={newImei}
                  onChange={(e) => setNewImei(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tank Capacity (Liters)</label>
                  <input
                    type="text"
                    value={newTankCap}
                    onChange={(e) => setNewTankCap(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SIM Card Phone</label>
                  <input
                    type="text"
                    value={newSimPhone}
                    onChange={(e) => setNewSimPhone(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-sm"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
