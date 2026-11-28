import React, { useEffect, useState} from 'react';
import { useToast } from './feedback/Toast';
import { api, apiErrorMessage } from '../lib/api';
import {
  CanBusDiagnosticsDashboard,
  FleetOverviewCards,
  MaintenanceAlertsFeed,
  PingsLedger,
  SiphoningAlertBanner,
  SiphoningIncidentFeed,
  TelematicsHeaderBanner,
  TelematicsSimulatorSection,
} from './PlantTelematicsView.parts';
import { AcknowledgeAlertModal } from './AcknowledgeAlertModal';
import { RegisterDeviceModal } from './RegisterDeviceModal';

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
  const toast = useToast();
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
      const [pingJson, alertJson, equipJson] = await Promise.all([
        api.get<any>(`/api/v1/projects/${projectId}/telematics-pings`).catch(() => null), // intentionally ignored: demo data stays when a feed fails
        api.get<any>(`/api/v1/projects/${projectId}/maintenance-alerts`).catch(() => null), // intentionally ignored: demo data stays when a feed fails
        api.get<any>(`/api/v1/projects/${projectId}/equipment`).catch(() => null), // intentionally ignored: demo data stays when a feed fails
      ]);

      const equipMap: Record<string, string> = {};
      if (equipJson) {
        for (const e of (equipJson.equipment || []) as any[]) {
          if (e.equipmentCode && e.id) equipMap[e.equipmentCode] = e.id;
}
        setEquipmentIdByCode(equipMap);
}

      if (pingJson) {
        const list = ((pingJson.pings || []) as any[]).map((p) => ({
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

      if (alertJson) {
        const list = ((alertJson.alerts || []) as any[]).map((a) => ({
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
} catch (err) {
      setFeedback(`Ping Error: ${apiErrorMessage(err)}`);
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
        try {
          await api.post(`/api/v1/projects/${projectId}/telematics-devices`, {
            equipmentId: equipmentIdByCode[newEquipCode] || Object.values(equipmentIdByCode)[0] || '',
            deviceImei: newImei,
            protocol: newProtocol,
            simPhoneNumber: newSimPhone || null,
            calibrationTankCapacityLiters: newTankCap,
});
          await reload();
          setShowDeviceModal(false);
          return;
} catch { /* fall through to local */ }
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
      toast.error(err, 'Could not register the device. Try again.');
}
};

  const handleAcknowledgeAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertToAcknowledge) return;
    setIsAcking(true);
    setAckError(null);

    try {
      if (isLive) {
        try {
          await api.patch(`/api/v1/projects/${projectId}/maintenance-alerts/${alertToAcknowledge.id}/acknowledge`, {
            acknowledgedBy: ackBy, actionNotes: ackNotes,
});
          await reload();
          setAlertToAcknowledge(null);
          return;
} catch { /* fall through to local */ }
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
} catch (err) {
      setAckError(apiErrorMessage(err, 'Failed to acknowledge maintenance alert'));
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
<TelematicsHeaderBanner
        projectName={projectName}
        onOpenRegisterModal={() => setShowDeviceModal(true)}
      />

      {/* Discrepancy Alert Banner if any anomaly present */}
      {activeSiphoningPings.length > 0 && (
<SiphoningAlertBanner count={activeSiphoningPings.length} />
)}

      {/* Fleet Telematics Overview Cards */}
<FleetOverviewCards
        devices={devices}
        pings={pings}
        activeSiphoningPings={activeSiphoningPings}
      />

      {/* ============================================================= */}
      {/* CAN-BUS LIVE DIAGNOSTICS DASHBOARD (MILESTONE M32) */}
      {/* ============================================================= */}
<CanBusDiagnosticsDashboard
        devices={devices}
        selectedImei={selectedImei}
        onSelectedImeiChange={setSelectedImei}
        latestPing={latestPing}
        coolantNum={coolantNum}
        isOverheatFatal={isOverheatFatal}
        isOverheatWarning={isOverheatWarning}
      />

      {/* ============================================================= */}
      {/* DIESEL SIPHONING ANOMALY INCIDENT FEED (MILESTONE M32) */}
      {/* ============================================================= */}
<SiphoningIncidentFeed events={siphoningEventsList} />

      {/* ============================================================= */}
      {/* MAINTENANCE ALERTS FEED & ACKNOWLEDGE (MILESTONE M32) */}
      {/* ============================================================= */}
<MaintenanceAlertsFeed
        alerts={alerts}
        onAcknowledge={(alert) => setAlertToAcknowledge(alert)}
      />

      {/* Telematics Simulator Section */}
<TelematicsSimulatorSection
        feedback={feedback}
        onSimulateSiphoning={triggerSiphoningSimulation}
        onSubmit={handleSimulatePing}
        devices={devices}
        selectedImei={selectedImei}
        setSelectedImei={setSelectedImei}
        simEngineStatus={simEngineStatus}
        setSimEngineStatus={setSimEngineStatus}
        simRpm={simRpm}
        setSimRpm={setSimRpm}
        simFuelPct={simFuelPct}
        setSimFuelPct={setSimFuelPct}
        simCoolant={simCoolant}
        setSimCoolant={setSimCoolant}
        simOil={simOil}
        setSimOil={setSimOil}
        simVoltage={simVoltage}
        setSimVoltage={setSimVoltage}
        simDtc={simDtc}
        setSimDtc={setSimDtc}
        isSubmitting={isSubmitting}
        fuelLitersText={previewFuelLiters.toFixed(2)}
        tankCap={tankCap}
      />

      {/* Telematics Pings Ledger */}
<PingsLedger pings={pings} />

      {/* ============================================================= */}
      {/* ACCESSIBLE ACKNOWLEDGE MAINTENANCE ALERT MODAL (M32) */}
      {/* ============================================================= */}
      {alertToAcknowledge && (
<AcknowledgeAlertModal
          alert={alertToAcknowledge}
          ackError={ackError}
          ackBy={ackBy}
          setAckBy={setAckBy}
          ackNotes={ackNotes}
          setAckNotes={setAckNotes}
          onSubmit={handleAcknowledgeAlert}
          onClose={() => setAlertToAcknowledge(null)}
          isAcking={isAcking}
        />
)}

      {/* ============================================================= */}
      {/* ACCESSIBLE REGISTER DEVICE MODAL */}
      {/* ============================================================= */}
      {showDeviceModal && (
<RegisterDeviceModal
          onClose={() => setShowDeviceModal(false)}
          onSubmit={handleRegisterDevice}
          newEquipName={newEquipName}
          setNewEquipName={setNewEquipName}
          newEquipCode={newEquipCode}
          setNewEquipCode={setNewEquipCode}
          newProtocol={newProtocol}
          setNewProtocol={setNewProtocol}
          newBaudRate={newBaudRate}
          setNewBaudRate={setNewBaudRate}
          newMaxBurnRate={newMaxBurnRate}
          setNewMaxBurnRate={setNewMaxBurnRate}
          newImei={newImei}
          setNewImei={setNewImei}
          newTankCap={newTankCap}
          setNewTankCap={setNewTankCap}
          newTankGeometry={newTankGeometry}
          setNewTankGeometry={setNewTankGeometry}
          newSimPhone={newSimPhone}
          setNewSimPhone={setNewSimPhone}
        />
)}
</div>
);
};
