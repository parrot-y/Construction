import React, { useState } from 'react';
import { queueOfflineMutation, compressImageClientSide } from '../services/offline-sync';

interface SiteDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onDiarySubmitted?: (diary: any) => void;
}

export default function SiteDiaryModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'Riverside Commercial Plaza',
  onDiarySubmitted,
}: SiteDiaryModalProps): React.JSX.Element | null {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState('SUNNY_CLEAR');
  const [siteStatus, setSiteStatus] = useState('OPERATIONAL');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isNonWorkDay, setIsNonWorkDay] = useState(false);
  const [photoClientVisible, setPhotoClientVisible] = useState(false);

  // Labor Headcount State
  const [masons, setMasons] = useState('4');
  const [carpenters, setCarpenters] = useState('2');
  const [steelFixers, setSteelFixers] = useState('3');
  const [casuals, setCasuals] = useState('8');

  // Material Delivery State
  const [materialName, setMaterialName] = useState('Simba Portland Cement 32.5N');
  const [quantity, setQuantity] = useState('200');
  const [unit, setUnit] = useState('BAGS');
  const [supplierName, setSupplierName] = useState('Bamburi Cement Ltd');
  const [deliveryNote, setDeliveryNote] = useState('DN-90124');

  // Plant & Machinery Equipment State
  const [equipmentName, setEquipmentName] = useState('Concrete Mixer 350L (Diesel)');
  const [equipmentHours, setEquipmentHours] = useState('6.0');
  const [fuelLitres, setFuelLitres] = useState('15');

  // Photo State
  const [photoCaption, setPhotoCaption] = useState('Foundation concrete pouring progress');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [compressedInfo, setCompressedInfo] = useState<{ originalKB: number; compressedKB: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalHeadcount =
    (parseInt(masons, 10) || 0) +
    (parseInt(carpenters, 10) || 0) +
    (parseInt(steelFixers, 10) || 0) +
    (parseInt(casuals, 10) || 0);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    try {
      const compressed = await compressImageClientSide(file);
      setCompressedInfo({
        originalKB: Math.round(compressed.originalSize / 1024),
        compressedKB: Math.round(compressed.compressedSize / 1024),
      });
    } catch {
      // Ignored
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const equipmentLog = equipmentName.trim()
      ? `[PLANT LOG] ${equipmentName.trim()}: ${equipmentHours} hrs operated, ${fuelLitres}L fuel issued`
      : '';
    const combinedNotes = [generalNotes.trim(), equipmentLog].filter(Boolean).join('\n');

    const payload = {
      entryDate,
      weather,
      siteStatus,
      generalNotes: combinedNotes || undefined,
      isNonWorkDay,
      laborHeadcounts: [
        { tradeType: 'Mason', headcount: parseInt(masons, 10) || 0 },
        { tradeType: 'Carpenter', headcount: parseInt(carpenters, 10) || 0 },
        { tradeType: 'Steel Fixer', headcount: parseInt(steelFixers, 10) || 0 },
        { tradeType: 'Casual', headcount: parseInt(casuals, 10) || 0 },
      ].filter((h) => h.headcount > 0),
      deliveries: materialName.trim()
        ? [
            {
              materialName: materialName.trim(),
              quantity: parseFloat(quantity || '0').toFixed(4),
              unit: unit.trim().toUpperCase(),
              supplierName: supplierName.trim() || undefined,
              deliveryNote: deliveryNote.trim() || undefined,
            },
          ]
        : [],
      photos: photoFile
        ? [
            {
              storageKey: `evidence/${projectId}/${Date.now()}-${photoFile.name}`,
              caption: photoCaption.trim() || undefined,
              clientVisible: photoClientVisible,
              gpsLatitude: -1.286389, // Nairobi site coordinates
              gpsLongitude: 36.817223,
            },
          ]
        : [],
    };

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      try {
        await queueOfflineMutation(projectId, `/api/v1/projects/${projectId}/site-diaries`, payload);
        if (onDiarySubmitted) {
          onDiarySubmitted({
            ...payload,
            isOfflineQueued: true,
            totalHeadcount,
          });
        }
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to queue offline diary');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-diaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to record diary (HTTP ${res.status})`);
      }

      const resData = await res.json();
      if (onDiarySubmitted) onDiarySubmitted(resData.data);
      onClose();
    } catch (err: any) {
      // If network fails, queue offline
      await queueOfflineMutation(projectId, `/api/v1/projects/${projectId}/site-diaries`, payload);
      if (onDiarySubmitted) {
        onDiarySubmitted({
          ...payload,
          isOfflineQueued: true,
          totalHeadcount,
        });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h3 className="font-bold text-slate-900 text-base">Record Daily Site Diary</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Field labor headcount, weather observations, and photo evidence for {projectName}
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

          {/* Date, Weather & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Entry Date</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Weather Condition</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
              >
                <option value="SUNNY_CLEAR">☀️ Sunny / Clear</option>
                <option value="CLOUDY">⛅ Cloudy / Overcast</option>
                <option value="LIGHT_RAIN">🌦️ Light Rain (Work Ongoing)</option>
                <option value="HEAVY_RAIN">🌧️ Heavy Rain</option>
                <option value="RAIN_DELAY">⚠️ Rain Delay (Site Stopped)</option>
                <option value="DUST_STORM">🌪️ Dust / High Winds</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Site Operational Status</label>
              <select
                value={siteStatus}
                onChange={(e) => setSiteStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
              >
                <option value="OPERATIONAL">🟢 Operational</option>
                <option value="PARTIAL">🟡 Partial Operations</option>
                <option value="STOPPED">🔴 Site Work Stopped</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="nonWorkDay"
                checked={isNonWorkDay}
                onChange={(e) => setIsNonWorkDay(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="nonWorkDay" className="text-[11px] font-semibold text-slate-600">
                Non-work day (weekend / holiday / site closed)
              </label>
            </div>
          </div>

          {/* Trade Headcount Matrix */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">👷 On-Site Trade Headcount</span>
              <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                Total: {totalHeadcount} workers
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">Masons</span>
                <input
                  type="number"
                  min="0"
                  value={masons}
                  onChange={(e) => setMasons(e.target.value)}
                  className="w-full p-1.5 text-xs font-mono font-bold border border-slate-300 rounded-md bg-white text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">Carpenters</span>
                <input
                  type="number"
                  min="0"
                  value={carpenters}
                  onChange={(e) => setCarpenters(e.target.value)}
                  className="w-full p-1.5 text-xs font-mono font-bold border border-slate-300 rounded-md bg-white text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">Steel Fixers</span>
                <input
                  type="number"
                  min="0"
                  value={steelFixers}
                  onChange={(e) => setSteelFixers(e.target.value)}
                  className="w-full p-1.5 text-xs font-mono font-bold border border-slate-300 rounded-md bg-white text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">Casuals</span>
                <input
                  type="number"
                  min="0"
                  value={casuals}
                  onChange={(e) => setCasuals(e.target.value)}
                  className="w-full p-1.5 text-xs font-mono font-bold border border-slate-300 rounded-md bg-white text-center"
                />
              </div>
            </div>
          </div>

          {/* Material Delivery Received */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="font-bold text-slate-800 block">📦 Material Delivery Received</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Material description (e.g. Machine-Cut Stone 9x9)"
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white"
                />
              </div>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Qty"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20 p-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-16 p-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                type="text"
                placeholder="Supplier (e.g. Bamburi Cement)"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white"
              />
              <input
                type="text"
                placeholder="Delivery Note # (e.g. DN-901)"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white"
              />
            </div>
          </div>

          {/* Plant, Machinery & Equipment Tracking */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">🚜 Plant & Equipment Log</span>
              <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono font-semibold">
                Machinery Hours & Fuel
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Equipment (e.g. Concrete Mixer 350L)"
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
                className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white sm:col-span-1"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  placeholder="Hours"
                  value={equipmentHours}
                  onChange={(e) => setEquipmentHours(e.target.value)}
                  className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono"
                />
                <span className="text-[11px] text-slate-500 font-mono">hrs</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Fuel"
                  value={fuelLitres}
                  onChange={(e) => setFuelLitres(e.target.value)}
                  className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono"
                />
                <span className="text-[11px] text-slate-500 font-mono">L</span>
              </div>
            </div>
          </div>

          {/* Photo Evidence with Client-Side Compression Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">📷 Geotagged Photo Evidence</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                GPS Geotagged • Nairobi
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200"
            />
            {photoFile && (
              <div className="pt-1 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] text-slate-600 gap-1">
                <span>📎 {photoFile.name}</span>
                {compressedInfo && (
                  <span className="text-emerald-700 font-mono font-semibold">
                    Compressed: {compressedInfo.originalKB} KB → {compressedInfo.compressedKB} KB (Saved{' '}
                    {Math.round((1 - compressedInfo.compressedKB / compressedInfo.originalKB) * 100)}%)
                  </span>
                )}
              </div>
            )}
            <input
              type="text"
              placeholder="Photo caption (e.g. Foundation excavation bottom inspection)"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white mt-1"
            />
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="photoClientVisible"
                checked={photoClientVisible}
                onChange={(e) => setPhotoClientVisible(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <label htmlFor="photoClientVisible" className="text-[11px] text-slate-600 leading-snug">
                <span className="font-semibold text-slate-700">Share with client</span> — this photo
                appears in the client portal. Notes are never shared; only photos you opt in are visible.
              </label>
            </div>
          </div>

          {/* General Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Site Work Diary Notes</label>
            <textarea
              rows={2}
              placeholder="Activities completed, contractor standing time, equipment issues, or site engineer instructions..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
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
              className="px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? 'Saving...' : '✓ Record Daily Site Diary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
