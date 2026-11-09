import React, { useEffect, useState} from 'react';

export interface TelematicsDeviceItem {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  deviceImei: string;
  protocol: 'OBD2' | 'CANBUS' | 'GPS_MODEM' | 'MODBUS_FLOW';
  canBusBaudRate?: number;
  maxEngineBurnRateLph?: string;
  calibrationTankCapacityLiters: string;
  tankGeometry?: 'RECTANGULAR' | 'CYLINDRICAL_HORIZONTAL' | 'CUSTOM_CURVE';
  simPhoneNumber?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'FAULT' | 'TAMPERED';
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
  engineRpm?: number | null;
  coolantTempC?: string | null;
  oilTempC?: string | null;
  batteryVoltage?: string | null;
  fuelRateLPerH?: string | null;
  engineLoadPercent?: string | null;
  speedKmh?: string | null;
  dtcFaultCodes?: string | null;
  fuelLevelPercent: string;
  calculatedFuelLiters: string;
  fuelDropLiters?: string | null;
  dropRateLPerHour?: string | null;
  isSiphoningEvent: boolean;
  anomalySeverity?: 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL' | null;
  pingTimestamp: string;
}

export interface PlantMaintenanceAlertItem {
  id: string;
  alertCode: string;
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName: string;
  deviceImei?: string | null;
  alertType: 'DTC_FAULT' | 'ENGINE_OVERHEAT' | 'CRITICAL_OIL_TEMP' | 'SERVICE_INTERVAL_DUE' | 'FUEL_DISCREPANCY' | 'SIPHONING_THEFT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'FATAL_SHUTDOWN';
  dtcCode?: string | null;
  title: string;
  description: string;
  recommendedAction?: string | null;
  hoursMeterAtAlert: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

interface PlantTelematicsViewProps {
  projectId?: string;
  projectName?: string;
  devices?: TelematicsDeviceItem[];
  pings?: TelematicsPingItem[];
  alerts?: PlantMaintenanceAlertItem[];
  initialShowAcknowledgeModalForAlertId?: string;
  onRegisterDevice?: (data: any) => Promise<any>;
  onIngestPing?: (data: any) => Promise<any>;
  onAcknowledgeAlert?: (alertId: string, data: { acknowledgedBy: string; actionNotes?: string}) => Promise<any>;
}

export const PlantTelematicsView: React.FC<PlantTelematicsViewProps> = ({
  projectId = '',
  projectName = 'Upper Hill Commercial Tower',
  devices: initialDevices,
  pings: initialPings,
  alerts: initialAlerts,
  initialShowAcknowledgeModalForAlertId,
  onRegisterDevice,
  onIngestPing,
  onAcknowledgeAlert,
}) => {
  const [devices, setDevices] = useState<TelematicsDeviceItem[]>(
    initialDevices || (import.meta.env.DEV ? [
      {
        id: 'dev-001',
        equipmentId: 'eq-001',
        equipmentCode: 'EXC-001',
        equipmentName: 'CAT 320D Hydraulic Excavator',
        deviceImei: '869012059918234',
        protocol: 'CANBUS',
        canBusBaudRate: 250000,
        maxEngineBurnRateLph: '35.00',
        calibrationTankCapacityLiters: '400.00',
        tankGeometry: 'RECTANGULAR',
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
        protocol: 'CANBUS',
        canBusBaudRate: 250000,
        maxEngineBurnRateLph: '28.00',
        calibrationTankCapacityLiters: '250.00',
        tankGeometry: 'RECTANGULAR',
        simPhoneNumber: '+254722334455',
        status: 'ONLINE',
        lastHeartbeatAt: new Date(Date.now() - 300000).toISOString(),
},
    ] : [])
);

  const [pings, setPings] = useState<TelematicsPingItem[]>(
    initialPings || (import.meta.env.DEV ? [
      {
        id: 'png-01',
        equipmentCode: 'EXC-001',
        equipmentName: 'CAT 320D Hydraulic Excavator',
        deviceImei: '869012059918234',
        latitude: '-1.292100',
        longitude: '36.821900',
        engineStatus: 'RUNNING',
        engineRpm: 1850,
        coolantTempC: '94.2',
        oilTempC: '98.5',
        batteryVoltage: '24.20',
        fuelRateLPerH: '19.80',
        engineLoadPercent: '68.50',
        speedKmh: '0.0',
        dtcFaultCodes: null,
        fuelLevelPercent: '80.00',
        calculatedFuelLiters: '320.00',
        fuelDropLiters: '0.00',
        dropRateLPerHour: '0.00',
        isSiphoningEvent: false,
        anomalySeverity: 'NONE',
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
        engineRpm: 0,
        coolantTempC: '65.0',
        oilTempC: '70.0',
        batteryVoltage: '24.10',
        fuelRateLPerH: '0.00',
        engineLoadPercent: '0.00',
        speedKmh: '0.0',
        dtcFaultCodes: 'P0115',
        fuelLevelPercent: '70.00',
        calculatedFuelLiters: '280.00',
        fuelDropLiters: '40.00',
        dropRateLPerHour: '480.00',
        isSiphoningEvent: true, // 40L Drop while STOPPED!
        anomalySeverity: 'CRITICAL',
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
        engineRpm: 800,
        coolantTempC: '88.5',
        oilTempC: '91.0',
        batteryVoltage: '23.80',
        fuelRateLPerH: '3.50',
        engineLoadPercent: '12.00',
        speedKmh: '0.0',
        dtcFaultCodes: null,
        fuelLevelPercent: '92.00',
        calculatedFuelLiters: '230.00',
        fuelDropLiters: '0.00',
        dropRateLPerHour: '0.00',
        isSiphoningEvent: false,
        anomalySeverity: 'NONE',
        pingTimestamp: new Date(Date.now() - 120000).toISOString(),
},
    ] : [])
);

  const defaultAlerts: PlantMaintenanceAlertItem[] = [
    {
      id: 'alt-001',
      alertCode: 'ALT-FUEL-DISC-001',
      equipmentCode: 'EXC-001',
      equipmentName: 'CAT 320D Hydraulic Excavator',
      deviceImei: '869012059918234',
      alertType: 'FUEL_DISCREPANCY',
      severity: 'CRITICAL',
      title: 'Rapid Fuel Drop / Discrepancy Flag: CAT 320D Hydraulic Excavator',
      description: 'CRITICAL FUEL VARIANCE: 40.0L dropped in 5 min while engine STOPPED.',
      recommendedAction: 'Inspect fuel tank cap, drain valve, and immediate physical fuel level. Reconcile with site fuel log.',
      hoursMeterAtAlert: '1420.50',
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 300000).toISOString(),
},
    {
      id: 'alt-002',
      alertCode: 'ALT-DIAG-002',
      equipmentCode: 'EXC-001',
      equipmentName: 'CAT 320D Hydraulic Excavator',
      deviceImei: '869012059918234',
      alertType: 'DTC_FAULT',
      severity: 'WARNING',
      dtcCode: 'P0115',
      title: 'Engine Diagnostics Alarm: CAT 320D Hydraulic Excavator (EXC-001)',
      description: 'ACTIVE ECU DTC FAULT CODES: P0115 (Engine Coolant Temperature Sensor 1 Circuit)',
      recommendedAction: 'Connect OBD-II / J1939 scanner, pull freeze frame data, and inspect electrical harness.',
      hoursMeterAtAlert: '1420.50',
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 240000).toISOString(),
},
  ];

  const effectiveAlerts = initialAlerts || (import.meta.env.DEV ? defaultAlerts : []);
  const [alerts, setAlerts] = useState<PlantMaintenanceAlertItem[]>(effectiveAlerts);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);
  const [equipmentIdByCode, setEquipmentIdByCode] = useState<Record<string, string>>({});

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const [pingRes, alertRes, equipRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/telematics-pings`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/maintenance-alerts`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/equipment`, { credentials: 'include'}),
      ]);

      const equipMap: Record<string, string> = {};
      if (equipRes.ok) {
        const ej = await equipRes.json();
        for (const e of (ej.equipment || []) as any[]) {
          if (e.equipmentCode && e.id) equipMap[e.equipmentCode] = e.id;
}
        setEquipmentIdByCode(equipMap);
}

      if (pingRes.ok) {
        const pj = await pingRes.json();
        const list = ((pj.pings || []) as any[]).map((p) => ({
          ...p,
          latitude: p.latitude?.toString?.() ?? String(p.latitude ?? ''),
          longitude: p.longitude?.toString?.() ?? String(p.longitude ?? ''),
          coolantTempC: p.coolantTempC?.toString?.() ?? p.coolantTempC ?? null,
          oilTempC: p.oilTempC?.toString?.() ?? p.oilTempC ?? null,
          batteryVoltage: p.batteryVoltage?.toString?.() ?? p.batteryVoltage ?? null,
          fuelRateLPerH: p.fuelRateLPerH?.toString?.() ?? p.fuelRateLPerH ?? null,
          fuelLevelPercent: p.fuelLevelPercent?.toString?.() ?? String(p.fuelLevelPercent ?? 0),
          calculatedFuelLiters: p.calculatedFuelLiters?.toString?.() ?? String(p.calculatedFuelLiters ?? 0),
          fuelDropLiters: p.fuelDropLiters?.toString?.() ?? p.fuelDropLiters ?? null,
          dropRateLPerHour: p.dropRateLPerHour?.toString?.() ?? p.dropRateLPerHour ?? null,
})) as TelematicsPingItem[];
        setPings(list);

        // No GET /telematics-devices endpoint exists — derive the fleet device
        // list from observed pings joined with the equipment register.
        const byImei = new Map<string, TelematicsDeviceItem>();
        for (const p of list) {
          if (!byImei.has(p.deviceImei)) {
            byImei.set(p.deviceImei, {
              id: `dev-${p.deviceImei}`,
              equipmentId: equipMap[p.equipmentCode] || '',
              equipmentCode: p.equipmentCode,
              equipmentName: p.equipmentName,
              deviceImei: p.deviceImei,
              protocol: 'CANBUS',
              calibrationTankCapacityLiters: '300.00',
              status: 'ONLINE',
              lastHeartbeatAt: p.pingTimestamp,
});
}
}
        setDevices([...byImei.values()]);
}

      if (alertRes.ok) {
        const aj = await alertRes.json();
        const list = ((aj.alerts || []) as any[]).map((a) => ({
          ...a,
          hoursMeterAtAlert: a.hoursMeterAtAlert?.toString?.() ?? String(a.hoursMeterAtAlert ?? 0),
})) as PlantMaintenanceAlertItem[];
        setAlerts(list);
}
} catch { /* keep demo */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Ping Simulator State
  const [selectedImei, setSelectedImei] = useState(devices[0]?.deviceImei || '869012059918234');
  const [simEngineStatus, setSimEngineStatus] = useState<'RUNNING' | 'IDLE' | 'STOPPED'>('RUNNING');
  const [simRpm, setSimRpm] = useState('1850');
  const [simFuelPct, setSimFuelPct] = useState('80.00');
  const [simCoolant, setSimCoolant] = useState('94.0');
  const [simOil, setSimOil] = useState('98.0');
  const [simVoltage, setSimVoltage] = useState('24.20');
  const [simDtc, setSimDtc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Register Device Modal State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [newEquipName, setNewEquipName] = useState('Komatsu PC200-8 Excavator');
  const [newEquipCode, setNewEquipCode] = useState('EXC-002');
  const [newImei, setNewImei] = useState(`86901205${Date.now().toString().slice(-7)}`);
  const [newProtocol, setNewProtocol] = useState<'OBD2' | 'CANBUS' | 'GPS_MODEM' | 'MODBUS_FLOW'>('CANBUS');
  const [newBaudRate, setNewBaudRate] = useState<number>(250000);
  const [newMaxBurnRate, setNewMaxBurnRate] = useState('35.00');
  const [newTankCap, setNewTankCap] = useState('400.00');
  const [newTankGeometry, setNewTankGeometry] = useState<'RECTANGULAR' | 'CYLINDRICAL_HORIZONTAL' | 'CUSTOM_CURVE'>('RECTANGULAR');
  const [newSimPhone, setNewSimPhone] = useState('+254711223344');

  // Acknowledge Alert Modal State
  const [alertToAcknowledge, setAlertToAcknowledge] = useState<PlantMaintenanceAlertItem | null>(() => {
    if (initialShowAcknowledgeModalForAlertId) {
      return effectiveAlerts.find((a) => a.id === initialShowAcknowledgeModalForAlertId) || null;
}
    return null;
});
  const [ackBy, setAckBy] = useState('Eng. Sarah Mwangi (Lead Plant Engineer)');
  const [ackNotes, setAckNotes] = useState('Physical fuel dip confirmed 40L missing. CCTV footage archived for police report.');
  const [ackError, setAckError] = useState<string | null>(null);
  const [isAcking, setIsAcking] = useState(false);

  const selectedDevice = devices.find((d) => d.deviceImei === selectedImei) || devices[0];
  const tankCap = parseFloat(selectedDevice?.calibrationTankCapacityLiters || '400.00');
  const previewFuelLiters = ((parseFloat(simFuelPct) || 0) / 100) * tankCap;

  // Selected machinery's latest ping for Live Diagnostics Dashboard
  const machineryPings = pings.filter((p) => p.deviceImei === selectedImei);
  const latestPing = machineryPings[0] || pings[0];
  const coolantNum = parseFloat(latestPing?.coolantTempC || '90.0');
  const isOverheatFatal = coolantNum > 108.0;
  const isOverheatWarning = coolantNum > 103.0 && !isOverheatFatal;

  const handleSimulatePing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const prevPings = pings.filter((p) => p.deviceImei === selectedImei);
    const lastPing = prevPings[0];
    let isSiphoning = false;
    let anomalySeverity: 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL' = 'NONE';
    let dropLiters = 0;
    let dropRateLph = 0;

    if (lastPing) {
      dropLiters = parseFloat(lastPing.calculatedFuelLiters) - previewFuelLiters;
      dropRateLph = dropLiters * 12; // simulated rate
      if (simEngineStatus === 'STOPPED' && dropLiters >= 8.0) {
        isSiphoning = true;
        anomalySeverity = 'CRITICAL';
} else if (simEngineStatus === 'IDLE' && dropRateLph > 12.0) {
        isSiphoning = true;
        anomalySeverity = 'CRITICAL';
} else if (simEngineStatus === 'RUNNING' && dropRateLph > 45.0) {
        isSiphoning = true;
        anomalySeverity = 'HIGH';
}
}

    try {
      if (isLive) {
        // Live mode: hand the ping to the caller's ingest hook (device-token
        // webhook) if provided, then refresh pings/alerts from the API.
        if (onIngestPing) {
          await onIngestPing({
            deviceImei: selectedImei,
            latitude: '-1.292100',
            longitude: '36.821900',
            engineStatus: simEngineStatus,
            engineRpm: simEngineStatus === 'STOPPED' ? 0 : parseInt(simRpm, 10),
            coolantTempC: simCoolant,
            oilTempC: simOil,
            batteryVoltage: simVoltage,
            dtcFaultCodes: simDtc || null,
            cumulativeEngineSeconds: 36000,
            fuelLevelPercent: simFuelPct,
});
}
        await reload();
        setFeedback(
          ` Telematics ping submitted for ${selectedDevice?.equipmentName || selectedImei} (${previewFuelLiters.toFixed(1)}L / ${simFuelPct}%) - Status: ${simEngineStatus}.`
);
        return;
}

      if (onIngestPing) {
        await onIngestPing({
          deviceImei: selectedImei,
          latitude: '-1.292100',
          longitude: '36.821900',
          engineStatus: simEngineStatus,
          engineRpm: simEngineStatus === 'STOPPED' ? 0 : parseInt(simRpm, 10),
          coolantTempC: simCoolant,
          oilTempC: simOil,
          batteryVoltage: simVoltage,
          dtcFaultCodes: simDtc || null,
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
        engineRpm: simEngineStatus === 'STOPPED' ? 0 : parseInt(simRpm, 10),
        coolantTempC: simCoolant,
        oilTempC: simOil,
        batteryVoltage: simVoltage,
        fuelRateLPerH: simEngineStatus === 'STOPPED' ? '0.00' : '22.50',
        engineLoadPercent: simEngineStatus === 'RUNNING' ? '65.00' : '0.00',
        speedKmh: '0.0',
        dtcFaultCodes: simDtc || null,
        fuelLevelPercent: simFuelPct,
        calculatedFuelLiters: previewFuelLiters.toFixed(2),
        fuelDropLiters: isSiphoning ? dropLiters.toFixed(2) : '0.00',
        dropRateLPerHour: isSiphoning ? dropRateLph.toFixed(2) : '0.00',
        isSiphoningEvent: isSiphoning,
        anomalySeverity,
        pingTimestamp: new Date().toISOString(),
};

      setPings([newPing, ...pings]);

      // If siphoning or diagnostics alert, create in local alerts state as well
      if (isSiphoning) {
        const newAlert: PlantMaintenanceAlertItem = {
          id: `alt-${Date.now()}`,
          alertCode: `ALT-FUEL-DISC-${Date.now().toString(36).toUpperCase()}`,
          equipmentCode: equipCode,
          equipmentName: equipName,
          deviceImei: selectedImei,
          alertType: 'FUEL_DISCREPANCY',
          severity: 'CRITICAL',
          title: `Rapid Fuel Drop / Discrepancy Flag: ${equipName}`,
          description: `CRITICAL FUEL VARIANCE: ${dropLiters.toFixed(1)}L dropped while engine ${simEngineStatus}.`,
          recommendedAction: 'Inspect fuel tank cap, drain valve, and immediate physical fuel level. Reconcile with site fuel log.',
          hoursMeterAtAlert: '1420.50',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
};
        setAlerts([newAlert, ...alerts]);
}

      setFeedback(
        isSiphoning
          ? ` CRITICAL FUEL DISCREPANCY ALERT: Rapid fuel drop of ${dropLiters.toFixed(1)}L detected while engine ${simEngineStatus}. Automatic WhatsApp safety alert dispatched!`
          : ` Telematics ping ingested: ${equipName} (${previewFuelLiters.toFixed(1)}L / ${simFuelPct}%) - Status: ${simEngineStatus}.`
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
      if (isLive) {
        const res = await fetch(`/api/v1/projects/${projectId}/telematics-devices`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            equipmentId: equipmentIdByCode[newEquipCode] || Object.values(equipmentIdByCode)[0] || '',
            deviceImei: newImei,
            protocol: newProtocol,
            simPhoneNumber: newSimPhone || null,
            calibrationTankCapacityLiters: newTankCap,
}),
});
        if (res.ok) {
          await reload();
          setShowDeviceModal(false);
          return;
}
}

      const resolvedEquipmentId = equipmentIdByCode[newEquipCode] || Object.values(equipmentIdByCode)[0] || '';
      if (onRegisterDevice) {
        if (!resolvedEquipmentId) {
          setFeedback('Select equipment registered on this project before registering a telematics device.');
          return;
        }
        await onRegisterDevice({
          equipmentId: resolvedEquipmentId,
          deviceImei: newImei,
          protocol: newProtocol,
          canBusBaudRate: newBaudRate,
          maxEngineBurnRateLph: newMaxBurnRate,
          calibrationTankCapacityLiters: newTankCap,
          tankGeometry: newTankGeometry,
          simPhoneNumber: newSimPhone,
});
}

      const newDev: TelematicsDeviceItem = {
        id: `dev-${Date.now()}`,
        equipmentId: `eq-${Date.now()}`,
        equipmentCode: newEquipCode,
        equipmentName: newEquipName,
        deviceImei: newImei,
        protocol: newProtocol,
        canBusBaudRate: newBaudRate,
        maxEngineBurnRateLph: newMaxBurnRate,
        calibrationTankCapacityLiters: newTankCap,
        tankGeometry: newTankGeometry,
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

  const handleAcknowledgeAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertToAcknowledge) return;
    setIsAcking(true);
    setAckError(null);

    try {
      if (isLive) {
        const res = await fetch(`/api/v1/projects/${projectId}/maintenance-alerts/${alertToAcknowledge.id}/acknowledge`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ acknowledgedBy: ackBy, actionNotes: ackNotes}),
});
        if (res.ok) {
          await reload();
          setAlertToAcknowledge(null);
          return;
}
}

      if (onAcknowledgeAlert) {
        await onAcknowledgeAlert(alertToAcknowledge.id, {
          acknowledgedBy: ackBy,
          actionNotes: ackNotes,
});
}

      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertToAcknowledge.id
            ? {
                ...a,
                status: 'ACKNOWLEDGED',
                acknowledgedBy: ackBy,
                acknowledgedAt: new Date().toISOString(),
                description: ackNotes ? `${a.description} [Action]: ${ackNotes}` : a.description,
}
            : a
)
);

      setAlertToAcknowledge(null);
} catch (err: any) {
      setAckError(err.message || 'Failed to acknowledge maintenance alert');
} finally {
      setIsAcking(false);
}
};

  const activeSiphoningPings = pings.filter((p) => p.isSiphoningEvent);
  const siphoningEventsList = pings.filter((p) => p.isSiphoningEvent || (p.fuelDropLiters && parseFloat(p.fuelDropLiters) > 0));

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading telematics...</div>;
}

  return (
<div className="space-y-6">
      {/* Header Banner */}
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
            onClick={() => setShowDeviceModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
<span>Register Telematics Hardware</span>
</button>
</div>
</div>

      {/* Discrepancy Alert Banner if any anomaly present */}
      {activeSiphoningPings.length > 0 && (
<div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 shadow-sm flex items-start gap-4">
<div className="p-2 bg-rose-100 rounded-lg text-rose-700 font-bold text-xl"></div>
<div className="flex-1">
<h4 className="font-bold text-rose-900 text-sm">
              Critical Fuel Discrepancy Flagged ({activeSiphoningPings.length} Incident Detected)
</h4>
<p className="text-xs text-rose-800 mt-1">
              Sudden diesel volume drop &gt;30 Liters detected while machinery engine was STOPPED/IDLE. Automatic WhatsApp safety alerts dispatched to site supervisor and plant engineering personnel.
</p>
</div>
</div>
)}

      {/* Fleet Telematics Overview Cards */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Active Devices</p>
<p className="text-xl font-bold text-slate-800 mt-1">{devices.length} IoT Units</p>
<p className="text-xs text-emerald-600 mt-1">All units reporting online</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Total Pings Received</p>
<p className="text-xl font-bold text-slate-800 mt-1">{pings.length}</p>
<p className="text-xs text-slate-400 mt-1">Live telemetry stream</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-slate-500 ">Monitored Fuel Volume</p>
<p className="text-xl font-bold text-slate-800 mt-1">650.00 L</p>
<p className="text-xs text-slate-500 mt-1">Total calibrated capacity</p>
</div>

<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<p className="text-xs font-semibold text-rose-600 ">Fuel Discrepancies</p>
<p className="text-xl font-bold text-rose-700 mt-1">{activeSiphoningPings.length}</p>
<p className="text-xs text-rose-600 mt-1">&gt;30L sudden drop events</p>
</div>
</div>

      {/* ============================================================= */}
      {/* CAN-BUS LIVE DIAGNOSTICS DASHBOARD (MILESTONE M32) */}
      {/* ============================================================= */}
<div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
<div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
<div>
<h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
<span>CAN-bus Live Diagnostics Dashboard</span>
<span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-100 text-blue-800 border border-blue-200">
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
              onChange={(e) => setSelectedImei(e.target.value)}
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
                  ? 'bg-rose-600 text-white animate-pulse'
                  : isOverheatWarning
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-100 text-emerald-800'
}`}>
                {isOverheatFatal ? 'FATAL SHUTDOWN' : isOverheatWarning ? 'WARNING' : 'NORMAL'}
</span>
</div>
<div className="text-2xl font-mono font-extrabold mt-1">
              {latestPing?.coolantTempC || '92.4'}°C
</div>
            {/* Overheat Threshold Indicator */}
<div className="mt-2 text-[10px] space-y-1">
<div className="flex justify-between text-slate-500 font-mono">
<span>Safe &lt;103°C</span>
<span className="text-amber-600 font-bold">Warn 103°C</span>
<span className="text-rose-600 font-bold">Limit 108°C</span>
</div>
<div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
<div
                  className={`h-1.5 rounded-full ${
                    isOverheatFatal ? 'bg-rose-600' : isOverheatWarning ? 'bg-amber-500' : 'bg-emerald-500'
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
<div className="text-2xl font-mono font-extrabold text-slate-800 mt-1">
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
<div className="text-2xl font-mono font-extrabold text-slate-800 mt-1">
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
<div className="text-2xl font-mono font-extrabold text-slate-800 mt-1">
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
<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-mono text-xs font-bold">
<span></span>
<span>{latestPing.dtcFaultCodes}</span>
</div>
) : (
<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-bold">
<span></span>
<span>No Active DTCs</span>
</div>
)}
</div>
<p className="text-[10px] text-slate-500 mt-2">SAE J1939 Diagnostic Trouble Codes</p>
</div>
</div>
</div>

      {/* ============================================================= */}
      {/* DIESEL SIPHONING ANOMALY INCIDENT FEED (MILESTONE M32) */}
      {/* ============================================================= */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
<div className="p-4 border-b border-slate-200 flex justify-between items-center">
<div>
<h3 className="font-bold text-slate-800 text-sm">Fuel Discrepancy Anomaly Incident Feed</h3>
<p className="text-xs text-slate-500">Deep telemetry fuel drain rate analysis and anomaly variance detection</p>
</div>
<span className="text-xs font-semibold px-2 py-1 bg-rose-100 text-rose-800 rounded border border-rose-200">
            {siphoningEventsList.length} Anomaly Events
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
              {siphoningEventsList.length === 0 ? (
<tr>
<td colSpan={7} className="p-4 text-center text-slate-400">
                    No fuel discrepancies detected. Machinery fuel consumption operating normally.
</td>
</tr>
) : (
                siphoningEventsList.map((evt) => (
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
<div className="text-[10px] font-mono text-slate-400">{evt.equipmentCode}</div>
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
<td className="p-3 font-mono font-bold text-rose-700">
                      -{evt.fuelDropLiters || '40.00'} Liters
</td>
<td className="p-3 font-mono font-semibold text-slate-800">
                      {evt.dropRateLPerHour || '480.00'} L/h
</td>
<td className="p-3">
                      {evt.isSiphoningEvent ? (
<span className="font-semibold text-rose-700">Rapid Fuel Level Drop Event</span>
) : (
<span className="text-slate-600">Monitored Fuel Drop</span>
)}
</td>
<td className="p-3 text-slate-400">
                      {new Date(evt.pingTimestamp).toLocaleTimeString('en-KE')}
</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>

      {/* ============================================================= */}
      {/* MAINTENANCE ALERTS FEED & ACKNOWLEDGE (MILESTONE M32) */}
      {/* ============================================================= */}
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
<div className="p-6 text-center text-slate-400 text-xs">
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
<span className="font-mono text-xs font-bold text-slate-700">{alert.alertCode}</span>
<span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        alert.status === 'ACTIVE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}`}
                    >
                      {alert.status}
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
                      {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString('en-KE') : 'recently'}
</p>
)}
</div>

<div>
                  {alert.status === 'ACTIVE' ? (
<button
                      onClick={() => setAlertToAcknowledge(alert)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm whitespace-nowrap"
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

      {/* Telematics Simulator Section */}
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
            onClick={triggerSiphoningSimulation}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm"
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

<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div>
<label className="block font-semibold text-slate-700 mb-1">Coolant Temp (°C)</label>
<input
                type="text"
                value={simCoolant}
                onChange={(e) => setSimCoolant(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Oil Temp (°C)</label>
<input
                type="text"
                value={simOil}
                onChange={(e) => setSimOil(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">Supply Battery (V)</label>
<input
                type="text"
                value={simVoltage}
                onChange={(e) => setSimVoltage(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
</div>
<div>
<label className="block font-semibold text-slate-700 mb-1">ECU DTC Codes (optional)</label>
<input
                type="text"
                placeholder="e.g. P0115, P0217"
                value={simDtc}
                onChange={(e) => setSimDtc(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
</div>
</div>

<div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
<div>
<span className="text-slate-600 font-medium">Calibrated Fuel Volume in Tank:</span>
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
                        DIESEL DISCREPANCY FLAG
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

      {/* ============================================================= */}
      {/* ACCESSIBLE ACKNOWLEDGE MAINTENANCE ALERT MODAL (M32) */}
      {/* ============================================================= */}
      {alertToAcknowledge && (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ack-alert-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<div>
<h3 id="ack-alert-modal-title" className="font-bold text-slate-800 text-base">
                  Acknowledge Plant Maintenance Alert
</h3>
<p className="text-xs text-slate-500 mt-0.5">
                  Confirm receipt of alert {alertToAcknowledge.alertCode} and record engineering actions
</p>
</div>
<button
                onClick={() => setAlertToAcknowledge(null)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-base"
              >
                
</button>
</div>

            {ackError && (
<div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {ackError}
</div>
)}

<div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
<div className="font-bold text-slate-800">{alertToAcknowledge.title}</div>
<div className="text-slate-600">{alertToAcknowledge.description}</div>
<div className="text-slate-500 font-mono text-[11px]">
                Machine: {alertToAcknowledge.equipmentName} ({alertToAcknowledge.equipmentCode}) • Severity: {alertToAcknowledge.severity}
</div>
</div>

<form onSubmit={handleAcknowledgeAlert} className="space-y-3 text-xs">
<div>
<label htmlFor="ack-engineer-name" className="block font-semibold text-slate-700 mb-1">
                  Acknowledged By (Engineer Name / Role)
</label>
<input
                  id="ack-engineer-name"
                  type="text"
                  value={ackBy}
                  onChange={(e) => setAckBy(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
</div>

<div>
<label htmlFor="ack-action-notes" className="block font-semibold text-slate-700 mb-1">
                  Remediation Action Notes (Required for audit compliance)
</label>
<textarea
                  id="ack-action-notes"
                  rows={3}
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="e.g. Coolant topped up, leak inspected, or security footage reviewed..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setAlertToAcknowledge(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isAcking}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                  {isAcking ? 'Acknowledging...' : 'Acknowledge Alert'}
</button>
</div>
</form>
</div>
</div>
)}

      {/* ============================================================= */}
      {/* ACCESSIBLE REGISTER DEVICE MODAL */}
      {/* ============================================================= */}
      {showDeviceModal && (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-device-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 id="reg-device-modal-title" className="font-bold text-slate-800 text-base">
                Register Telematics Hardware
</h3>
<button
                onClick={() => setShowDeviceModal(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-base"
              >
                
</button>
</div>

<form onSubmit={handleRegisterDevice} className="space-y-3 text-xs">
<div>
<label htmlFor="reg-equip-name" className="block font-semibold text-slate-700 mb-1">
                  Equipment Name
</label>
<input
                  id="reg-equip-name"
                  type="text"
                  value={newEquipName}
                  onChange={(e) => setNewEquipName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label htmlFor="reg-equip-code" className="block font-semibold text-slate-700 mb-1">
                    Equipment Code
</label>
<input
                    id="reg-equip-code"
                    type="text"
                    value={newEquipCode}
                    onChange={(e) => setNewEquipCode(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
</div>
<div>
<label htmlFor="reg-protocol" className="block font-semibold text-slate-700 mb-1">
                    Protocol
</label>
<select
                    id="reg-protocol"
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

<div className="grid grid-cols-2 gap-2">
<div>
<label htmlFor="reg-baud-rate" className="block font-semibold text-slate-700 mb-1">
                    CAN Baud Rate
</label>
<select
                    id="reg-baud-rate"
                    value={newBaudRate}
                    onChange={(e) => setNewBaudRate(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800 font-mono"
                  >
<option value={250000}>250 kbps (J1939 Standard)</option>
<option value={500000}>500 kbps (High Speed CAN)</option>
</select>
</div>
<div>
<label htmlFor="reg-max-burn" className="block font-semibold text-slate-700 mb-1">
                    Max Burn Rate (L/h)
</label>
<input
                    id="reg-max-burn"
                    type="text"
                    value={newMaxBurnRate}
                    onChange={(e) => setNewMaxBurnRate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
</div>
</div>

<div>
<label htmlFor="reg-imei" className="block font-semibold text-slate-700 mb-1">
                  Hardware Device IMEI
</label>
<input
                  id="reg-imei"
                  type="text"
                  value={newImei}
                  onChange={(e) => setNewImei(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                  required
                />
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label htmlFor="reg-tank-cap" className="block font-semibold text-slate-700 mb-1">
                    Tank Capacity (Liters)
</label>
<input
                    id="reg-tank-cap"
                    type="text"
                    value={newTankCap}
                    onChange={(e) => setNewTankCap(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                    required
                  />
</div>
<div>
<label htmlFor="reg-tank-geom" className="block font-semibold text-slate-700 mb-1">
                    Tank Geometry
</label>
<select
                    id="reg-tank-geom"
                    value={newTankGeometry}
                    onChange={(e) => setNewTankGeometry(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  >
<option value="RECTANGULAR">Rectangular Prism</option>
<option value="CYLINDRICAL_HORIZONTAL">Horizontal Cylinder</option>
<option value="CUSTOM_CURVE">Custom Strapping Table</option>
</select>
</div>
</div>

<div>
<label htmlFor="reg-sim-phone" className="block font-semibold text-slate-700 mb-1">
                  SIM Card Phone Number
</label>
<input
                  id="reg-sim-phone"
                  type="text"
                  value={newSimPhone}
                  onChange={(e) => setNewSimPhone(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
                />
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
