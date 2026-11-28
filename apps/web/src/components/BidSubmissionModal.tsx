import React from 'react';

export const BidSubmissionModal: React.FC<{
  tenderTitle: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  bidContractorName: string;
  setBidContractorName: React.Dispatch<React.SetStateAction<string>>;
  bidNcaCategory: string;
  setBidNcaCategory: React.Dispatch<React.SetStateAction<string>>;
  bidAmountKes: string;
  setBidAmountKes: React.Dispatch<React.SetStateAction<string>>;
  bidDurationWeeks: number;
  setBidDurationWeeks: React.Dispatch<React.SetStateAction<number>>;
  bidLabor: string;
  setBidLabor: React.Dispatch<React.SetStateAction<string>>;
  bidMaterials: string;
  setBidMaterials: React.Dispatch<React.SetStateAction<string>>;
  bidPlant: string;
  setBidPlant: React.Dispatch<React.SetStateAction<string>>;
  bidPrelims: string;
  setBidPrelims: React.Dispatch<React.SetStateAction<string>>;
  bidContactPerson: string;
  setBidContactPerson: React.Dispatch<React.SetStateAction<string>>;
  bidContactPhone: string;
  setBidContactPhone: React.Dispatch<React.SetStateAction<string>>;
  bidPastProjects: string;
  setBidPastProjects: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  tenderTitle,
  onClose,
  onSubmit,
  bidContractorName,
  setBidContractorName,
  bidNcaCategory,
  setBidNcaCategory,
  bidAmountKes,
  setBidAmountKes,
  bidDurationWeeks,
  setBidDurationWeeks,
  bidLabor,
  setBidLabor,
  bidMaterials,
  setBidMaterials,
  bidPlant,
  setBidPlant,
  bidPrelims,
  setBidPrelims,
  bidContactPerson,
  setBidContactPerson,
  bidContactPhone,
  setBidContactPhone,
  bidPastProjects,
  setBidPastProjects,
}) => (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Subcontractor / Contractor Bidding
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
                  Submit Bid: {tenderTitle}
</h3>
</div>
<button
                onClick={onClose}
                className="text-slate-600 hover:text-slate-600 font-bold text-lg"
              >
                ×
</button>
</div>

<form onSubmit={onSubmit} className="space-y-3.5 text-xs">
<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="bid-contractor-name" className="block font-semibold text-slate-700 mb-1">
                    Contractor Enterprise Name:
</label>
<input
                    id="bid-contractor-name"
                    type="text"
                    required
                    value={bidContractorName}
                    onChange={(e) => setBidContractorName(e.target.value)}
                    placeholder="e.g. Coast Engineering Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
</div>

<div>
<label htmlFor="bid-nca-cat" className="block font-semibold text-slate-700 mb-1">
                    NCA Category:
</label>
<select
                    id="bid-nca-cat"
                    value={bidNcaCategory}
                    onChange={(e) => setBidNcaCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
<option value="NCA 1">NCA 1</option>
<option value="NCA 2">NCA 2</option>
<option value="NCA 3">NCA 3</option>
<option value="NCA 4">NCA 4</option>
<option value="NCA 5">NCA 5</option>
<option value="NCA 6">NCA 6</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="bid-amount-kes" className="block font-semibold text-slate-700 mb-1">
                    Total Lump-Sum Bid (KES):
</label>
<input
                    id="bid-amount-kes"
                    type="text"
                    required
                    value={bidAmountKes}
                    onChange={(e) => setBidAmountKes(e.target.value)}
                    placeholder="e.g. 18000000.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
</div>

<div>
<label htmlFor="bid-duration-weeks" className="block font-semibold text-slate-700 mb-1">
                    Execution Duration (Weeks):
</label>
<input
                    id="bid-duration-weeks"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={bidDurationWeeks}
                    onChange={(e) => setBidDurationWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
</div>
</div>

              {/* Trade breakdown inputs */}
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
<span className="font-bold text-slate-800 block text-[11px]">
                  BOQ Trade Component Breakdown (KES):
</span>
<div className="grid grid-cols-2 gap-2 text-[11px]">
<div>
<label className="block text-slate-600 mb-0.5">Direct Labor (KES):</label>
<input
                      type="text"
                      value={bidLabor}
                      onChange={(e) => setBidLabor(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                    />
</div>
<div>
<label className="block text-slate-600 mb-0.5">Materials Supply (KES):</label>
<input
                      type="text"
                      value={bidMaterials}
                      onChange={(e) => setBidMaterials(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                    />
</div>
<div>
<label className="block text-slate-600 mb-0.5">Plant &amp; Equipment (KES):</label>
<input
                      type="text"
                      value={bidPlant}
                      onChange={(e) => setBidPlant(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                    />
</div>
<div>
<label className="block text-slate-600 mb-0.5">Preliminaries (KES):</label>
<input
                      type="text"
                      value={bidPrelims}
                      onChange={(e) => setBidPrelims(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                    />
</div>
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="bid-contact-person" className="block font-semibold text-slate-700 mb-1">
                    Contact Representative:
</label>
<input
                    id="bid-contact-person"
                    type="text"
                    required
                    value={bidContactPerson}
                    onChange={(e) => setBidContactPerson(e.target.value)}
                    placeholder="e.g. Eng. Peter Otieno"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
</div>

<div>
<label htmlFor="bid-contact-phone" className="block font-semibold text-slate-700 mb-1">
                    Official Mobile / WhatsApp:
</label>
<input
                    id="bid-contact-phone"
                    type="text"
                    required
                    value={bidContactPhone}
                    onChange={(e) => setBidContactPhone(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
</div>
</div>

<div>
<label htmlFor="bid-past-projects" className="block font-semibold text-slate-700 mb-1">
                  Track Record &amp; Similar Works:
</label>
<textarea
                  id="bid-past-projects"
                  rows={2}
                  required
                  value={bidPastProjects}
                  onChange={(e) => setBidPastProjects(e.target.value)}
                  placeholder="e.g. Executed structural frame for Westlands Heights and Parklands commercial plaza."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold"
                >
                  Cancel
</button>
<button
                  type="submit"
                  data-testid="confirm-submit-bid-btn"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  Submit Responsive Bid
</button>
</div>
</form>
</div>
</div>
);
