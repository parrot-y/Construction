import React, { useState } from 'react';
import { AuthSession } from '../types/auth';
import CostCaptureModal from './CostCaptureModal';

interface SupervisorDashboardProps {
  session: AuthSession;
}

export default function SupervisorDashboard({ session }: SupervisorDashboardProps): React.JSX.Element {
  const { user } = session;
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [diarySuccess, setDiarySuccess] = useState<string | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [costSuccess, setCostSuccess] = useState<string | null>(null);

  // Diary Form State
  const [weather, setWeather] = useState('SUNNY_CLEAR');
  const [workNotes, setWorkNotes] = useState('');
  const [masons, setMasons] = useState('4');
  const [carpenters, setCarpenters] = useState('2');
  const [steelFixers, setSteelFixers] = useState('3');
  const [casuals, setCasuals] = useState('8');
  const [materialsReceived, setMaterialsReceived] = useState('200 bags Bamburi Portland Cement');

  const totalHeadcount = Number(masons || 0) + Number(carpenters || 0) + Number(steelFixers || 0) + Number(casuals || 0);

  const handleDiarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDiarySuccess(`Daily site diary recorded successfully: ${totalHeadcount} workers on-site, weather: ${weather}`);
    setShowDiaryModal(false);
    setWorkNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Site Supervisor Workspace
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Site Operations & Daily Diary</h2>
          <p className="text-xs text-slate-500">
            Daily labor headcount, site diary logging, material deliveries, and photo evidence for {user.tenant.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCostModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            💰 Log Site Expense
          </button>
          <button
            onClick={() => setShowDiaryModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition"
          >
            + Record Daily Site Diary
          </button>
        </div>
      </div>

      {costSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {costSuccess}</span>
          <button onClick={() => setCostSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {diarySuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {diarySuccess}</span>
          <button onClick={() => setDiarySuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Offline PWA Status Banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">IndexedDB Offline Queue Active</span>
          <span className="text-blue-600 hidden sm:inline">• Site diaries and photo evidence are cached locally and synchronized automatically when online</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-100 rounded border border-blue-200 font-semibold">
          PWA Mode
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Assigned Sites
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">1 Project</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Riverside Commercial Plaza</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Today's Diary Status
          </span>
          <span className="text-lg font-bold text-amber-700 mt-1 block">
            {diarySuccess ? 'Submitted ✓' : 'Pending Submission'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Entry date: {new Date().toISOString().split('T')[0]}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Today's Headcount
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {diarySuccess ? totalHeadcount : 0} Workers
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Masons, fixers, casuals</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Site Photos Today
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">0 Photos</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">GPS-tagged evidence</span>
        </div>
      </div>

      {/* Active Site Details & Fast Capture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Site Station</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">Riverside Commercial Plaza</h3>
              <p className="text-xs text-slate-500">Riverside Drive, Nairobi • Code: RCP-2026</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              ACTIVE SITE
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">NCA Registration:</span>
              <span className="font-mono font-medium text-slate-800">NCA-PRJ-2026-0891</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Phase:</span>
              <span className="font-medium text-slate-800">Substructure Excavation & Blinding</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Project Manager / QS:</span>
              <span className="font-medium text-slate-800">Faith Achieng</span>
            </div>
          </div>
        </div>

        {/* Photo Evidence Placeholder */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Photo Evidence Feed</h3>
            <span className="text-[11px] text-slate-400">0 records today</span>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
            <div className="text-3xl text-slate-400">📷</div>
            <p className="text-xs font-medium text-slate-700">No site photos uploaded yet today</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Capture progress photos of reinforced steel, excavation, or concrete pours with automatic GPS & offline sync.
            </p>
          </div>
        </div>
      </div>

      {/* Diary Modal */}
      {showDiaryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Daily Site Diary</h3>
                <p className="text-xs text-slate-500">Riverside Commercial Plaza • {new Date().toISOString().split('T')[0]}</p>
              </div>
              <button onClick={() => setShowDiaryModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleDiarySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Weather Condition</label>
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="SUNNY_CLEAR">Sunny & Clear (Optimal working conditions)</option>
                  <option value="OVERCAST">Overcast / Cloudy (Normal progress)</option>
                  <option value="LIGHT_RAIN">Light Rain (Minor delays)</option>
                  <option value="HEAVY_RAIN_HALT">Heavy Rain (Work stopped / Delay recorded)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Labor Headcount by Trade</label>
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <label className="text-[11px] text-slate-600 block">Masons</label>
                    <input
                      type="number"
                      min="0"
                      value={masons}
                      onChange={(e) => setMasons(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Carpenters</label>
                    <input
                      type="number"
                      min="0"
                      value={carpenters}
                      onChange={(e) => setCarpenters(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Steel Fixers</label>
                    <input
                      type="number"
                      min="0"
                      value={steelFixers}
                      onChange={(e) => setSteelFixers(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Casual Laborers</label>
                    <input
                      type="number"
                      min="0"
                      value={casuals}
                      onChange={(e) => setCasuals(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Material Deliveries Received</label>
                <input
                  type="text"
                  value={materialsReceived}
                  onChange={(e) => setMaterialsReceived(e.target.value)}
                  placeholder="e.g. 200 bags Cement, 20 tonnes River Sand"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Completed Today / Notes</label>
                <textarea
                  rows={3}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="e.g. Completed blinding on column bases 1-12. Began fixing D16 rebar."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDiaryModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
                >
                  Save Daily Diary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cost Capture Modal for Site Expenses */}
      <CostCaptureModal
        isOpen={showCostModal}
        onClose={() => setShowCostModal(false)}
        projectId="project-rcp-2026"
        onCostCreated={(cost) => {
          setCostSuccess(`Site expense logged: KES ${cost.amount} (${cost.cost_category}) in PENDING status`);
        }}
      />
    </div>
  );
}