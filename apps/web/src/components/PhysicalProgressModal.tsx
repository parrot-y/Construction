import React, { useState } from 'react';
import { queueOfflineMutation } from '../services/offline-sync';

interface PhysicalProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  boqItems?: Array<{ id: string; item_code: string; description: string }>;
  onProgressRecorded?: (progress: any) => void;
}

export default function PhysicalProgressModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'Riverside Commercial Plaza',
  boqItems = [],
  onProgressRecorded,
}: PhysicalProgressModalProps): React.JSX.Element | null {
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [overallProgressPct, setOverallProgressPct] = useState('15.0');
  const [notes, setNotes] = useState('Substructure excavation completed; hardcore filling underway.');
  const [selectedBoqItem, setSelectedBoqItem] = useState('');
  const [completedQty, setCompletedQty] = useState('80');
  const [itemCompletionPct, setItemCompletionPct] = useState('80');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const progressRatio = (parseFloat(overallProgressPct) / 100).toFixed(4);
    const itemRatio = (parseFloat(itemCompletionPct) / 100).toFixed(4);

    const payload: any = {
      recordDate,
      overallProgress: progressRatio,
      notes: notes.trim() || undefined,
      items: selectedBoqItem
        ? [
            {
              boqItemId: selectedBoqItem,
              completedQuantity: parseFloat(completedQty || '0').toFixed(4),
              completionPct: itemRatio,
            },
          ]
        : [],
    };

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      try {
        await queueOfflineMutation(projectId, `/api/v1/projects/${projectId}/progress`, payload);
        if (onProgressRecorded) {
          onProgressRecorded({ ...payload, isOfflineQueued: true });
        }
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to queue progress offline');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to record progress (HTTP ${res.status})`);
      }

      const resData = await res.json();
      if (onProgressRecorded) onProgressRecorded(resData.data);
      onClose();
    } catch {
      await queueOfflineMutation(projectId, `/api/v1/projects/${projectId}/progress`, payload);
      if (onProgressRecorded) {
        onProgressRecorded({ ...payload, isOfflineQueued: true });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className="font-bold text-slate-900 text-base">Record Physical Site Progress</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative physical milestone measurement for {projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition text-lg leading-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Record Date & Overall Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Observation Date</label>
              <input
                type="date"
                required
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Overall Project Progress (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={overallProgressPct}
                  onChange={(e) => setOverallProgressPct(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden font-mono font-bold"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* Linked BOQ Item Progress (Optional) */}
          {boqItems.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-800 block">Specific BOQ Line Item Progress (Optional)</span>
              <select
                value={selectedBoqItem}
                onChange={(e) => setSelectedBoqItem(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              >
                <option value="">-- General Project Overall Progress --</option>
                {boqItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.item_code}] {item.description.slice(0, 45)}...
                  </option>
                ))}
              </select>

              {selectedBoqItem && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Completed Quantity to Date</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={completedQty}
                      onChange={(e) => setCompletedQty(e.target.value)}
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Item Completion (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={itemCompletionPct}
                      onChange={(e) => setItemCompletionPct(e.target.value)}
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-md font-mono font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Progress & Milestone Notes</label>
            <textarea
              rows={3}
              placeholder="Summary of structural milestones achieved, testing status, concrete curing, or contractor observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : '✓ Record Physical Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
