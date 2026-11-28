import React from 'react';
import type { PlantMaintenanceAlertItem } from './PlantTelematicsView';

export const AcknowledgeAlertModal: React.FC<{
  alert: PlantMaintenanceAlertItem;
  ackError: string | null;
  ackBy: string;
  setAckBy: React.Dispatch<React.SetStateAction<string>>;
  ackNotes: string;
  setAckNotes: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isAcking: boolean;
}> = ({ alert, ackError, ackBy, setAckBy, ackNotes, setAckNotes, onSubmit, onClose, isAcking }) => (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ack-alert-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<div>
<h3 id="ack-alert-modal-title" className="font-bold text-slate-800 text-base">
                  Acknowledge Plant Maintenance Alert
</h3>
<p className="text-xs text-slate-500 mt-0.5">
                  Confirm receipt of alert {alert.alertCode} and record engineering actions
</p>
</div>
<button
                onClick={onClose}
                aria-label="Close dialog"
                className="text-slate-600 hover:text-slate-600 font-bold p-1 text-base"
              >
                
</button>
</div>

            {ackError && (
<div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {ackError}
</div>
)}

<div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
<div className="font-bold text-slate-800">{alert.title}</div>
<div className="text-slate-600">{alert.description}</div>
<div className="text-slate-500 text-[11px]">
                Machine: {alert.equipmentName} ({alert.equipmentCode}) • Severity: {alert.severity}
</div>
</div>

<form onSubmit={onSubmit} className="space-y-3 text-xs">
<div>
<label htmlFor="ack-engineer-name" className="block font-semibold text-slate-700 mb-1">
                  Acknowledged By (Engineer Name / Role)
</label>
<input
                  id="ack-engineer-name"
                  type="text"
                  value={ackBy}
                  onChange={(e) => setAckBy(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
</div>

<div>
<label htmlFor="ack-action-notes" className="block font-semibold text-slate-700 mb-1">
                  Remediation Action Notes (Required for audit compliance)
</label>
<textarea
                  id="ack-action-notes"
                  rows={3}
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="e.g. Coolant topped up, leak inspected, or security footage reviewed..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isAcking}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                  {isAcking ? 'Acknowledging...' : 'Acknowledge Alert'}
</button>
</div>
</form>
</div>
</div>
);
