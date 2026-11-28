import React from 'react';
import type {
  CrossSectionStationRecord,
  TopographicSurveyRecord,
} from './TopographicSurveyView';

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
