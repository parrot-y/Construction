import React from 'react';

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
