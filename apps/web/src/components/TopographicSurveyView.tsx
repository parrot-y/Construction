import React, { useEffect, useState} from 'react';

export interface CrossSectionStationRecord {
  id?: string;
  stationIndex: number;
  chainageMeters: string | number;
  chainageLabel: string;
  existingGroundLevelM: string | number;
  proposedFormationLevelM: string | number;
  depthCutOrFillM?: string | number;
  cutAreaM2: string | number;
  fillAreaM2: string | number;
  midCutAreaM2?: string | number | null;
  midFillAreaM2?: string | number | null;
  intervalDistanceM?: string | number;
  intervalCutVolumeM3?: string | number;
  intervalFillVolumeM3?: string | number;
  intervalAdjustedFillM3?: string | number;
  intervalNetVolumeM3?: string | number;
  cumulativeMassOrdinateM3?: string | number;
}

export interface TopographicSurveyRecord {
  id: string;
  surveyCode: string;
  title: string;
  surveyDate: string;
  surveyorName: string;
  instrumentType: 'TOTAL_STATION' | 'RTK_GNSS' | 'DRONE_LIDAR' | 'AUTO_LEVEL';
  calculationMethod: 'AVERAGE_END_AREA' | 'PRISMOIDAL' | 'SIMPSONS_RULE';
  bulkingFactor: string | number;
  shrinkageFactor: string | number;
  freehaulDistanceMeters: string | number;
  overhaulUnitRateKes: string | number;
  borrowUnitRateKes: string | number;
  totalCutVolumeM3: string | number;
  totalFillVolumeM3: string | number;
  netBalanceVolumeM3: string | number;
  totalOverhaulCostKes: string | number;
  economicHaulLimitMeters: string | number;
  status: 'DRAFT' | 'COMPLETED' | 'SUPERSEDED';
  stationCount: number;
  stations?: CrossSectionStationRecord[];
  createdAt: string;
}

export interface TopographicSurveyViewProps {
  projectId: string;
  projectName?: string;
  initialSurveys?: TopographicSurveyRecord[];
  onRegisterSurvey?: (survey: any) => Promise<void>;
}

const DEFAULT_STATIONS: CrossSectionStationRecord[] = [
  {
    id: 'st-0',
    stationIndex: 0,
    chainageMeters: '0.00',
    chainageLabel: 'Ch 0+000',
    existingGroundLevelM: '1852.500',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '7.500',
    cutAreaM2: '45.000',
    fillAreaM2: '0.000',
    midCutAreaM2: null,
    midFillAreaM2: null,
    intervalDistanceM: '0.00',
    intervalCutVolumeM3: '0.000',
    intervalFillVolumeM3: '0.000',
    intervalAdjustedFillM3: '0.000',
    intervalNetVolumeM3: '0.000',
    cumulativeMassOrdinateM3: '0.000',
},
  {
    id: 'st-1',
    stationIndex: 1,
    chainageMeters: '50.00',
    chainageLabel: 'Ch 0+050',
    existingGroundLevelM: '1855.000',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '10.000',
    cutAreaM2: '80.000',
    fillAreaM2: '0.000',
    midCutAreaM2: '60.000',
    midFillAreaM2: null,
    intervalDistanceM: '50.00',
    intervalCutVolumeM3: '3041.667',
    intervalFillVolumeM3: '0.000',
    intervalAdjustedFillM3: '0.000',
    intervalNetVolumeM3: '3041.667',
    cumulativeMassOrdinateM3: '3041.667',
},
  {
    id: 'st-2',
    stationIndex: 2,
    chainageMeters: '150.00',
    chainageLabel: 'Ch 0+150',
    existingGroundLevelM: '1850.000',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '5.000',
    cutAreaM2: '35.000',
    fillAreaM2: '0.000',
    midCutAreaM2: '55.000',
    midFillAreaM2: null,
    intervalDistanceM: '100.00',
    intervalCutVolumeM3: '5583.333',
    intervalFillVolumeM3: '0.000',
    intervalAdjustedFillM3: '0.000',
    intervalNetVolumeM3: '5583.333',
    cumulativeMassOrdinateM3: '8625.000',
},
  {
    id: 'st-3',
    stationIndex: 3,
    chainageMeters: '350.00',
    chainageLabel: 'Ch 0+350',
    existingGroundLevelM: '1845.000',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '0.000',
    cutAreaM2: '0.000',
    fillAreaM2: '0.000',
    midCutAreaM2: '15.000',
    midFillAreaM2: null,
    intervalDistanceM: '200.00',
    intervalCutVolumeM3: '3166.667',
    intervalFillVolumeM3: '0.000',
    intervalAdjustedFillM3: '0.000',
    intervalNetVolumeM3: '3166.667',
    cumulativeMassOrdinateM3: '11791.667',
},
  {
    id: 'st-4',
    stationIndex: 4,
    chainageMeters: '600.00',
    chainageLabel: 'Ch 0+600',
    existingGroundLevelM: '1839.000',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '-6.000',
    cutAreaM2: '0.000',
    fillAreaM2: '50.000',
    midCutAreaM2: null,
    midFillAreaM2: '25.000',
    intervalDistanceM: '250.00',
    intervalCutVolumeM3: '0.000',
    intervalFillVolumeM3: '6250.000',
    intervalAdjustedFillM3: '6944.444',
    intervalNetVolumeM3: '-6944.444',
    cumulativeMassOrdinateM3: '4847.223',
},
  {
    id: 'st-5',
    stationIndex: 5,
    chainageMeters: '900.00',
    chainageLabel: 'Ch 0+900',
    existingGroundLevelM: '1842.000',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '-3.000',
    cutAreaM2: '0.000',
    fillAreaM2: '30.000',
    midCutAreaM2: null,
    midFillAreaM2: '38.000',
    intervalDistanceM: '300.00',
    intervalCutVolumeM3: '0.000',
    intervalFillVolumeM3: '11600.000',
    intervalAdjustedFillM3: '12888.889',
    intervalNetVolumeM3: '-12888.889',
    cumulativeMassOrdinateM3: '-8041.666',
},
  {
    id: 'st-6',
    stationIndex: 6,
    chainageMeters: '1200.00',
    chainageLabel: 'Ch 1+200',
    existingGroundLevelM: '1846.500',
    proposedFormationLevelM: '1845.000',
    depthCutOrFillM: '1.500',
    cutAreaM2: '40.000',
    fillAreaM2: '0.000',
    midCutAreaM2: '20.000',
    midFillAreaM2: '12.000',
    intervalDistanceM: '300.00',
    intervalCutVolumeM3: '6000.000',
    intervalFillVolumeM3: '2400.000',
    intervalAdjustedFillM3: '2666.667',
    intervalNetVolumeM3: '3333.333',
    cumulativeMassOrdinateM3: '-4708.333',
},
];

const DEFAULT_SURVEYS: TopographicSurveyRecord[] = [
  {
    id: 'surv-001',
    surveyCode: 'SURV-RD-A104-001',
    title: 'A104 Mau Summit Highway Earthworks Takeoff (Ch 0+000 to Ch 1+200)',
    surveyDate: new Date(Date.now() - 48 * 3600000).toISOString(),
    surveyorName: 'Surv. Geoffrey Kiprop, MISK',
    instrumentType: 'TOTAL_STATION',
    calculationMethod: 'PRISMOIDAL',
    bulkingFactor: '1.200',
    shrinkageFactor: '0.900',
    freehaulDistanceMeters: '500.00',
    overhaulUnitRateKes: '85.00',
    borrowUnitRateKes: '350.00',
    totalCutVolumeM3: '17791.667',
    totalFillVolumeM3: '20250.000',
    netBalanceVolumeM3: '-4708.333',
    totalOverhaulCostKes: '119000.00',
    economicHaulLimitMeters: '504.12',
    status: 'COMPLETED',
    stationCount: 7,
    stations: DEFAULT_STATIONS,
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
},
];

export const TopographicSurveyView: React.FC<TopographicSurveyViewProps> = ({
  projectId,
  projectName = 'Highway Alignment Section',
  initialSurveys = DEFAULT_SURVEYS,
  onRegisterSurvey,
}) => {
  const [surveys, setSurveys] = useState<TopographicSurveyRecord[]>(initialSurveys);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(
    initialSurveys.length > 0 ? initialSurveys[0]!.id : ''
);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [surveyCode, setSurveyCode] = useState<string>(`SURV-RD-${Date.now().toString().slice(-4)}`);
  const [title, setTitle] = useState<string>('Section Alignment Cut/Fill Takeoff');
  const [surveyorName, setSurveyorName] = useState<string>('Surv. Geoffrey Kiprop');
  const [instrumentType, setInstrumentType] = useState<'TOTAL_STATION' | 'RTK_GNSS' | 'DRONE_LIDAR' | 'AUTO_LEVEL'>('TOTAL_STATION');
  const [calculationMethod, setCalculationMethod] = useState<'AVERAGE_END_AREA' | 'PRISMOIDAL' | 'SIMPSONS_RULE'>('PRISMOIDAL');
  const [bulkingFactor, setBulkingFactor] = useState<string>('1.200');
  const [shrinkageFactor, setShrinkageFactor] = useState<string>('0.900');
  const [freehaulDistanceMeters, setFreehaulDistanceMeters] = useState<string>('500.00');
  const [overhaulUnitRateKes, setOverhaulUnitRateKes] = useState<string>('85.00');
  const [borrowUnitRateKes, setBorrowUnitRateKes] = useState<string>('350.00');

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/topographic-surveys`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const list = (await res.json()) as any[];
      const mapped = await Promise.all(list.map(async (s) => {
        const base: TopographicSurveyRecord = {
          id: s.id,
          surveyCode: s.surveyCode,
          title: s.title,
          surveyDate: s.surveyDate,
          surveyorName: s.surveyorName,
          instrumentType: s.instrumentType,
          calculationMethod: s.calculationMethod,
          bulkingFactor: s.bulkingFactor,
          shrinkageFactor: s.shrinkageFactor,
          freehaulDistanceMeters: s.freehaulDistanceMeters,
          overhaulUnitRateKes: s.overhaulUnitRateKes,
          borrowUnitRateKes: s.borrowUnitRateKes,
          totalCutVolumeM3: s.totalCutVolumeM3,
          totalFillVolumeM3: s.totalFillVolumeM3,
          netBalanceVolumeM3: s.netBalanceVolumeM3,
          totalOverhaulCostKes: s.totalOverhaulCostKes,
          economicHaulLimitMeters: s.economicHaulLimitMeters,
          status: s.status,
          stationCount: s.stationCount,
          createdAt: s.createdAt,
};
        try {
          const dres = await fetch(`/api/v1/projects/${projectId}/topographic-surveys/${s.id}`, { credentials: 'include'});
          if (dres.ok) {
            const detail = await dres.json();
            base.stations = ((detail.stations || []) as any[]).map((st) => ({
              id: st.id,
              stationIndex: st.stationIndex,
              chainageMeters: st.chainageMeters,
              chainageLabel: st.chainageLabel,
              existingGroundLevelM: st.existingGroundLevelM,
              proposedFormationLevelM: st.proposedFormationLevelM,
              depthCutOrFillM: st.depthCutOrFillM,
              cutAreaM2: st.cutAreaM2,
              fillAreaM2: st.fillAreaM2,
              midCutAreaM2: st.midCutAreaM2 ?? null,
              midFillAreaM2: st.midFillAreaM2 ?? null,
              intervalDistanceM: st.intervalDistanceM,
              intervalCutVolumeM3: st.intervalCutVolumeM3,
              intervalFillVolumeM3: st.intervalFillVolumeM3,
              intervalAdjustedFillM3: st.intervalAdjustedFillM3,
              intervalNetVolumeM3: st.intervalNetVolumeM3,
              cumulativeMassOrdinateM3: st.cumulativeMassOrdinateM3,
}));
}
} catch { /* keep survey without stations */}
        return base;
}));
      setSurveys(mapped);
      setSelectedSurveyId((prev) => (mapped.some((m) => m.id === prev) ? prev : (mapped[0]?.id ?? '')));
} catch {
      setSurveys([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Modal Dynamic Stations State
  const [formStations, setFormStations] = useState<Array<{
    chainageMeters: string;
    chainageLabel: string;
    existingGroundLevelM: string;
    proposedFormationLevelM: string;
    cutAreaM2: string;
    fillAreaM2: string;
    midCutAreaM2: string;
    midFillAreaM2: string;
}>>([
    {
      chainageMeters: '0.00',
      chainageLabel: 'Ch 0+000',
      existingGroundLevelM: '1850.500',
      proposedFormationLevelM: '1845.000',
      cutAreaM2: '45.000',
      fillAreaM2: '0.000',
      midCutAreaM2: '',
      midFillAreaM2: '',
},
    {
      chainageMeters: '50.00',
      chainageLabel: 'Ch 0+050',
      existingGroundLevelM: '1853.000',
      proposedFormationLevelM: '1845.000',
      cutAreaM2: '80.000',
      fillAreaM2: '0.000',
      midCutAreaM2: '60.000',
      midFillAreaM2: '',
},
    {
      chainageMeters: '1200.00',
      chainageLabel: 'Ch 1+200',
      existingGroundLevelM: '1845.000',
      proposedFormationLevelM: '1845.000',
      cutAreaM2: '0.000',
      fillAreaM2: '0.000',
      midCutAreaM2: '',
      midFillAreaM2: '',
},
  ]);

  const activeSurvey = surveys.find((s) => s.id === selectedSurveyId) || surveys[0];
  const stations = activeSurvey?.stations || [];

  const handleAddStationRow = () => {
    const lastStation = formStations[formStations.length - 1];
    const lastChainage = lastStation ? parseFloat(lastStation.chainageMeters) || 0 : 0;
    const newChainage = (lastChainage + 50).toFixed(2);
    setFormStations([
      ...formStations,
      {
        chainageMeters: newChainage,
        chainageLabel: `Ch ${Math.floor(parseFloat(newChainage) / 1000)}+${String(Math.floor(parseFloat(newChainage) % 1000)).padStart(3, '0')}`,
        existingGroundLevelM: '1845.000',
        proposedFormationLevelM: '1845.000',
        cutAreaM2: '0.000',
        fillAreaM2: '0.000',
        midCutAreaM2: '',
        midFillAreaM2: '',
},
    ]);
};

  const handleRemoveStationRow = (index: number) => {
    if (formStations.length<= 2) {
      setErrorBanner('Survey must contain at least 2 cross-section stations.');
      return;
}
    setFormStations(formStations.filter((_, i) => i !== index));
};

  const handleStationFieldChange = (index: number, field: string, value: string) => {
    const updated = [...formStations];
    const row = { ...updated[index]!, [field]: value};
    if (field === 'chainageMeters') {
      const num = parseFloat(value) || 0;
      row.chainageLabel = `Ch ${Math.floor(num / 1000)}+${String(Math.floor(num % 1000)).padStart(3, '0')}`;
}
    updated[index] = row;
    setFormStations(updated);
};

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (formStations.length< 2) {
      setErrorBanner('A topographic survey must have at least 2 cross-section stations.');
      return;
}

    setIsSubmitting(true);
    try {
      const payload = {
        surveyCode,
        title,
        surveyDate: new Date().toISOString(),
        surveyorName,
        instrumentType,
        calculationMethod,
        bulkingFactor: parseFloat(bulkingFactor) || 1.2,
        shrinkageFactor: parseFloat(shrinkageFactor) || 0.9,
        freehaulDistanceMeters: parseFloat(freehaulDistanceMeters) || 500,
        overhaulUnitRateKes: parseFloat(overhaulUnitRateKes) || 85,
        borrowUnitRateKes: parseFloat(borrowUnitRateKes) || 350,
        stations: formStations.map((st, idx) => ({
          stationIndex: idx,
          chainageMeters: parseFloat(st.chainageMeters) || 0,
          chainageLabel: st.chainageLabel,
          existingGroundLevelM: parseFloat(st.existingGroundLevelM) || 0,
          proposedFormationLevelM: parseFloat(st.proposedFormationLevelM) || 0,
          cutAreaM2: parseFloat(st.cutAreaM2) || 0,
          fillAreaM2: parseFloat(st.fillAreaM2) || 0,
          midCutAreaM2: st.midCutAreaM2 ? parseFloat(st.midCutAreaM2) : null,
          midFillAreaM2: st.midFillAreaM2 ? parseFloat(st.midFillAreaM2) : null,
})),
};

      if (isLive) {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/topographic-surveys`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
});
          if (res.ok) {
            const created = await res.json().catch(() => null);
            await reload();
            if (created?.id) setSelectedSurveyId(created.id);
            setShowModal(false);
            return;
}
} catch { /* fall through to local */}
}

      if (onRegisterSurvey) {
        await onRegisterSurvey(payload);
}

      // Local optimistic update
      const newId = `surv-${Date.now()}`;
      const fhd = parseFloat(freehaulDistanceMeters) || 500;
      const oRate = parseFloat(overhaulUnitRateKes) || 85;
      const bRate = parseFloat(borrowUnitRateKes) || 350;
      const elh = (fhd + (bRate / oRate)).toFixed(2);

      const computedLocalStations: CrossSectionStationRecord[] = [];
      let cumMass = 0;
      let totCut = 0;
      let totFill = 0;

      for (let i = 0; i< payload.stations.length; i++) {
        const curr = payload.stations[i]!;
        if (i === 0) {
          computedLocalStations.push({
            stationIndex: 0,
            chainageMeters: curr.chainageMeters.toFixed(2),
            chainageLabel: curr.chainageLabel,
            existingGroundLevelM: curr.existingGroundLevelM.toFixed(3),
            proposedFormationLevelM: curr.proposedFormationLevelM.toFixed(3),
            depthCutOrFillM: (curr.existingGroundLevelM - curr.proposedFormationLevelM).toFixed(3),
            cutAreaM2: curr.cutAreaM2.toFixed(3),
            fillAreaM2: curr.fillAreaM2.toFixed(3),
            midCutAreaM2: curr.midCutAreaM2 ? curr.midCutAreaM2.toFixed(3) : null,
            midFillAreaM2: curr.midFillAreaM2 ? curr.midFillAreaM2.toFixed(3) : null,
            intervalDistanceM: '0.00',
            intervalCutVolumeM3: '0.000',
            intervalFillVolumeM3: '0.000',
            intervalAdjustedFillM3: '0.000',
            intervalNetVolumeM3: '0.000',
            cumulativeMassOrdinateM3: '0.000',
});
} else {
          const prev = payload.stations[i - 1]!;
          const dist = curr.chainageMeters - prev.chainageMeters;
          const amCut = curr.midCutAreaM2 !== null ? curr.midCutAreaM2 : Math.pow((Math.sqrt(prev.cutAreaM2) + Math.sqrt(curr.cutAreaM2)) / 2, 2);
          const amFill = curr.midFillAreaM2 !== null ? curr.midFillAreaM2 : Math.pow((Math.sqrt(prev.fillAreaM2) + Math.sqrt(curr.fillAreaM2)) / 2, 2);
          const cutVol = (dist / 6) * (prev.cutAreaM2 + 4 * amCut + curr.cutAreaM2);
          const fillVol = (dist / 6) * (prev.fillAreaM2 + 4 * amFill + curr.fillAreaM2);
          const adjFill = fillVol / (parseFloat(shrinkageFactor) || 0.9);
          const netVol = cutVol - adjFill;
          cumMass += netVol;
          totCut += cutVol;
          totFill += fillVol;

          computedLocalStations.push({
            stationIndex: i,
            chainageMeters: curr.chainageMeters.toFixed(2),
            chainageLabel: curr.chainageLabel,
            existingGroundLevelM: curr.existingGroundLevelM.toFixed(3),
            proposedFormationLevelM: curr.proposedFormationLevelM.toFixed(3),
            depthCutOrFillM: (curr.existingGroundLevelM - curr.proposedFormationLevelM).toFixed(3),
            cutAreaM2: curr.cutAreaM2.toFixed(3),
            fillAreaM2: curr.fillAreaM2.toFixed(3),
            midCutAreaM2: curr.midCutAreaM2 ? curr.midCutAreaM2.toFixed(3) : null,
            midFillAreaM2: curr.midFillAreaM2 ? curr.midFillAreaM2.toFixed(3) : null,
            intervalDistanceM: dist.toFixed(2),
            intervalCutVolumeM3: cutVol.toFixed(3),
            intervalFillVolumeM3: fillVol.toFixed(3),
            intervalAdjustedFillM3: adjFill.toFixed(3),
            intervalNetVolumeM3: netVol.toFixed(3),
            cumulativeMassOrdinateM3: cumMass.toFixed(3),
});
}
}

      const totLength = payload.stations[payload.stations.length - 1]!.chainageMeters - payload.stations[0]!.chainageMeters;
      const overhaulDist = Math.max(0, totLength - fhd);
      const overhaulCost = (Math.max(0, cumMass) * (overhaulDist / 1000) * oRate).toFixed(2);

      const createdRecord: TopographicSurveyRecord = {
        id: newId,
        surveyCode,
        title,
        surveyDate: new Date().toISOString(),
        surveyorName,
        instrumentType,
        calculationMethod,
        bulkingFactor,
        shrinkageFactor,
        freehaulDistanceMeters,
        overhaulUnitRateKes,
        borrowUnitRateKes,
        totalCutVolumeM3: totCut.toFixed(3),
        totalFillVolumeM3: totFill.toFixed(3),
        netBalanceVolumeM3: cumMass.toFixed(3),
        totalOverhaulCostKes: overhaulCost,
        economicHaulLimitMeters: elh,
        status: 'COMPLETED',
        stationCount: computedLocalStations.length,
        stations: computedLocalStations,
        createdAt: new Date().toISOString(),
};

      setSurveys([createdRecord, ...surveys]);
      setSelectedSurveyId(newId);
      setShowModal(false);
} catch (err: any) {
      setErrorBanner(err.message || 'Failed to register topographic survey.');
} finally {
      setIsSubmitting(false);
}
};

  // Mass Haul Diagram SVG Rendering Math
  const renderMassHaulSvg = () => {
    if (stations.length< 2) return null;

    const svgWidth = 840;
    const svgHeight = 280;
    const padLeft = 80;
    const padRight = 40;
    const padTop = 30;
    const padBottom = 45;

    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;

    const chainageValues = stations.map((s) => Number(s.chainageMeters));
    const massValues = stations.map((s) => Number(s.cumulativeMassOrdinateM3 ?? 0));

    const minX = Math.min(...chainageValues);
    const maxX = Math.max(...chainageValues);
    const rawMinY = Math.min(...massValues);
    const rawMaxY = Math.max(...massValues);

    const spanY = Math.max(100, Math.max(Math.abs(rawMinY), Math.abs(rawMaxY)) * 1.2);
    const minY = -spanY;
    const maxY = spanY;

    const scaleX = (x: number) => padLeft + ((x - minX) / (maxX - minX || 1)) * plotWidth;
    const scaleY = (y: number) => padTop + ((maxY - y) / (maxY - minY || 1)) * plotHeight;

    const zeroY = scaleY(0);

    const points = stations.map((s) => ({
      x: scaleX(Number(s.chainageMeters)),
      y: scaleY(Number(s.cumulativeMassOrdinateM3 ?? 0)),
      chainage: Number(s.chainageMeters),
      mass: Number(s.cumulativeMassOrdinateM3 ?? 0),
      label: s.chainageLabel,
}));

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
}, '');

    // Cut surplus area (above 0 line)
    const cutAreaPath = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${Math.min(zeroY, pt.y)}` : `${acc} L ${pt.x} ${Math.min(zeroY, pt.y)}`;
}, '') + ` L ${points[points.length - 1]!.x} ${zeroY} L ${points[0]!.x} ${zeroY} Z`;

    // Fill deficit area (below 0 line)
    const fillAreaPath = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${Math.max(zeroY, pt.y)}` : `${acc} L ${pt.x} ${Math.max(zeroY, pt.y)}`;
}, '') + ` L ${points[points.length - 1]!.x} ${zeroY} L ${points[0]!.x} ${zeroY} Z`;

    // Detect balance points (crossing zero)
    const balancePoints: Array<{ x: number; y: number; chainageApprox: number}> = [];
    for (let i = 0; i< points.length - 1; i++) {
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      if ((p1.mass<= 0 && p2.mass >= 0) || (p1.mass >= 0 && p2.mass<= 0)) {
        if (p1.mass !== p2.mass) {
          const t = (0 - p1.mass) / (p2.mass - p1.mass);
          const crossX = p1.x + t * (p2.x - p1.x);
          const crossCh = p1.chainage + t * (p2.chainage - p1.chainage);
          balancePoints.push({ x: crossX, y: zeroY, chainageApprox: crossCh});
}
}
}

    return (
<svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto max-h-[320px] overflow-visible font-sans select-none"
        aria-label="Mass Haul Diagram"
      >
<defs>
<linearGradient id="cutSurplusGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
<stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
</linearGradient>
<linearGradient id="fillDeficitGrad" x1="0" y1="1" x2="0" y2="0">
<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
<stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
</linearGradient>
</defs>

        {/* Background Grid */}
<line
          x1={padLeft}
          y1={scaleY(maxY * 0.5)}
          x2={svgWidth - padRight}
          y2={scaleY(maxY * 0.5)}
          stroke="#e2e8f0"
          strokeDasharray="4 4"
        />
<line
          x1={padLeft}
          y1={scaleY(minY * 0.5)}
          x2={svgWidth - padRight}
          y2={scaleY(minY * 0.5)}
          stroke="#e2e8f0"
          strokeDasharray="4 4"
        />

        {/* Shaded Cut Surplus Area */}
<path d={cutAreaPath} fill="url(#cutSurplusGrad)" />

        {/* Shaded Fill Deficit Area */}
<path d={fillAreaPath} fill="url(#fillDeficitGrad)" />

        {/* Zero Datum Axis */}
<line
          x1={padLeft}
          y1={zeroY}
          x2={svgWidth - padRight}
          y2={zeroY}
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeDasharray="6 3"
        />
<text
          x={padLeft - 10}
          y={zeroY + 4}
          textAnchor="end"
          className="text-[10px] font-mono fill-slate-700 font-bold"
        >
          0 m³ (Datum)
</text>

        {/* Y Axis Max & Min labels */}
<text
          x={padLeft - 10}
          y={padTop + 10}
          textAnchor="end"
          className="text-[10px] font-mono fill-emerald-600 font-semibold"
        >
          +{Math.round(maxY)} m³
</text>
<text
          x={padLeft - 10}
          y={svgHeight - padBottom}
          textAnchor="end"
          className="text-[10px] font-mono fill-rose-600 font-semibold"
        >
          {Math.round(minY)} m³
</text>

        {/* Mass Haul Curve Line */}
<path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />

        {/* Station Nodes & Balance Points */}
        {points.map((pt, idx) => (
<g key={`station-${idx}`}>
<circle cx={pt.x} cy={pt.y} r="4" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.5" />
            {/* Station chainage tick */}
<line x1={pt.x} y1={zeroY - 4} x2={pt.x} y2={zeroY + 4} stroke="#64748b" strokeWidth="1" />
<text
              x={pt.x}
              y={svgHeight - padBottom + 18}
              textAnchor="middle"
              className="text-[10px] font-mono fill-slate-600"
            >
              {pt.label}
</text>
</g>
))}

        {/* Balance Points with markers */}
        {balancePoints.map((bp, bIdx) => (
<g key={`bp-${bIdx}`}>
<circle cx={bp.x} cy={bp.y} r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
<text
              x={bp.x}
              y={bp.y - 10}
              textAnchor="middle"
              className="text-[9px] font-bold font-mono fill-amber-700 bg-white"
            >
              BP Ch {Math.round(bp.chainageApprox)}m
</text>
</g>
))}
</svg>
);
};

  const netBalanceNum = Number(activeSurvey?.netBalanceVolumeM3 ?? 0);
  const isCutSurplus = netBalanceNum >= 0;

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading topographic surveys...</div>;
}

  return (
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header and Controls */}
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
<div>
<div className="flex items-center gap-2">
<span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-lg"></span>
<h2 className="text-xl font-bold text-slate-900">
              Survey &amp; Topographic Cut/Fill Earthworks Engine
</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
            Milestone M31 • Simpson&apos;s 1/3 Rule, Prismoidal Corrections, Mass Haul Diagram &amp; KeNHA Economic Overhaul
</p>
</div>

<div className="flex flex-wrap items-center gap-3">
          {surveys.length > 1 && (
<select
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              aria-label="Select Topographic Survey"
            >
              {surveys.map((s) => (
<option key={s.id} value={s.id}>
                  {s.surveyCode} - {s.title}
</option>
))}
</select>
)}

<button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-sm shadow-indigo-200"
          >
<span>+</span>
<span>New Topographic Survey</span>
</button>
</div>
</div>

      {/* Project Banner & Survey Metadata */}
      {activeSurvey && (
<div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
<div>
<span className="text-slate-500 font-medium">Project:</span>{' '}
<span className="font-semibold text-slate-900">{projectName}</span>
<span className="mx-2 text-slate-300">|</span>
<span className="text-slate-500 font-medium">Survey Code:</span>{' '}
<span className="font-mono font-semibold text-indigo-700">{activeSurvey.surveyCode}</span>
<span className="mx-2 text-slate-300">|</span>
<span className="text-slate-500 font-medium">Title:</span>{' '}
<span className="font-medium text-slate-800">{activeSurvey.title}</span>
</div>
<div className="flex items-center gap-3">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
              {activeSurvey.instrumentType}
</span>
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
              Method: {activeSurvey.calculationMethod}
</span>
<span className="text-slate-500">
              Surveyor:<strong className="text-slate-700">{activeSurvey.surveyorName}</strong>
</span>
</div>
</div>
)}

      {/* Cut/Fill Summary Metrics */}
      {activeSurvey && (
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Total Cut Volume */}
<div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-emerald-700">
<span className="text-xs font-semibold ">Total Cut Volume</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold font-mono text-emerald-950">
              {Number(activeSurvey.totalCutVolumeM3).toLocaleString('en-KE', { minimumFractionDigits: 3})}
<span className="text-xs font-sans font-normal text-emerald-700 ml-1">m³ bank</span>
</p>
<p className="text-[11px] text-emerald-600">Bulking: {activeSurvey.bulkingFactor}x loose</p>
</div>

          {/* 2. Total Fill Volume */}
<div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-rose-700">
<span className="text-xs font-semibold ">Total Fill Volume</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold font-mono text-rose-950">
              {Number(activeSurvey.totalFillVolumeM3).toLocaleString('en-KE', { minimumFractionDigits: 3})}
<span className="text-xs font-sans font-normal text-rose-700 ml-1">m³ compact</span>
</p>
<p className="text-[11px] text-rose-600">Shrinkage: {activeSurvey.shrinkageFactor}x bank</p>
</div>

          {/* 3. Net Balance */}
<div className={`rounded-xl p-4 border space-y-1 ${
            isCutSurplus ? 'bg-amber-50/70 border-amber-200' : 'bg-indigo-50/70 border-indigo-200'
}`}>
<div className="flex items-center justify-between">
<span className={`text-xs font-semibold ${
                isCutSurplus ? 'text-amber-700' : 'text-indigo-700'
}`}>
                Net Earthwork Balance
</span>
<span className="text-lg">{isCutSurplus ? '' : ''}</span>
</div>
<p className={`text-xl font-bold font-mono ${
              isCutSurplus ? 'text-amber-950' : 'text-indigo-950'
}`}>
              {netBalanceNum > 0 ? `+${netBalanceNum.toLocaleString('en-KE', { minimumFractionDigits: 3})}` : netBalanceNum.toLocaleString('en-KE', { minimumFractionDigits: 3})}
<span className="text-xs font-sans font-normal ml-1">m³</span>
</p>
<p className={`text-[11px] font-medium ${isCutSurplus ? 'text-amber-700' : 'text-indigo-700'}`}>
              {isCutSurplus ? 'Surplus Cut (Haul to Spoil)' : 'Deficit Fill (Borrow Required)'}
</p>
</div>

          {/* 4. Economic Limit of Haul */}
<div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-blue-700">
<span className="text-xs font-semibold ">Economic Haul Limit</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold font-mono text-blue-950">
              {Number(activeSurvey.economicHaulLimitMeters).toFixed(2)}
<span className="text-xs font-sans font-normal text-blue-700 ml-1">m</span>
</p>
<p className="text-[11px] text-blue-600">Freehaul (FHD): {activeSurvey.freehaulDistanceMeters}m</p>
</div>

          {/* 5. Total Overhaul Cost */}
<div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-slate-700">
<span className="text-xs font-semibold ">Total Overhaul Cost</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold font-mono text-slate-900">
              KES {Number(activeSurvey.totalOverhaulCostKes).toLocaleString('en-KE', { minimumFractionDigits: 2})}
</p>
<p className="text-[11px] text-slate-500">Rate: KES {activeSurvey.overhaulUnitRateKes}/m³-km</p>
</div>
</div>
)}

      {/* Mass Haul Diagram Card */}
<div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div>
<h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
<span></span>
<span>Mass Haul Diagram (MHD)</span>
</h3>
<p className="text-xs text-slate-500">
              Cumulative mass ordinate curve vs alignment chainage with cut surplus (+) and fill deficit (-) regions.
</p>
</div>
<div className="flex items-center gap-4 text-xs font-medium">
<span className="inline-flex items-center gap-1.5 text-emerald-700">
<span className="w-3 h-3 rounded bg-emerald-400 opacity-60"></span>
<span>Cut Surplus</span>
</span>
<span className="inline-flex items-center gap-1.5 text-rose-700">
<span className="w-3 h-3 rounded bg-rose-400 opacity-60"></span>
<span>Fill Deficit</span>
</span>
<span className="inline-flex items-center gap-1.5 text-amber-700">
<span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
<span>Balance Point (BP)</span>
</span>
</div>
</div>

<div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center">
          {renderMassHaulSvg()}
</div>
</div>

      {/* Station Takeoff Entry Table */}
<div className="space-y-3">
<div className="flex items-center justify-between">
<h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
<span></span>
<span>Cross-Section Stations Takeoff Table</span>
</h3>
<span className="text-xs text-slate-500">
            {stations.length} Station{stations.length === 1 ? '' : 's'} Computed
</span>
</div>

<div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
<table className="w-full text-left text-xs">
<thead className="bg-slate-100/80 text-slate-700 font-semibold text-[11px] border-b border-slate-200">
<tr>
<th className="py-3 px-3">#</th>
<th className="py-3 px-3">Chainage</th>
<th className="py-3 px-3">EGL (m)</th>
<th className="py-3 px-3">PFL (m)</th>
<th className="py-3 px-3">Depth Cut/Fill</th>
<th className="py-3 px-3">Cut Area (m²)</th>
<th className="py-3 px-3">Fill Area (m²)</th>
<th className="py-3 px-3">Mid-Area (m²)</th>
<th className="py-3 px-3">Int. Dist (m)</th>
<th className="py-3 px-3">Int. Cut (m³)</th>
<th className="py-3 px-3">Int. Fill (m³)</th>
<th className="py-3 px-3 text-right">Cum. Mass (m³)</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {stations.map((st) => {
                const depth = Number(st.depthCutOrFillM ?? 0);
                const isCut = depth >= 0;
                return (
<tr key={st.stationIndex} className="hover:bg-slate-50/70 transition">
<td className="py-2.5 px-3 font-semibold text-slate-500">{st.stationIndex}</td>
<td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">{st.chainageLabel}</td>
<td className="py-2.5 px-3 text-slate-700">{Number(st.existingGroundLevelM).toFixed(3)}</td>
<td className="py-2.5 px-3 text-slate-700">{Number(st.proposedFormationLevelM).toFixed(3)}</td>
<td className="py-2.5 px-3">
<span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isCut ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
}`}>
                        {isCut ? `+${depth.toFixed(3)} m (Cut)` : `${depth.toFixed(3)} m (Fill)`}
</span>
</td>
<td className="py-2.5 px-3 text-emerald-700 font-semibold">{Number(st.cutAreaM2).toFixed(3)}</td>
<td className="py-2.5 px-3 text-rose-700 font-semibold">{Number(st.fillAreaM2).toFixed(3)}</td>
<td className="py-2.5 px-3 text-slate-500">
                      {st.midCutAreaM2 ? `Cut: ${Number(st.midCutAreaM2).toFixed(2)}` : st.midFillAreaM2 ? `Fill: ${Number(st.midFillAreaM2).toFixed(2)}` : '-'}
</td>
<td className="py-2.5 px-3 text-slate-600">{Number(st.intervalDistanceM ?? 0).toFixed(2)}</td>
<td className="py-2.5 px-3 text-emerald-800">{Number(st.intervalCutVolumeM3 ?? 0).toFixed(3)}</td>
<td className="py-2.5 px-3 text-rose-800">{Number(st.intervalFillVolumeM3 ?? 0).toFixed(3)}</td>
<td className={`py-2.5 px-3 text-right font-bold ${
                      Number(st.cumulativeMassOrdinateM3 ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
}`}>
                      {Number(st.cumulativeMassOrdinateM3 ?? 0) >= 0 ? `+${Number(st.cumulativeMassOrdinateM3 ?? 0).toFixed(3)}` : Number(st.cumulativeMassOrdinateM3 ?? 0).toFixed(3)}
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>

      {/* Accessible Create Survey Modal */}
      {showModal && (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-survey-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
<div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
<div className="flex items-center justify-between p-5 border-b border-slate-100">
<div className="flex items-center gap-2">
<span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg text-lg"></span>
<div>
<h3 id="create-survey-modal-title" className="text-lg font-bold text-slate-900">
                    New Topographic Survey &amp; Earthwork Takeoff
</h3>
<p className="text-xs text-slate-500">
                    Input cross-section station elevations, cut/fill areas and calculate mass haul balancing
</p>
</div>
</div>
<button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-lg"
                aria-label="Close dialog"
              >
                
</button>
</div>

            {/* Error Alert Banner */}
            {errorBanner && (
<div role="alert" className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
<div className="flex items-center gap-2">
<span></span>
<span>{errorBanner}</span>
</div>
<button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="text-rose-600 hover:text-rose-800 font-bold ml-2"
                >
                  
</button>
</div>
)}

            {/* Form */}
<form onSubmit={handleSubmitSurvey} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* General Metadata Fields */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
<div>
<label htmlFor="surveyCode" className="block text-xs font-semibold text-slate-700 mb-1">
                    Survey Code *
</label>
<input
                    id="surveyCode"
                    type="text"
                    required
                    value={surveyCode}
                    onChange={(e) => setSurveyCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="E.g. SURV-RD-A104-001"
                  />
</div>

<div>
<label htmlFor="surveyTitle" className="block text-xs font-semibold text-slate-700 mb-1">
                    Survey Title *
</label>
<input
                    id="surveyTitle"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="E.g. Alignment Earthwork Takeoff"
                  />
</div>

<div>
<label htmlFor="surveyorName" className="block text-xs font-semibold text-slate-700 mb-1">
                    Surveyor Name *
</label>
<input
                    id="surveyorName"
                    type="text"
                    required
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="E.g. Surv. Geoffrey Kiprop"
                  />
</div>

<div>
<label htmlFor="instrumentType" className="block text-xs font-semibold text-slate-700 mb-1">
                    Instrument Type
</label>
<select
                    id="instrumentType"
                    value={instrumentType}
                    onChange={(e: any) => setInstrumentType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
<option value="TOTAL_STATION">TOTAL_STATION (Leica TS16)</option>
<option value="RTK_GNSS">RTK_GNSS (Trimble R12)</option>
<option value="DRONE_LIDAR">DRONE_LIDAR (DJI Matrice 350)</option>
<option value="AUTO_LEVEL">AUTO_LEVEL (Optical Level)</option>
</select>
</div>

<div>
<label htmlFor="calcMethod" className="block text-xs font-semibold text-slate-700 mb-1">
                    Calculation Method
</label>
<select
                    id="calcMethod"
                    value={calculationMethod}
                    onChange={(e: any) => setCalculationMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
<option value="PRISMOIDAL">Prismoidal Formula (BS 6031 / KeNHA)</option>
<option value="AVERAGE_END_AREA">Average End-Area Method</option>
<option value="SIMPSONS_RULE">Simpson&apos;s 1/3 Rule</option>
</select>
</div>

<div>
<label htmlFor="bulkingFactor" className="block text-xs font-semibold text-slate-700 mb-1">
                    Bulking Factor (Loose)
</label>
<input
                    id="bulkingFactor"
                    type="number"
                    step="0.01"
                    min="1.0"
                    value={bulkingFactor}
                    onChange={(e) => setBulkingFactor(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>

<div>
<label htmlFor="shrinkageFactor" className="block text-xs font-semibold text-slate-700 mb-1">
                    Shrinkage Factor (Compacted)
</label>
<input
                    id="shrinkageFactor"
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="1.0"
                    value={shrinkageFactor}
                    onChange={(e) => setShrinkageFactor(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>

<div>
<label htmlFor="freehaulDistance" className="block text-xs font-semibold text-slate-700 mb-1">
                    Freehaul Distance (m)
</label>
<input
                    id="freehaulDistance"
                    type="number"
                    step="10"
                    min="0"
                    value={freehaulDistanceMeters}
                    onChange={(e) => setFreehaulDistanceMeters(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>

<div>
<label htmlFor="overhaulRate" className="block text-xs font-semibold text-slate-700 mb-1">
                    Overhaul Rate (KES/m³-km)
</label>
<input
                    id="overhaulRate"
                    type="number"
                    step="1"
                    min="0.1"
                    value={overhaulUnitRateKes}
                    onChange={(e) => setOverhaulUnitRateKes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>

<div>
<label htmlFor="borrowRate" className="block text-xs font-semibold text-slate-700 mb-1">
                    Borrow Pit Rate (KES/m³)
</label>
<input
                    id="borrowRate"
                    type="number"
                    step="1"
                    min="0.1"
                    value={borrowUnitRateKes}
                    onChange={(e) => setBorrowUnitRateKes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
</div>
</div>

              {/* Station Rows Input */}
<div className="space-y-3 pt-2">
<div className="flex items-center justify-between">
<h4 className="text-xs font-bold text-slate-800 ">
                    Cross-Section Stations Takeoff ({formStations.length} Stations)
</h4>
<button
                    type="button"
                    onClick={handleAddStationRow}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
<span>+ Add Station</span>
</button>
</div>

<div className="overflow-x-auto border border-slate-200 rounded-xl">
<table className="w-full text-left text-xs">
<thead className="bg-slate-100/70 text-slate-600 font-semibold text-[10px]">
<tr>
<th className="p-2">#</th>
<th className="p-2">Chainage (m)</th>
<th className="p-2">Label</th>
<th className="p-2">EGL (m)</th>
<th className="p-2">PFL (m)</th>
<th className="p-2">Cut Area (m²)</th>
<th className="p-2">Fill Area (m²)</th>
<th className="p-2">Mid-Cut (m²)</th>
<th className="p-2">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
                      {formStations.map((st, idx) => (
<tr key={idx} className="hover:bg-slate-50">
<td className="p-2 font-mono text-slate-400">{idx}</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              value={st.chainageMeters}
                              onChange={(e) => handleStationFieldChange(idx, 'chainageMeters', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="text"
                              value={st.chainageLabel}
                              onChange={(e) => handleStationFieldChange(idx, 'chainageLabel', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.001"
                              value={st.existingGroundLevelM}
                              onChange={(e) => handleStationFieldChange(idx, 'existingGroundLevelM', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.001"
                              value={st.proposedFormationLevelM}
                              onChange={(e) => handleStationFieldChange(idx, 'proposedFormationLevelM', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              min="0"
                              value={st.cutAreaM2}
                              onChange={(e) => handleStationFieldChange(idx, 'cutAreaM2', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono text-emerald-700 font-semibold focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              min="0"
                              value={st.fillAreaM2}
                              onChange={(e) => handleStationFieldChange(idx, 'fillAreaM2', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono text-rose-700 font-semibold focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Opt. Am"
                              value={st.midCutAreaM2}
                              onChange={(e) => handleStationFieldChange(idx, 'midCutAreaM2', e.target.value)}
                              className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono text-slate-600 focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<button
                              type="button"
                              onClick={() => handleRemoveStationRow(idx)}
                              className="text-slate-400 hover:text-rose-600 font-bold p-1 text-sm"
                              title="Delete station"
                            >
                              
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>

              {/* Form Actions */}
<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-200 flex items-center gap-2"
                >
                  {isSubmitting ? (
<>
<span className="animate-spin text-xs">⏳</span>
<span>Computing Volumes...</span>
</>
) : (
<span>Compute Earthworks &amp; Save Takeoff</span>
)}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};

export default TopographicSurveyView;
