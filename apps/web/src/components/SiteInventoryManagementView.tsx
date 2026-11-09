import React, { useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';

export interface InventoryItem {
  id: string;
  material_name: string;
  category: string;
  unit: string;
  current_stock: string | number;
  minimum_reorder_level: string | number;
  unit_cost_estimate?: string | number | null;
  storage_location?: string | null;
  last_restocked_at?: string | null;
}

export interface InventoryMovementRecord {
  id: string;
  inventory_item_id: string;
  movement_type: 'DELIVERY_IN' | 'USAGE_OUT' | 'WASTAGE' | 'TRANSFER';
  quantity: string | number;
  delivery_note_number?: string | null;
  supplier_name?: string | null;
  purpose_description?: string | null;
  recorded_at: string;
  recorded_by?: { full_name: string} | null;
}

interface SiteInventoryManagementViewProps {
  projectId: string;
  canManage?: boolean;
  initialItems?: InventoryItem[];
  initialMovements?: InventoryMovementRecord[];
  onMovementRecorded?: (movement: Partial<InventoryMovementRecord>) => void;
  onItemCreated?: (item: Partial<InventoryItem>) => void;
}

export default function SiteInventoryManagementView({
  projectId,
  canManage = true,
  initialItems = [],
  initialMovements = [],
  onMovementRecorded,
  onItemCreated,
}: SiteInventoryManagementViewProps) {
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [movements, setMovements] = useState<InventoryMovementRecord[]>(initialMovements);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/inventory`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.items || []) as any[];
      setItems(list.map((i) => ({
        ...i,
        current_stock: i.current_stock?.toString?.() ?? String(i.current_stock ?? 0),
        minimum_reorder_level: i.minimum_reorder_level?.toString?.() ?? String(i.minimum_reorder_level ?? 0),
        unit_cost_estimate: i.unit_cost_estimate?.toString?.() ?? i.unit_cost_estimate ?? null,
})));
      setMovements(list.flatMap((i) => (i.movements || []).map((m: any) => ({
        ...m,
        movement_type: m.movement_type === 'WASTAGE_DAMAGE' ? 'WASTAGE' : m.movement_type,
        quantity: m.quantity?.toString?.() ?? String(m.quantity ?? 0),
        recorded_by: m.recorded_by_name ? { full_name: m.recorded_by_name} : m.recorded_by || null,
}))).sort((a: any, b: any) => String(b.recorded_at).localeCompare(String(a.recorded_at))));
} catch {
      setItems([]); setMovements([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'LOW_ONLY'>('ALL');

  // Modals
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [movementType, setMovementType] = useState<'DELIVERY_IN' | 'USAGE_OUT'>('DELIVERY_IN');

  // Form states
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<string>('CEMENT');
  const [newItemUnit, setNewItemUnit] = useState<string>('BAGS');
  const [newItemOpening, setNewItemOpening] = useState<number>(0);
  const [newItemReorder, setNewItemReorder] = useState<number>(10);
  const [newItemCost, setNewItemCost] = useState<string>('1000.00');
  const [newItemLocation, setNewItemLocation] = useState<string>('');

  // Movement Form states
  const [movQty, setMovQty] = useState<number>(10);
  const [movDeliveryNote, setMovDeliveryNote] = useState<string>('');
  const [movSupplier, setMovSupplier] = useState<string>('');
  const [movPurpose, setMovPurpose] = useState<string>('');

  const filteredItems = items.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const isLow = Number(item.current_stock)<= Number(item.minimum_reorder_level);
    const matchesAlert = alertFilter === 'ALL' || isLow;
    return matchesCat && matchesAlert;
});

  const lowStockCount = items.filter(
    (item) => Number(item.current_stock)<= Number(item.minimum_reorder_level)
).length;

  const totalStoreValueKes = items.reduce((sum, item) => {
    const stock = Number(item.current_stock) || 0;
    const unitPrice = Number(item.unit_cost_estimate) || 0;
    return sum + stock * unitPrice;
}, 0);

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const created: InventoryItem = {
      id: `inv-${Date.now()}`,
      material_name: newItemName.trim(),
      category: newItemCategory,
      unit: newItemUnit,
      current_stock: newItemOpening,
      minimum_reorder_level: newItemReorder,
      unit_cost_estimate: newItemCost,
      storage_location: newItemLocation.trim() || 'Main Site Store',
      last_restocked_at: new Date().toISOString(),
};

    if (isLive) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/inventory/items`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              materialName: created.material_name, category: created.category, unit: created.unit,
              openingBalance: String(created.current_stock),
              minimumReorderLevel: String(created.minimum_reorder_level),
              unitCostEstimate: created.unit_cost_estimate != null ? String(created.unit_cost_estimate) : null,
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      setShowItemModal(false);
      setNewItemName('');
      return;
}
    setItems([...items, created]);
    if (onItemCreated) onItemCreated(created);
    setShowItemModal(false);
    setNewItemName('');
};

  const handleRecordMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const targetItem = items.find((i) => i.id === selectedItemId);
    if (!targetItem || movQty<= 0) return;

    const delta = movementType === 'DELIVERY_IN' ? movQty : -movQty;
    const updatedStock = Math.max(0, Number(targetItem.current_stock) + delta);

    setItems(
      items.map((i) =>
        i.id === selectedItemId ? { ...i, current_stock: updatedStock} : i
)
);

    const record: InventoryMovementRecord = {
      id: `mov-${Date.now()}`,
      inventory_item_id: selectedItemId,
      movement_type: movementType,
      quantity: movQty,
      delivery_note_number: movementType === 'DELIVERY_IN' ? movDeliveryNote.trim() : null,
      supplier_name: movementType === 'DELIVERY_IN' ? movSupplier.trim() : null,
      purpose_description: movPurpose.trim(),
      recorded_at: new Date().toISOString(),
      recorded_by: { full_name: 'Site Storekeeper'},
};

    if (isLive) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/inventory/movements`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              inventoryItemId: selectedItemId,
              movementType,
              quantity: String(movQty),
              movementDate: new Date().toISOString().slice(0, 10),
              referenceNo: movementType === 'DELIVERY_IN' ? movDeliveryNote.trim() || null : null,
              notes: [movSupplier.trim(), movPurpose.trim()].filter(Boolean).join(' — ') || null,
              recordedByName: 'Site Storekeeper',
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      setShowMovementModal(false);
      setMovQty(10); setMovDeliveryNote(''); setMovSupplier(''); setMovPurpose('');
      return;
}
    setMovements([record, ...movements]);
    if (onMovementRecorded) onMovementRecorded(record);
    setShowMovementModal(false);
    setMovQty(10);
    setMovDeliveryNote('');
    setMovSupplier('');
    setMovPurpose('');
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading inventory...</div>;
}

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="site-inventory-management-view" data-project-id={projectId}>
      {/* Header & KPI Summary */}
<div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div>
<div className="flex items-center gap-2">
<span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                STORE &amp; STOCK
</span>
<h2 className="text-xl font-bold text-slate-900">Site Materials &amp; Store Inventory</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
              Real-time site material balances, delivery reconciliation, stock-out tracking &amp; reorder alarms.
</p>
</div>
          {canManage && (
<div className="flex items-center gap-2">
<button
                onClick={() => {
                  setMovementType('DELIVERY_IN');
                  setShowMovementModal(true);
}}
                className="inline-flex items-center px-3 py-2 border border-emerald-600 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              >
                 Record Inward Delivery
</button>
<button
                onClick={() => {
                  setMovementType('USAGE_OUT');
                  setShowMovementModal(true);
}}
                className="inline-flex items-center px-3 py-2 border border-amber-600 text-xs font-semibold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100"
              >
                 Record Usage Out
</button>
<button
                onClick={() => setShowItemModal(true)}
                className="inline-flex items-center px-3.5 py-2 border border-transparent text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800"
              >
                + New Item
</button>
</div>
)}
</div>

        {/* 3 KPI Cards */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Tracked Materials</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-slate-900">{items.length}</span>
<span className="text-xs text-slate-400">active stock lines</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              Bamburi cement, rebar, masonry, aggregate
</div>
</div>

<div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Reorder Alerts</span>
<div className="mt-1 flex items-baseline gap-2">
<span className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {lowStockCount}
</span>
<span className="text-xs text-slate-400">items below minimum</span>
</div>
<div className="text-xs text-rose-600 mt-2 font-medium">
              {lowStockCount > 0 ? 'Immediate reorder requisition advised' : 'All buffer stocks healthy'}
</div>
</div>

<div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Store Valuation (KES)</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-slate-900">
                {toCurrencyString(totalStoreValueKes)}
</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              Physical material holding on site
</div>
</div>
</div>
</div>

      {/* Filter Bar */}
<div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 ">Category:</label>
<select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
<option value="ALL">All Categories</option>
<option value="CEMENT">Cement &amp; Binders</option>
<option value="STEEL">Reinforcement Steel</option>
<option value="MASONRY">Masonry Stones &amp; Blocks</option>
<option value="AGGREGATE">Sand &amp; Ballast</option>
<option value="TIMBER">Timber &amp; Formwork</option>
<option value="PLUMBING">Plumbing &amp; Piping</option>
<option value="ELECTRICAL">Electrical &amp; Conduits</option>
<option value="PAINT">Paint &amp; Chemicals</option>
</select>
</div>

<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 ">Alerts:</label>
<select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
<option value="ALL">All Stock Levels</option>
<option value="LOW_ONLY"> Low Stock Only</option>
</select>
</div>
</div>
</div>

      {/* Stock Cards Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
        {filteredItems.map((item) => {
          const isLow = Number(item.current_stock)<= Number(item.minimum_reorder_level);
          return (
<div
              key={item.id}
              className={`p-4 rounded-xl border transition-all ${
                isLow
                  ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                  : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
}`}
            >
<div className="flex items-start justify-between gap-2 mb-2">
<span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {item.category}
</span>
                {isLow ? (
<span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 animate-pulse">
                    Low Stock Alert
</span>
) : (
<span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Sufficient
</span>
)}
</div>

<h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 h-10 mb-2">
                {item.material_name}
</h4>

<div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 mb-3">
<div className="flex items-baseline justify-between">
<span className="text-xs text-slate-500">Current Balance:</span>
<span className={`text-base font-extrabold ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                    {Number(item.current_stock).toLocaleString()} {item.unit}
</span>
</div>
<div className="flex items-center justify-between text-xs text-slate-400 mt-1">
<span>Reorder Level:</span>
<span>{item.minimum_reorder_level} {item.unit}</span>
</div>
</div>

<div className="text-xs text-slate-500 space-y-1">
                {item.unit_cost_estimate && (
<div className="flex justify-between">
<span>Est. Unit Cost:</span>
<strong className="text-slate-700">KES {Number(item.unit_cost_estimate).toLocaleString()}</strong>
</div>
)}
                {item.storage_location && (
<div className="flex justify-between">
<span>Bay Location:</span>
<span className="text-slate-600 truncate max-w-[140px]">{item.storage_location}</span>
</div>
)}
</div>
</div>
);
})}
</div>

      {/* Recent Movements Audit Trail Table */}
<div className="p-6 border-t border-slate-100 bg-slate-50/50">
<h4 className="text-xs font-bold text-slate-700 mb-3">
          Recent Material Inward / Outward Movement Audit Log
</h4>
<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
<table className="min-w-full divide-y divide-slate-200 text-xs">
<thead className="bg-slate-50 font-semibold text-slate-600">
<tr>
<th className="py-2.5 px-3 text-left">Timestamp</th>
<th className="py-2.5 px-3 text-left">Type</th>
<th className="py-2.5 px-3 text-left">Material</th>
<th className="py-2.5 px-3 text-right">Quantity</th>
<th className="py-2.5 px-3 text-left">Ref / Note</th>
<th className="py-2.5 px-3 text-left">Purpose / Supplier</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {movements.map((m) => {
                const item = items.find((i) => i.id === m.inventory_item_id);
                const isDelivery = m.movement_type === 'DELIVERY_IN';
                return (
<tr key={m.id} className="hover:bg-slate-50">
<td className="py-2.5 px-3 text-slate-500">
                      {new Date(m.recorded_at).toLocaleDateString()} {new Date(m.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
</td>
<td className="py-2.5 px-3">
<span
                        className={`px-2 py-0.5 rounded font-bold ${
                          isDelivery
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
}`}
                      >
                        {isDelivery ? ' DELIVERY IN' : ' USAGE OUT'}
</span>
</td>
<td className="py-2.5 px-3 font-semibold text-slate-800">
                      {item?.material_name || 'Material Item'}
</td>
<td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {isDelivery ? `+${m.quantity}` : `-${m.quantity}`} {item?.unit || ''}
</td>
<td className="py-2.5 px-3 text-slate-600">
                      {m.delivery_note_number || '—'}
</td>
<td className="py-2.5 px-3 text-slate-600">
                      {m.supplier_name || m.purpose_description || '—'}
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>

      {/* Movement Modal */}
      {showMovementModal && (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
<h3 className="text-lg font-bold text-slate-900 mb-1">
              {movementType === 'DELIVERY_IN' ? ' Record Inward Delivery' : ' Record Site Material Consumption'}
</h3>
<p className="text-xs text-slate-500 mb-4">
              Atomically adjusts store inventory balances with immutable audit trail.
</p>
<form onSubmit={handleRecordMovement} className="space-y-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Select Material Line</label>
<select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                >
                  {items.map((i) => (
<option key={i.id} value={i.id}>
                      {i.material_name} (Current: {i.current_stock} {i.unit})
</option>
))}
</select>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
<input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={movQty}
                  onChange={(e) => setMovQty(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                />
</div>

              {movementType === 'DELIVERY_IN' ? (
<>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Note / Waybill Ref</label>
<input
                      type="text"
                      placeholder="e.g. DN-BAMB-1029"
                      value={movDeliveryNote}
                      onChange={(e) => setMovDeliveryNote(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                    />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Supplier / Merchant</label>
<input
                      type="text"
                      placeholder="e.g. Apex Hardware / Bamburi Cement"
                      value={movSupplier}
                      onChange={(e) => setMovSupplier(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                    />
</div>
</>
) : (
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Purpose / Work Phase</label>
<input
                    type="text"
                    required
                    placeholder="e.g. First floor ring beam concrete batching"
                    value={movPurpose}
                    onChange={(e) => setMovPurpose(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                  />
</div>
)}

<div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Save Movement
</button>
</div>
</form>
</div>
</div>
)}

      {/* New Item Modal */}
      {showItemModal && (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
<h3 className="text-lg font-bold text-slate-900 mb-1">+ New Inventory Item</h3>
<p className="text-xs text-slate-500 mb-4">
              Add a tracked site material or tool to the project store catalog.
</p>
<form onSubmit={handleCreateItem} className="space-y-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Material Name</label>
<input
                  type="text"
                  required
                  placeholder="e.g. Y12 Deformed High Tensile Bar"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-slate-900"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
<select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
<option value="CEMENT">Cement</option>
<option value="STEEL">Steel</option>
<option value="MASONRY">Masonry</option>
<option value="AGGREGATE">Aggregate</option>
<option value="TIMBER">Timber</option>
<option value="PLUMBING">Plumbing</option>
<option value="ELECTRICAL">Electrical</option>
<option value="PAINT">Paint</option>
<option value="GENERAL">General</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
<input
                    type="text"
                    required
                    placeholder="e.g. BAGS, TONNES, PCS"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance</label>
<input
                    type="number"
                    min="0"
                    step="any"
                    value={newItemOpening}
                    onChange={(e) => setNewItemOpening(Number(e.target.value))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Min Reorder Level</label>
<input
                    type="number"
                    min="0"
                    step="any"
                    value={newItemReorder}
                    onChange={(e) => setNewItemReorder(Number(e.target.value))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Est. Unit Cost (KES)</label>
<input
                    type="text"
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Storage Location</label>
<input
                    type="text"
                    placeholder="e.g. Bay 2 / Shed"
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
                >
                  Create Item
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}
