import React, { useState} from 'react';

export interface ConcreteCubeTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  onTestCreated?: (test: any) => void;
}

export default function ConcreteCubeTestModal({
  isOpen,
  onClose,
  projectId = 'project-rcp-2026',
  projectName = '',
  onTestCreated,
}: ConcreteCubeTestModalProps): React.JSX.Element | null {
  const [pourLocation, setPourLocation] = useState('');
  const [concreteClass, setConcreteClass] = useState('Class 25/20 (25 MPa)');
  const [pourDate, setPourDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchTicket, setBatchTicket] = useState('');
  const [slumpMm, setSlumpMm] = useState('100');
  const [sevenDayStrengthMpa, setSevenDayStrengthMpa] = useState('');
  const [twentyEightDayStrengthMpa, setTwentyEightDayStrengthMpa] = useState('');
  const [testingLab, setTestingLab] = useState('Site Hydraulic Press / MTRD Nairobi');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pourLocation.trim()) {
      setError('Pour location is required (e.g. Ground Floor Slab Grid 2-4)');
      return;
}

    setIsSubmitting(true);
    setError(null);

    // Extract target MPa from class string, default 25
    let targetMpa = 25;
    if (concreteClass.includes('20 MPa')) targetMpa = 20;
    else if (concreteClass.includes('30 MPa')) targetMpa = 30;
    else if (concreteClass.includes('35 MPa')) targetMpa = 35;

    const sevenDayParsed = sevenDayStrengthMpa ? parseFloat(sevenDayStrengthMpa) : null;
    const twentyEightDayParsed = twentyEightDayStrengthMpa ? parseFloat(twentyEightDayStrengthMpa) : null;

    let status: 'PENDING_7DAY' | 'PENDING_28DAY' | 'PASS' | 'FAIL' = 'PENDING_7DAY';
    if (twentyEightDayParsed !== null) {
      status = twentyEightDayParsed >= targetMpa ? 'PASS' : 'FAIL';
} else if (sevenDayParsed !== null) {
      status = 'PENDING_28DAY';
}

    const pourTime = new Date(pourDate);
    const day7 = new Date(pourTime.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const day28 = new Date(pourTime.getTime() + 28 * 86400000).toISOString().slice(0, 10);

    const newTest = {
      id: `cube-${Date.now()}`,
      projectId,
      testNo: `CUBE-2026-${Math.floor(Math.random() * 900) + 100}`,
      pourLocation: pourLocation.trim(),
      concreteClass: concreteClass.split(' ')[0], // e.g."Class 25/20"
      targetStrengthMpa: targetMpa,
      pourDate,
      batchTicket: batchTicket.trim(),
      slumpMm: parseInt(slumpMm, 10) || 100,
      sevenDayBreakDate: day7,
      sevenDayStrengthMpa: sevenDayParsed,
      twentyEightDayBreakDate: day28,
      twentyEightDayStrengthMpa: twentyEightDayParsed,
      status,
      testingLab: testingLab.trim(),
};

    if (onTestCreated) {
      onTestCreated(newTest);
}

    setIsSubmitting(false);
    setPourLocation('');
    setBatchTicket('');
    setSevenDayStrengthMpa('');
    setTwentyEightDayStrengthMpa('');
    onClose();
};

  return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
<div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
<div>
<span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              KS 02-598 / BS EN 12390-3
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">
              Log Concrete Cube Crushing Test
</h3>
<p className="text-xs text-slate-500">{projectName}</p>
</div>
<button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition text-lg leading-none"
            aria-label="Close"
          >
            
</button>
</div>

        {/* Form */}
<form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2">
<span></span>
<span>{error}</span>
</div>
)}

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Pour Structural Location<span className="text-rose-500">*</span>
</label>
<input
              type="text"
              value={pourLocation}
              onChange={(e) => setPourLocation(e.target.value)}
              placeholder="e.g. Ground Floor Suspended Slab (Grid B2 - F4)"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              required
            />
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Concrete Class & Target<span className="text-rose-500">*</span>
</label>
<select
                value={concreteClass}
                onChange={(e) => setConcreteClass(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
              >
<option value="Class 25/20 (25 MPa)">Class 25/20 (25 MPa Target)</option>
<option value="Class 30/20 (30 MPa)">Class 30/20 (30 MPa Target)</option>
<option value="Class 35/20 (35 MPa)">Class 35/20 (35 MPa Target)</option>
<option value="Class 20/20 (20 MPa)">Class 20/20 (20 MPa Blinding/Mass)</option>
</select>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Pour Date<span className="text-rose-500">*</span>
</label>
<input
                type="date"
                value={pourDate}
                onChange={(e) => setPourDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                required
              />
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Batch Delivery Ticket #
</label>
<input
                type="text"
                value={batchTicket}
                onChange={(e) => setBatchTicket(e.target.value)}
                placeholder="e.g. Bamburi ReadyMix #BRM-4892"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
                Site Slump Result (mm)
</label>
<input
                type="number"
                value={slumpMm}
                onChange={(e) => setSlumpMm(e.target.value)}
                placeholder="e.g. 100"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
</div>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
<span className="text-[11px] font-bold text-slate-700 block">
              Hydraulic Press Compressive Break Values (MPa)
</span>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  7-Day Test Strength (MPa)
</label>
<input
                  type="number"
                  step="0.1"
                  value={sevenDayStrengthMpa}
                  onChange={(e) => setSevenDayStrengthMpa(e.target.value)}
                  placeholder="e.g. 18.5 (~70% req.)"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                />
</div>

<div>
<label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  28-Day Final Strength (MPa)
</label>
<input
                  type="number"
                  step="0.1"
                  value={twentyEightDayStrengthMpa}
                  onChange={(e) => setTwentyEightDayStrengthMpa(e.target.value)}
                  placeholder="e.g. 27.8 (Target ≥ 25)"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                />
</div>
</div>
<p className="text-[11px] text-slate-400">
              Leave blank if test cubes are still in curing tank awaiting schedule date.
</p>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">
              Accredited Testing Facility
</label>
<input
              type="text"
              value={testingLab}
              onChange={(e) => setTestingLab(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
            />
</div>

<div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
<button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
</button>
<button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record Cube Test'}
</button>
</div>
</form>
</div>
</div>
);
}
