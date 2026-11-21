import React from 'react';
import type {
  CrossSectionStationRecord,
  TopographicSurveyRecord,
} from './TopographicSurveyView';

export interface TopographicSurveyFormStation {
  chainageMeters: string;
  chainageLabel: string;
  existingGroundLevelM: string;
  proposedFormationLevelM: string;
  cutAreaM2: string;
  fillAreaM2: string;
  midCutAreaM2: string;
  midFillAreaM2: string;
}

export const DEFAULT_STATIONS: CrossSectionStationRecord[] = [
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

export const DEFAULT_SURVEYS: TopographicSurveyRecord[] = [
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

export const SurveyHeaderControls: React.FC<{
  surveys: TopographicSurveyRecord[];
  selectedSurveyId: string;
  setSelectedSurveyId: React.Dispatch<React.SetStateAction<string>>;
  onNewSurvey: () => void;
}> = ({ surveys, selectedSurveyId, setSelectedSurveyId, onNewSurvey }) => (
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
            onClick={onNewSurvey}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-sm shadow-indigo-200"
          >
<span>+</span>
<span>New Topographic Survey</span>
</button>
</div>
</div>
);

export const SurveyMetadataBanner: React.FC<{
  activeSurvey: TopographicSurveyRecord | undefined;
  projectName: string;
}> = ({ activeSurvey, projectName }) =>
  activeSurvey ? (
<div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
<div>
<span className="text-slate-500 font-medium">Project:</span>{' '}
<span className="font-semibold text-slate-900">{projectName}</span>
<span className="mx-2 text-slate-300">|</span>
<span className="text-slate-500 font-medium">Survey Code:</span>{' '}
<span className="tabular-nums font-semibold text-indigo-700">{activeSurvey.surveyCode}</span>
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
) : null;

const MassHaulDiagramSvg: React.FC<{ stations: CrossSectionStationRecord[] }> = ({ stations }) => {
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
          className="text-[10px] tabular-nums fill-slate-700 font-bold"
        >
          0 m³ (Datum)
</text>

        {/* Y Axis Max & Min labels */}
<text
          x={padLeft - 10}
          y={padTop + 10}
          textAnchor="end"
          className="text-[10px] tabular-nums fill-emerald-600 font-semibold"
        >
          +{Math.round(maxY)} m³
</text>
<text
          x={padLeft - 10}
          y={svgHeight - padBottom}
          textAnchor="end"
          className="text-[10px] tabular-nums fill-rose-600 font-semibold"
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
              className="text-[10px] tabular-nums fill-slate-600"
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
              className="text-[9px] font-bold tabular-nums fill-amber-700 bg-white"
            >
              BP Ch {Math.round(bp.chainageApprox)}m
</text>
</g>
))}
</svg>
);
};

export const MassHaulDiagramCard: React.FC<{ stations: CrossSectionStationRecord[] }> = ({ stations }) => (
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
          <MassHaulDiagramSvg stations={stations} />
</div>
</div>
);

export const CreateSurveyModal: React.FC<{
  onClose: () => void;
  onClearError: () => void;
  errorBanner: string | null;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  surveyCode: string;
  setSurveyCode: React.Dispatch<React.SetStateAction<string>>;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  surveyorName: string;
  setSurveyorName: React.Dispatch<React.SetStateAction<string>>;
  instrumentType: 'TOTAL_STATION' | 'RTK_GNSS' | 'DRONE_LIDAR' | 'AUTO_LEVEL';
  setInstrumentType: React.Dispatch<React.SetStateAction<'TOTAL_STATION' | 'RTK_GNSS' | 'DRONE_LIDAR' | 'AUTO_LEVEL'>>;
  calculationMethod: 'AVERAGE_END_AREA' | 'PRISMOIDAL' | 'SIMPSONS_RULE';
  setCalculationMethod: React.Dispatch<React.SetStateAction<'AVERAGE_END_AREA' | 'PRISMOIDAL' | 'SIMPSONS_RULE'>>;
  bulkingFactor: string;
  setBulkingFactor: React.Dispatch<React.SetStateAction<string>>;
  shrinkageFactor: string;
  setShrinkageFactor: React.Dispatch<React.SetStateAction<string>>;
  freehaulDistanceMeters: string;
  setFreehaulDistanceMeters: React.Dispatch<React.SetStateAction<string>>;
  overhaulUnitRateKes: string;
  setOverhaulUnitRateKes: React.Dispatch<React.SetStateAction<string>>;
  borrowUnitRateKes: string;
  setBorrowUnitRateKes: React.Dispatch<React.SetStateAction<string>>;
  formStations: TopographicSurveyFormStation[];
  onAddStation: () => void;
  onRemoveStation: (index: number) => void;
  onStationFieldChange: (index: number, field: string, value: string) => void;
}> = ({
  onClose,
  onClearError,
  errorBanner,
  onSubmit,
  isSubmitting,
  surveyCode,
  setSurveyCode,
  title,
  setTitle,
  surveyorName,
  setSurveyorName,
  instrumentType,
  setInstrumentType,
  calculationMethod,
  setCalculationMethod,
  bulkingFactor,
  setBulkingFactor,
  shrinkageFactor,
  setShrinkageFactor,
  freehaulDistanceMeters,
  setFreehaulDistanceMeters,
  overhaulUnitRateKes,
  setOverhaulUnitRateKes,
  borrowUnitRateKes,
  setBorrowUnitRateKes,
  formStations,
  onAddStation,
  onRemoveStation,
  onStationFieldChange,
}) => (
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
                onClick={onClose}
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
                  onClick={onClearError}
                  className="text-rose-600 hover:text-rose-800 font-bold ml-2"
                >
                  
</button>
</div>
)}

            {/* Form */}
<form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
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
                    onClick={onAddStation}
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
<td className="p-2 tabular-nums text-slate-400">{idx}</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              value={st.chainageMeters}
                              onChange={(e) => onStationFieldChange(idx, 'chainageMeters', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="text"
                              value={st.chainageLabel}
                              onChange={(e) => onStationFieldChange(idx, 'chainageLabel', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.001"
                              value={st.existingGroundLevelM}
                              onChange={(e) => onStationFieldChange(idx, 'existingGroundLevelM', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.001"
                              value={st.proposedFormationLevelM}
                              onChange={(e) => onStationFieldChange(idx, 'proposedFormationLevelM', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              min="0"
                              value={st.cutAreaM2}
                              onChange={(e) => onStationFieldChange(idx, 'cutAreaM2', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums text-emerald-700 font-semibold focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              min="0"
                              value={st.fillAreaM2}
                              onChange={(e) => onStationFieldChange(idx, 'fillAreaM2', e.target.value)}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums text-rose-700 font-semibold focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Opt. Am"
                              value={st.midCutAreaM2}
                              onChange={(e) => onStationFieldChange(idx, 'midCutAreaM2', e.target.value)}
                              className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg tabular-nums text-slate-600 focus:ring-1 focus:ring-indigo-500"
                            />
</td>
<td className="p-2">
<button
                              type="button"
                              onClick={() => onRemoveStation(idx)}
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
                  onClick={onClose}
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
);
