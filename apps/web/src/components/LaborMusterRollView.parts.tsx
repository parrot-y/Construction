import React from 'react';
import { formatKes } from '../ui';
import type {
  LaborMusterRollItem,
  SiteLaborerItem,
} from './LaborMusterRollView';

export interface LaborAttendanceEntry {
  laborerId: string;
  daysWorked: string;
  overtimeHours: string;
  taskAssigned: string;
}

export const LaborHeaderControls: React.FC<{
  projectName: string;
  onAddWorker: () => void;
  onCreateRoll: () => void;
}> = ({ projectName, onAddWorker, onCreateRoll }) => (
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
<div>
<h2 className="text-xl font-bold text-gray-900">
            Site Casual Labor Muster Roll &amp; Artisan Payroll
</h2>
<p className="text-sm text-gray-500">
            {projectName} • Fundi &amp; Casual worker register with National ID validation and M-Pesa bulk disbursement
</p>
</div>
<div className="flex items-center gap-2">
<button
            onClick={onAddWorker}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Register Artisan / Casual
</button>
<button
            onClick={onCreateRoll}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Compile Weekly Muster Roll
</button>
</div>
</div>
);

export const LaborKpiCards: React.FC<{
  summary: {
    totalWorkers: number;
    activeWorkers: number;
    fundisCount: number;
    casualsCount: number;
  };
  musterRollsList: LaborMusterRollItem[];
  totalDisbursedKes: number;
}> = ({ summary, musterRollsList, totalDisbursedKes }) => (
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
            Total Workforce Registered
</span>
<p className="text-2xl font-bold text-gray-900 mt-1">
            {summary.totalWorkers} Workers
</p>
<span className="text-xs text-indigo-600 font-medium">
            100% Kenyan National ID Verified
</span>
</div>

<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
            Skill Breakdown (Fundis vs Casuals)
</span>
<p className="text-2xl font-bold text-gray-900 mt-1">
            {summary.fundisCount} Fundis / {summary.casualsCount} Casuals
</p>
<span className="text-xs text-gray-500">Masons, Carpenters &amp; Watu wa Mkono</span>
</div>

<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
            Pending QS Verification
</span>
<p className="text-2xl font-bold text-amber-600 mt-1">
            {musterRollsList.filter((r) => r.status === 'PENDING_VERIFICATION').length} Rolls
</p>
<span className="text-xs text-gray-500">Awaiting supervisor &amp; QS signoff</span>
</div>

<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-semibold text-gray-500 ">
            Total Wages Disbursed
</span>
<p className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
            {formatKes(totalDisbursedKes)}
</p>
<span className="text-xs text-emerald-700 font-medium">M-Pesa B2C Bulk Mobile Payroll</span>
</div>
</div>
);

export const LaborTabs: React.FC<{
  activeTab: 'MUSTER_ROLLS' | 'WORKERS_ROSTER';
  setActiveTab: React.Dispatch<React.SetStateAction<'MUSTER_ROLLS' | 'WORKERS_ROSTER'>>;
  musterRollsCount: number;
  workersCount: number;
}> = ({ activeTab, setActiveTab, musterRollsCount, workersCount }) => (
<div className="flex border-b border-gray-200 gap-6">
<button
          onClick={() => setActiveTab('MUSTER_ROLLS')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'MUSTER_ROLLS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
}`}
        >
          Weekly Muster Rolls ({musterRollsCount})
</button>
<button
          onClick={() => setActiveTab('WORKERS_ROSTER')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'WORKERS_ROSTER'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
}`}
        >
          Laborer Registry ({workersCount})
</button>
</div>
);

export const MusterRollsTable: React.FC<{
  musterRollsList: LaborMusterRollItem[];
  onReviewRoll: (roll: LaborMusterRollItem) => void;
}> = ({ musterRollsList, onReviewRoll }) => (
<div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 text-left text-sm">
<thead className="bg-gray-50 text-gray-700 font-semibold">
<tr>
<th className="px-4 py-3">Payroll No / Week Ending</th>
<th className="px-4 py-3">Workers</th>
<th className="px-4 py-3">Total Man-Days</th>
<th className="px-4 py-3">Gross Wages (KES)</th>
<th className="px-4 py-3">Net Payable (KES)</th>
<th className="px-4 py-3">Status</th>
<th className="px-4 py-3">M-Pesa Reference / Approval</th>
<th className="px-4 py-3 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-200">
                {musterRollsList.map((roll) => (
<tr key={roll.id} className="hover:bg-gray-50 transition">
<td className="px-4 py-3 font-medium text-gray-900">
<div>{roll.payrollNo}</div>
<div className="text-xs text-gray-500">Week Ending: {roll.weekEndingDate}</div>
</td>
<td className="px-4 py-3 text-gray-700">
<span className="font-semibold text-gray-900">{roll.totalWorkers}</span> artisans
</td>
<td className="px-4 py-3 tabular-nums text-gray-900 font-bold">
                      {roll.totalManDays} days
</td>
<td className="px-4 py-3 tabular-nums text-gray-700">
                      {formatKes(roll.grossWagesKes)}
</td>
<td className="px-4 py-3 tabular-nums font-bold text-gray-900">
                      {formatKes(roll.netWagesPayableKes)}
</td>
<td className="px-4 py-3">
                      {roll.status === 'DISBURSED' ? (
<span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                           DISBURSED
</span>
) : roll.status === 'QS_APPROVED' ? (
<span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                          QS APPROVED
</span>
) : (
<span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          PENDING QS SIGN-OFF
</span>
)}
</td>
<td className="px-4 py-3 text-xs text-gray-600">
                      {roll.disbursementReference ? (
<div>
<span className="tabular-nums font-semibold text-emerald-700">{roll.disbursementReference}</span>
<span className="block text-gray-400">Disbursed on {roll.disbursedAt?.split('T')[0]}</span>
</div>
) : roll.approvedBy ? (
<div>
<span className="text-gray-900 font-medium">Approved by:</span> {roll.approvedBy}
</div>
) : (
<span className="text-gray-400 italic">Awaiting certification</span>
)}
</td>
<td className="px-4 py-3 text-right">
                      {roll.status !== 'DISBURSED' && (
<button
                          onClick={() => onReviewRoll(roll)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition"
                        >
                          Review / Disburse
</button>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);

export const WorkersRosterTable: React.FC<{ laborerList: SiteLaborerItem[] }> = ({ laborerList }) => (
<div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 text-left text-sm">
<thead className="bg-gray-50 text-gray-700 font-semibold">
<tr>
<th className="px-4 py-3">Code / Full Name</th>
<th className="px-4 py-3">National ID No</th>
<th className="px-4 py-3">Phone (M-Pesa)</th>
<th className="px-4 py-3">Trade / Skill</th>
<th className="px-4 py-3">Daily Wage Rate (KES)</th>
<th className="px-4 py-3">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-200">
                {laborerList.map((worker) => (
<tr key={worker.id} className="hover:bg-gray-50 transition">
<td className="px-4 py-3 font-medium text-gray-900">
<div>{worker.fullName}</div>
<div className="text-xs text-gray-500 font-mono tabular-nums">{worker.workerCode}</div>
</td>
<td className="px-4 py-3 tabular-nums font-medium text-gray-900">
<span className="px-2 py-0.5 rounded bg-gray-100 border text-xs">
                        ID: {worker.nationalIdNo}
</span>
</td>
<td className="px-4 py-3 tabular-nums text-gray-700 text-xs">
                      {worker.phoneNumber}
</td>
<td className="px-4 py-3">
<span className="font-semibold text-gray-900 text-xs block">
                        {worker.tradeCategory}
</span>
<span className="text-xs text-gray-500">
                        {worker.skillLevel.replace(/_/g, ' ')}
</span>
</td>
<td className="px-4 py-3 tabular-nums font-bold text-gray-900">
                      {formatKes(worker.dailyRateKes)} / day
</td>
<td className="px-4 py-3">
<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        ACTIVE
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);

export const AddWorkerModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  workerCode: string;
  setWorkerCode: React.Dispatch<React.SetStateAction<string>>;
  fullName: string;
  setFullName: React.Dispatch<React.SetStateAction<string>>;
  nationalIdNo: string;
  setNationalIdNo: React.Dispatch<React.SetStateAction<string>>;
  phoneNumber: string;
  setPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  tradeCategory: string;
  setTradeCategory: React.Dispatch<React.SetStateAction<string>>;
  skillLevel: 'CASUAL_MTU_WA_MKONO' | 'SEMI_SKILLED' | 'ARTISAN_FUNDI' | 'CHARGEHAND_FOREMAN';
  setSkillLevel: React.Dispatch<React.SetStateAction<'CASUAL_MTU_WA_MKONO' | 'SEMI_SKILLED' | 'ARTISAN_FUNDI' | 'CHARGEHAND_FOREMAN'>>;
  dailyRateKes: string;
  setDailyRateKes: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  workerCode,
  setWorkerCode,
  fullName,
  setFullName,
  nationalIdNo,
  setNationalIdNo,
  phoneNumber,
  setPhoneNumber,
  tradeCategory,
  setTradeCategory,
  skillLevel,
  setSkillLevel,
  dailyRateKes,
  setDailyRateKes,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">
                Register Artisan / Casual Laborer
</h3>
<button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4">
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Worker Code
</label>
<input
                    type="text"
                    required
                    value={workerCode}
                    onChange={(e) => setWorkerCode(e.target.value)}
                    placeholder="e.g. LAB-MSN-02"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name (as per ID)
</label>
<input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Peter Otieno Mwangi"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kenyan National ID No
</label>
<input
                    type="text"
                    required
                    value={nationalIdNo}
                    onChange={(e) => setNationalIdNo(e.target.value)}
                    placeholder="e.g. 29841520"
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    M-Pesa Mobile Number
</label>
<input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+2547XXXXXXXX"
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Trade Category
</label>
<select
                    value={tradeCategory}
                    onChange={(e) => setTradeCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
<option value="MASON">Mason (Fundi wa Mawe)</option>
<option value="CARPENTER">Carpenter (Seremala)</option>
<option value="STEEL_FIXER">Steel Fixer (Fundi Chuma)</option>
<option value="PLUMBER">Plumber</option>
<option value="ELECTRICIAN">Electrician</option>
<option value="PAINTER">Painter</option>
<option value="TILER">Tiler</option>
<option value="CASUAL_LABORER">Casual Laborer (Mtu wa Mkono)</option>
<option value="SCAFFOLDER">Scaffolder</option>
<option value="FOREMAN">Foreman / Nyapara</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Skill Level
</label>
<select
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
<option value="ARTISAN_FUNDI">Artisan Fundi (Certified)</option>
<option value="SEMI_SKILLED">Semi-Skilled Assistant</option>
<option value="CASUAL_MTU_WA_MKONO">Casual (Mtu wa Mkono)</option>
<option value="CHARGEHAND_FOREMAN">Chargehand / Foreman</option>
</select>
</div>
</div>

<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                  Daily Wage Rate (KES / Day)
</label>
<input
                  type="text"
                  required
                  value={dailyRateKes}
                  onChange={(e) => setDailyRateKes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
                />
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
                >
                  Save Worker
</button>
</div>
</form>
</div>
</div>
);

export const CreateMusterRollModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  payrollNo: string;
  setPayrollNo: React.Dispatch<React.SetStateAction<string>>;
  weekEndingDate: string;
  setWeekEndingDate: React.Dispatch<React.SetStateAction<string>>;
  rollNotes: string;
  setRollNotes: React.Dispatch<React.SetStateAction<string>>;
  attendanceEntries: LaborAttendanceEntry[];
  setAttendanceEntries: React.Dispatch<React.SetStateAction<LaborAttendanceEntry[]>>;
  laborerList: SiteLaborerItem[];
}> = ({
  onClose,
  onSubmit,
  payrollNo,
  setPayrollNo,
  weekEndingDate,
  setWeekEndingDate,
  rollNotes,
  setRollNotes,
  attendanceEntries,
  setAttendanceEntries,
  laborerList,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">
                Compile Weekly Labor Muster Roll
</h3>
<button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4">
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payroll No
</label>
<input
                    type="text"
                    required
                    value={payrollNo}
                    onChange={(e) => setPayrollNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    Week Ending Date
</label>
<input
                    type="date"
                    required
                    value={weekEndingDate}
                    onChange={(e) => setWeekEndingDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
</div>
</div>

<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                  Muster Roll Notes / Site Location
</label>
<input
                  type="text"
                  value={rollNotes}
                  onChange={(e) => setRollNotes(e.target.value)}
                  placeholder="e.g. Superstructure Level 3 columns and masonry"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
</div>

<div>
<label className="block text-xs font-bold text-gray-900 mb-2">
                  Worker Attendances &amp; Overtime Computation
</label>
<div className="space-y-3">
                  {attendanceEntries.map((att, idx) => (
<div key={idx} className="p-3 bg-gray-50 border rounded-lg grid grid-cols-12 gap-2 items-center text-xs">
<div className="col-span-4">
<label className="font-semibold text-gray-700 block mb-1">Artisan / Casual</label>
<select
                          value={att.laborerId}
                          onChange={(e) => {
                            const updated = [...attendanceEntries];
                            if (updated[idx]) {
                              updated[idx] = { ...updated[idx], laborerId: e.target.value};
                              setAttendanceEntries(updated);
}
}}
                          className="w-full px-2 py-1.5 border rounded bg-white"
                        >
                          {laborerList.map((l) => (
<option key={l.id} value={l.id}>
                              {l.fullName} ({l.tradeCategory}) - {formatKes(l.dailyRateKes)}
</option>
))}
</select>
</div>
<div className="col-span-2">
<label className="font-semibold text-gray-700 block mb-1">Days Worked</label>
<input
                          type="text"
                          value={att.daysWorked}
                          onChange={(e) => {
                            const updated = [...attendanceEntries];
                            if (updated[idx]) {
                              updated[idx] = { ...updated[idx], daysWorked: e.target.value};
                              setAttendanceEntries(updated);
}
}}
                          className="w-full px-2 py-1.5 border rounded tabular-nums"
                        />
</div>
<div className="col-span-2">
<label className="font-semibold text-gray-700 block mb-1">OT (Hrs 1.5x)</label>
<input
                          type="text"
                          value={att.overtimeHours}
                          onChange={(e) => {
                            const updated = [...attendanceEntries];
                            if (updated[idx]) {
                              updated[idx] = { ...updated[idx], overtimeHours: e.target.value};
                              setAttendanceEntries(updated);
}
}}
                          className="w-full px-2 py-1.5 border rounded tabular-nums"
                        />
</div>
<div className="col-span-4">
<label className="font-semibold text-gray-700 block mb-1">Task Assigned</label>
<input
                          type="text"
                          value={att.taskAssigned}
                          onChange={(e) => {
                            const updated = [...attendanceEntries];
                            if (updated[idx]) {
                              updated[idx] = { ...updated[idx], taskAssigned: e.target.value};
                              setAttendanceEntries(updated);
}
}}
                          placeholder="Task notes"
                          className="w-full px-2 py-1.5 border rounded"
                        />
</div>
</div>
))}
</div>
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
                >
                  Save &amp; Submit for QS Verification
</button>
</div>
</form>
</div>
</div>
);

export const ReviewDisburseModal: React.FC<{
  roll: LaborMusterRollItem;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  reviewStatus: 'QS_APPROVED' | 'DISBURSED' | 'REJECTED';
  setReviewStatus: React.Dispatch<React.SetStateAction<'QS_APPROVED' | 'DISBURSED' | 'REJECTED'>>;
  disbursementRef: string;
  setDisbursementRef: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  roll,
  onClose,
  onSubmit,
  reviewStatus,
  setReviewStatus,
  disbursementRef,
  setDisbursementRef,
}) => (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
<div className="flex justify-between items-center border-b pb-3">
<h3 className="text-lg font-bold text-gray-900">
                Review &amp; Disburse Muster Roll
</h3>
<button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
</button>
</div>
<form onSubmit={onSubmit} className="space-y-4">
<div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
<div>
<span className="font-semibold text-gray-700">Payroll:</span> {roll.payrollNo}
</div>
<div>
<span className="font-semibold text-gray-700">Net Payable:</span>{' '}
<span className="font-bold text-emerald-700 tabular-nums">
                    {formatKes(roll.netWagesPayableKes)}
</span>
</div>
<div>
<span className="font-semibold text-gray-700">Artisans:</span> {roll.totalWorkers} workers
</div>
</div>

<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                  Action Decision
</label>
<select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
<option value="QS_APPROVED">QS Approved (Ready for Payment)</option>
<option value="DISBURSED">Disbursed (Trigger M-Pesa B2C Payout)</option>
<option value="REJECTED">Reject for Rectification</option>
</select>
</div>

              {reviewStatus === 'DISBURSED' && (
<div>
<label className="block text-xs font-semibold text-gray-700 mb-1">
                    M-Pesa B2C / Bank Reference
</label>
<input
                    type="text"
                    required
                    value={disbursementRef}
                    onChange={(e) => setDisbursementRef(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm tabular-nums"
                  />
</div>
)}

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
                >
                  Confirm Decision
</button>
</div>
</form>
</div>
</div>
);
