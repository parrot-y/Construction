import React, { useEffect, useState} from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { DEFAULT_SURVEYS, SurveyHeaderControls, SurveyMetadataBanner } from './TopographicSurveyView.parts';
import { MassHaulDiagramCard } from './MassHaulDiagram';
import { CreateSurveyModal } from './TopographicSurveyModal';

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
      const list = await api.get<any>(`/api/v1/projects/${projectId}/topographic-surveys`);
      const mapped = await Promise.all(list.map(async (s: any) => {
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
          const detail = await api.get<any>(`/api/v1/projects/${projectId}/topographic-surveys/${s.id}`);
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
          const created = await api.post<any>(`/api/v1/projects/${projectId}/topographic-surveys`, payload);
          await reload();
          if (created?.id) setSelectedSurveyId(created.id);
          setShowModal(false);
          return;
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
} catch (err) {
      setErrorBanner(apiErrorMessage(err, 'Failed to register topographic survey.'));
} finally {
      setIsSubmitting(false);
}
};
  const netBalanceNum = Number(activeSurvey?.netBalanceVolumeM3 ?? 0);
  const isCutSurplus = netBalanceNum >= 0;

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading topographic surveys...</div>;
}
  return (
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header and Controls */}
<SurveyHeaderControls
        surveys={surveys}
        selectedSurveyId={selectedSurveyId}
        setSelectedSurveyId={setSelectedSurveyId}
        onNewSurvey={() => setShowModal(true)}
      />

      {/* Project Banner & Survey Metadata */}
<SurveyMetadataBanner activeSurvey={activeSurvey} projectName={projectName} />

      {/* Cut/Fill Summary Metrics */}
      {activeSurvey && (
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Total Cut Volume */}
<div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-emerald-700">
<span className="text-xs font-semibold ">Total Cut Volume</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold tabular-nums text-emerald-950">
              {Number(activeSurvey.totalCutVolumeM3).toLocaleString('en-KE', { minimumFractionDigits: 3})}
<span className="text-xs font-sans font-normal text-emerald-700 ml-1">m³ bank</span>
</p>
<p className="text-[11px] text-emerald-700">Bulking: {activeSurvey.bulkingFactor}x loose</p>
</div>

          {/* 2. Total Fill Volume */}
<div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-rose-700">
<span className="text-xs font-semibold ">Total Fill Volume</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold tabular-nums text-rose-950">
              {Number(activeSurvey.totalFillVolumeM3).toLocaleString('en-KE', { minimumFractionDigits: 3})}
<span className="text-xs font-sans font-normal text-rose-700 ml-1">m³ compact</span>
</p>
<p className="text-[11px] text-rose-700">Shrinkage: {activeSurvey.shrinkageFactor}x bank</p>
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
<p className={`text-xl font-bold tabular-nums ${
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
<p className="text-xl font-bold tabular-nums text-blue-950">
              {Number(activeSurvey.economicHaulLimitMeters).toFixed(2)}
<span className="text-xs font-sans font-normal text-blue-700 ml-1">m</span>
</p>
<p className="text-[11px] text-blue-700">Freehaul (FHD): {activeSurvey.freehaulDistanceMeters}m</p>
</div>

          {/* 5. Total Overhaul Cost */}
<div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-1">
<div className="flex items-center justify-between text-slate-700">
<span className="text-xs font-semibold ">Total Overhaul Cost</span>
<span className="text-lg"></span>
</div>
<p className="text-xl font-bold tabular-nums text-slate-900">
              KES {Number(activeSurvey.totalOverhaulCostKes).toLocaleString('en-KE', { minimumFractionDigits: 2})}
</p>
<p className="text-[11px] text-slate-500">Rate: KES {activeSurvey.overhaulUnitRateKes}/m³-km</p>
</div>
</div>
)}

      {/* Mass Haul Diagram Card */}
<MassHaulDiagramCard stations={stations} />

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
<CreateSurveyModal
          onClose={() => setShowModal(false)}
          onClearError={() => setErrorBanner(null)}
          errorBanner={errorBanner}
          onSubmit={handleSubmitSurvey}
          isSubmitting={isSubmitting}
          surveyCode={surveyCode}
          setSurveyCode={setSurveyCode}
          title={title}
          setTitle={setTitle}
          surveyorName={surveyorName}
          setSurveyorName={setSurveyorName}
          instrumentType={instrumentType}
          setInstrumentType={setInstrumentType}
          calculationMethod={calculationMethod}
          setCalculationMethod={setCalculationMethod}
          bulkingFactor={bulkingFactor}
          setBulkingFactor={setBulkingFactor}
          shrinkageFactor={shrinkageFactor}
          setShrinkageFactor={setShrinkageFactor}
          freehaulDistanceMeters={freehaulDistanceMeters}
          setFreehaulDistanceMeters={setFreehaulDistanceMeters}
          overhaulUnitRateKes={overhaulUnitRateKes}
          setOverhaulUnitRateKes={setOverhaulUnitRateKes}
          borrowUnitRateKes={borrowUnitRateKes}
          setBorrowUnitRateKes={setBorrowUnitRateKes}
          formStations={formStations}
          onAddStation={handleAddStationRow}
          onRemoveStation={handleRemoveStationRow}
          onStationFieldChange={handleStationFieldChange}
        />
)}
</div>
);
};

export default TopographicSurveyView;
