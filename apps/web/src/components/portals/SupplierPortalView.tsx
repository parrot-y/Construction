import React, { useState } from 'react';

export interface SupplierDelivery {
  id: string;
  delivery_note_number: string;
  material_description: string;
  quantity: string | number;
  unit: string;
  supplier_name: string;
  status: 'PENDING' | 'RECEIVED' | 'REJECTED';
  siteDate: string;
  received_by?: string;
  notes?: string;
}

interface SupplierPortalViewProps {
  token?: string;
  supplierName?: string;
  supplierCategory?: string;
  projectName?: string;
  projectCode?: string;
  deliveries?: SupplierDelivery[];
  onBackToDashboard?: () => void;
}

export default function SupplierPortalView({
  token: _token = 'demo-supplier-token',
  supplierName = 'Bamburi Ready-Mix Nairobi Plant',
  supplierCategory = 'Ready-Mix Concrete & Aggregates Supplier',
  projectName = 'Riverside Commercial Plaza',
  projectCode = 'RCP-2026',
  deliveries = [
    {
      id: 'del-1',
      delivery_note_number: 'DN-BAM-90812',
      material_description: 'Ready-Mix Concrete Class 25/20 (Slump: 100mm)',
      quantity: 36,
      unit: 'm³ (6 Trucks)',
      supplier_name: 'Bamburi Ready-Mix Nairobi Plant',
      status: 'RECEIVED',
      siteDate: '2026-02-10',
      received_by: 'Site Supervisor (Accreditation: NCA/SS/2024/091)',
      notes: 'Delivered in 6 batch truck mixer loads. Slump tested on arrival at 95mm. Accepted.',
    },
    {
      id: 'del-2',
      delivery_note_number: 'DN-BAM-90954',
      material_description: 'Ready-Mix Concrete Class 30/20 (High Early Strength)',
      quantity: 42,
      unit: 'm³ (7 Trucks)',
      supplier_name: 'Bamburi Ready-Mix Nairobi Plant',
      status: 'RECEIVED',
      siteDate: '2026-02-18',
      received_by: 'Site Supervisor (Accreditation: NCA/SS/2024/091)',
      notes: 'Pour for Suspended Slab Beam Girder G1. 6 concrete test cubes cast on site.',
    },
    {
      id: 'del-3',
      delivery_note_number: 'DN-BAM-91100',
      material_description: 'Ready-Mix Concrete Class 25/20 (Perimeter Wall Kickers)',
      quantity: 12,
      unit: 'm³ (2 Trucks)',
      supplier_name: 'Bamburi Ready-Mix Nairobi Plant',
      status: 'PENDING',
      siteDate: '2026-03-01',
      notes: 'Scheduled for pour at 08:00 AM. Site access cleared via Gate 2.',
    },
  ],
  onBackToDashboard,
}: SupplierPortalViewProps): React.JSX.Element {
  const [filter, setFilter] = useState<'ALL' | 'RECEIVED' | 'PENDING'>('ALL');

  const filteredDeliveries = deliveries.filter((d) => {
    if (filter === 'ALL') return true;
    return d.status === filter;
  });

  const totalDeliveredVolume = deliveries
    .filter((d) => d.status === 'RECEIVED')
    .reduce((sum, d) => sum + Number(d.quantity || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="supplier-portal-view">
      {/* Header */}
      <header className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              Material Supplier & Batching Portal • Zero Seat Tax
            </span>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Verified Dispatch Link
            </span>
          </div>
          <h1 className="text-xl font-bold mt-2 text-white">{projectName} ({projectCode})</h1>
          <p className="text-xs text-slate-400">
            Vendor: <span className="text-slate-200 font-semibold">{supplierName}</span> • {supplierCategory}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              ← Back to Project
            </button>
          )}
          <div className="text-right">
            <p className="text-[11px] text-slate-400">Verified Delivered</p>
            <p className="text-xs font-bold text-emerald-400">{totalDeliveredVolume} m³ Accepted</p>
          </div>
        </div>
      </header>

      {/* Filter and stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex gap-2">
          {(['ALL', 'RECEIVED', 'PENDING'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {mode === 'ALL' ? 'All Deliveries' : mode === 'RECEIVED' ? 'Site Verified' : 'Scheduled / En Route'}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          Electronic delivery notes cross-checked with Site Supervisor daily diary.
        </p>
      </div>

      {/* Deliveries List */}
      <div className="space-y-4">
        {filteredDeliveries.map((del) => (
          <div
            key={del.id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
            data-testid={`supplier-delivery-${del.delivery_note_number}`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {del.delivery_note_number}
                </span>
                <span className="text-xs text-slate-500">
                  Site Date: {new Date(del.siteDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>

              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  del.status === 'RECEIVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {del.status === 'RECEIVED' ? 'Site Acknowledged & Cast' : 'Scheduled / Dispatched'}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">{del.material_description}</h3>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                Quantity: <span className="text-slate-900 font-bold">{del.quantity} {del.unit}</span>
              </p>
            </div>

            {del.notes && (
              <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="font-semibold text-slate-900">Site Inspection Note:</span> {del.notes}
              </div>
            )}

            {del.received_by && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <span className="text-emerald-600 font-bold">✓</span> Received & Slump Tested by: {del.received_by}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
