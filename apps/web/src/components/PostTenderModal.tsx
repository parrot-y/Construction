import React from 'react';

export const PostTenderModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newTitle: string;
  setNewTitle: React.Dispatch<React.SetStateAction<string>>;
  newCategory: string;
  setNewCategory: React.Dispatch<React.SetStateAction<string>>;
  newBudgetKes: string;
  setNewBudgetKes: React.Dispatch<React.SetStateAction<string>>;
  newDeadline: string;
  setNewDeadline: React.Dispatch<React.SetStateAction<string>>;
  newNca: string;
  setNewNca: React.Dispatch<React.SetStateAction<string>>;
  newScope: string;
  setNewScope: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  newTitle,
  setNewTitle,
  newCategory,
  setNewCategory,
  newBudgetKes,
  setNewBudgetKes,
  newDeadline,
  setNewDeadline,
  newNca,
  setNewNca,
  newScope,
  setNewScope,
}) => (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<div>
<span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                  EASMM Commercial Studio
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Post New Contractor Tender</h3>
</div>
<button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
</button>
</div>

<form onSubmit={onSubmit} className="space-y-3.5 text-xs">
<div>
<label htmlFor="tender-title" className="block font-semibold text-slate-700 mb-1">
                  Tender Package Title:
</label>
<input
                  id="tender-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Electrical 1st and 2nd Fix Reticulation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="tender-category" className="block font-semibold text-slate-700 mb-1">
                    Trade Category:
</label>
<select
                    id="tender-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
<option value="Structural Works">Structural Works</option>
<option value="Mechanical & Water Works">Mechanical &amp; Water Works</option>
<option value="Electrical & Solar Works">Electrical &amp; Solar Works</option>
<option value="Finishes & Façade">Finishes &amp; Façade</option>
<option value="Roofing & Waterproofing">Roofing &amp; Waterproofing</option>
<option value="Civil Earthworks & Paving">Civil Earthworks &amp; Paving</option>
</select>
</div>

<div>
<label htmlFor="tender-nca" className="block font-semibold text-slate-700 mb-1">
                    NCA Category Required:
</label>
<select
                    id="tender-nca"
                    value={newNca}
                    onChange={(e) => setNewNca(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
<option value="NCA 1 (Unlimited)">NCA 1 (Unlimited)</option>
<option value="NCA 2 (Up to 500M)">NCA 2 (Up to 500M)</option>
<option value="NCA 3 (Up to 300M)">NCA 3 (Up to 300M)</option>
<option value="NCA 4 (Up to 150M)">NCA 4 (Up to 150M)</option>
<option value="NCA 5 (Up to 50M)">NCA 5 (Up to 50M)</option>
<option value="NCA 6 (Up to 20M)">NCA 6 (Up to 20M)</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="tender-budget" className="block font-semibold text-slate-700 mb-1">
                    Estimated Budget (KES):
</label>
<input
                    id="tender-budget"
                    type="text"
                    required
                    value={newBudgetKes}
                    onChange={(e) => setNewBudgetKes(e.target.value)}
                    placeholder="e.g. 5000000.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
</div>

<div>
<label htmlFor="tender-deadline" className="block font-semibold text-slate-700 mb-1">
                    Submission Deadline:
</label>
<input
                    id="tender-deadline"
                    type="date"
                    required
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
</div>
</div>

<div>
<label htmlFor="tender-scope" className="block font-semibold text-slate-700 mb-1">
                  Scope of Works Description:
</label>
<textarea
                  id="tender-scope"
                  rows={3}
                  required
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  placeholder="Detail the technical specifications, delivery milestones, and quality standards."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                  data-testid="confirm-post-tender-btn"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  Publish Tender Package
</button>
</div>
</form>
</div>
</div>
);
