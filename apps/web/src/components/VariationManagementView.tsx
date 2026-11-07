import React, { useCallback, useEffect, useState } from 'react';
import { toCurrencyString } from '@construction/money';
import CreateVariationModal from './CreateVariationModal';

export interface VariationItemData {
  id: string;
  description: string;
  unit: string;
  quantity: string | number;
  unit_rate: string | number;
  total_amount: string | number;
  boq_item?: { id: string; item_code: string; description: string } | null;
}

export interface VariationEventData {
  id: string;
  actor_type: string;
  actor_name: string;
  event: string;
  note?: string | null;
  created_at: string;
}

export type CoStatus = 'DRAFT' | 'PM_REVIEW' | 'OWNER_REVIEW' | 'APPROVED' | 'REJECTED' | 'VOID';

export interface VariationOrderData {
  id: string;
  variation_no: number;
  title: string;
  reason: string;
  status: CoStatus | string;
  trigger_type?: string | null;
  linked_rfi_id?: string | null;
  net_amount: string | number;
  time_extension_days: number;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at: string;
  items?: VariationItemData[];
  events?: VariationEventData[];
}

interface VariationManagementViewProps {
  projectId: string;
  userRole?: string;
  canRequest?: boolean;
  canReview?: boolean;
  canApprove?: boolean;
  initialVariations?: VariationOrderData[];
  onVariationUpdated?: (variation: VariationOrderData) => void;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PM_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  OWNER_REVIEW: 'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  VOID: 'bg-slate-100 text-slate-400 border-slate-200',
};

const TRIGGER_LABELS: Record<string, string> = {
  DESIGN_CLARIFICATION: 'Design clarification',
  OWNER_REQUEST: 'Owner request',
  UNFORESEEN_CONDITION: 'Unforeseen condition',
  CODE_COMPLIANCE: 'Code compliance',
  STRUCTURAL_REVIEW: 'Structural review',
  WEATHER_DELAY: 'Weather / delay',
  OTHER: 'Other',
};

const FILTERS = ['ALL', 'DRAFT', 'PM_REVIEW', 'OWNER_REVIEW', 'APPROVED', 'REJECTED', 'VOID'] as const;

export default function VariationManagementView({
  projectId,
  userRole = 'PM_QS',
  canRequest = true,
  canReview = true,
  canApprove = false,
  initialVariations,
  onVariationUpdated,
}: VariationManagementViewProps): React.JSX.Element {
  const [variations, setVariations] = useState<VariationOrderData[]>(initialVariations ?? []);
  const [loading, setLoading] = useState(!initialVariations);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedVoId, setExpandedVoId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadVariations = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/variations`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setVariations(json.data || []);
      }
    } catch {
      // offline/demo — keep current list
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!initialVariations) {
      setLoading(true);
      void loadVariations();
    }
  }, [loadVariations, initialVariations]);

  const filteredVariations = variations.filter((v) => {
    if (activeFilter === 'ALL') return true;
    return v.status === activeFilter;
  });

  const postAction = async (
    variationId: string,
    action: 'EVALUATE' | 'APPROVE' | 'REJECT' | 'VOID' | 'SUBMIT',
    comments?: string,
  ) => {
    const isSubmit = action === 'SUBMIT';
    const url = isSubmit
      ? `/api/v1/projects/${projectId}/variations/${variationId}/submit`
      : `/api/v1/projects/${projectId}/variations/${variationId}/review`;

    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isSubmit ? {} : { action, comments }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `Request failed (${res.status})`);
    }
    const json = await res.json();
    return json.data as VariationOrderData;
  };

  const handleReviewAction = async (variationId: string, action: 'EVALUATE' | 'APPROVE' | 'REJECT' | 'VOID') => {
    setActionError(null);
    const promptMessage =
      action === 'EVALUATE'
        ? 'Enter evaluation comments (e.g. Verified quantities and rates against contract):'
        : action === 'APPROVE'
          ? 'Enter approval comments:'
          : action === 'VOID'
            ? 'Enter reason for voiding this change order:'
            : 'Enter reason for rejecting this change order:';

    const comments = window.prompt(promptMessage, '');
    if (comments === null) return;
    if (action === 'REJECT' && comments.trim().length < 3) {
      setActionError('A rejection reason is required.');
      return;
    }

    try {
      const updatedVo = await postAction(variationId, action, comments);
      setVariations((prev) => prev.map((v) => (v.id === variationId ? updatedVo : v)));
      if (onVariationUpdated) onVariationUpdated(updatedVo);
      setActionFeedback(`CO-${String(updatedVo.variation_no).padStart(4, '0')} is now ${updatedVo.status}`);
    } catch (err: any) {
      setActionError(err?.message || 'Action failed');
    }
  };

  const handleSubmit = async (variationId: string) => {
    setActionError(null);
    try {
      const updatedVo = await postAction(variationId, 'SUBMIT');
      setVariations((prev) => prev.map((v) => (v.id === variationId ? updatedVo : v)));
      if (onVariationUpdated) onVariationUpdated(updatedVo);
      setActionFeedback(`CO-${String(updatedVo.variation_no).padStart(4, '0')} submitted for PM review`);
    } catch (err: any) {
      setActionError(err?.message || 'Submit failed');
    }
  };

  const handleVariationCreated = (newVo: VariationOrderData) => {
    setVariations((prev) => [newVo, ...prev]);
    setActionFeedback(`CO-${String(newVo.variation_no || 1).padStart(4, '0')} created as draft`);
    void loadVariations();
  };

  const toggleExpand = (id: string) => {
    setExpandedVoId(expandedVoId === id ? null : id);
  };

  const isPending = (s: string) => s === 'PM_REVIEW' || s === 'OWNER_REVIEW';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Change Orders &amp; Variations
            </h3>
            {userRole && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase">
                {userRole}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Draft → PM review → owner approval chain with per-role approval limits
          </p>
        </div>

        {canRequest && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            + New Change Order
          </button>
        )}
      </div>

      {actionFeedback && (
        <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-purple-600 hover:text-purple-900 font-bold ml-2">
            ×
          </button>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✕ {actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-900 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-100 pb-2 overflow-x-auto text-xs">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 font-semibold rounded-lg transition whitespace-nowrap ${
              activeFilter === filter
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {filter.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Variations List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading change orders…</div>
        ) : filteredVariations.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
            <span className="text-2xl text-slate-400 block mb-1">📑</span>
            <p className="text-xs font-semibold text-slate-600">No change orders found</p>
            <p className="text-[11px] text-slate-400">There are no change orders matching the selected filter</p>
          </div>
        ) : (
          filteredVariations.map((vo) => {
            const netNum = parseFloat(String(vo.net_amount));
            const isPositive = netNum >= 0;
            const isExpanded = expandedVoId === vo.id;
            const status = String(vo.status);

            return (
              <div
                key={vo.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition space-y-3 bg-white"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      CO-{String(vo.variation_no).padStart(4, '0')}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">{vo.title}</h4>

                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.DRAFT}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    {vo.trigger_type && vo.trigger_type !== 'OTHER' && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                        {TRIGGER_LABELS[vo.trigger_type] || vo.trigger_type}
                      </span>
                    )}
                  </div>

                  {/* Financial & Time Impact */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span
                        className={`text-xs font-mono font-bold block ${
                          isPositive ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isPositive ? '+' : '-'}KES {toCurrencyString(Math.abs(netNum))}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {vo.time_extension_days > 0 ? `+${vo.time_extension_days} Days Extension` : '0 Days Extension'}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleExpand(vo.id)}
                      className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Reason snippet */}
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                  <strong className="text-slate-700">Justification: </strong>
                  {vo.reason}
                </p>

                {/* Expandable detail: line items + activity feed */}
                {isExpanded && (
                  <div className="space-y-3">
                    {vo.items && vo.items.length > 0 && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Scope Description</th>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">Quantity</th>
                              <th className="p-2.5">Rate (KES)</th>
                              <th className="p-2.5 text-right">Line Total (KES)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {vo.items.map((item) => {
                              const itemTotalNum = parseFloat(String(item.total_amount));
                              const itemQtyNum = parseFloat(String(item.quantity));
                              const isAddition = itemQtyNum >= 0;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-medium">{item.description}</td>
                                  <td className="p-2.5">
                                    <span
                                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                        isAddition
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {isAddition ? 'ADDITION' : 'OMISSION'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-mono">
                                    {isAddition ? `+${item.quantity}` : `${item.quantity}`} {item.unit}
                                  </td>
                                  <td className="p-2.5 font-mono">KES {toCurrencyString(item.unit_rate)}</td>
                                  <td
                                    className={`p-2.5 font-mono font-bold text-right ${
                                      itemTotalNum >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {itemTotalNum >= 0 ? '+' : '-'}KES {toCurrencyString(Math.abs(itemTotalNum))}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Activity feed */}
                    {vo.events && vo.events.length > 0 && (
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Activity</p>
                        <ul className="space-y-1.5">
                          {vo.events.map((ev) => (
                            <li key={ev.id} className="flex items-start gap-2 text-[11px] text-slate-600">
                              <span className="font-mono text-slate-400 shrink-0">
                                {new Date(ev.created_at).toLocaleString()}
                              </span>
                              <span>
                                <strong>{ev.actor_name}</strong> — {ev.event}
                                {ev.note ? `: ${ev.note}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-100 text-[11px] gap-2">
                  <span className="text-slate-400">
                    Logged: {new Date(vo.created_at).toLocaleDateString()}
                    {vo.submitted_at && ` • Submitted: ${new Date(vo.submitted_at).toLocaleDateString()}`}
                    {vo.approved_at && ` • Approved: ${new Date(vo.approved_at).toLocaleDateString()}`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Submit for PM review (draft only) */}
                    {canRequest && status === 'DRAFT' && (
                      <button
                        onClick={() => void handleSubmit(vo.id)}
                        className="px-2.5 py-1 font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition shadow-xs"
                      >
                        Submit for PM review
                      </button>
                    )}

                    {/* PM_QS Evaluate / comment (pending stages) */}
                    {canReview && isPending(status) && (
                      <button
                        onClick={() => void handleReviewAction(vo.id, 'EVALUATE')}
                        className="px-2.5 py-1 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition"
                      >
                        Evaluate
                      </button>
                    )}

                    {/* Approve (pending stages; server enforces limits) */}
                    {canApprove && isPending(status) && (
                      <button
                        onClick={() => void handleReviewAction(vo.id, 'APPROVE')}
                        className="px-2.5 py-1 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition shadow-xs"
                      >
                        {status === 'OWNER_REVIEW' ? 'Owner Approve' : 'Approve'}
                      </button>
                    )}

                    {/* Reject (pending stages) */}
                    {(canApprove || canReview) && isPending(status) && (
                      <button
                        onClick={() => void handleReviewAction(vo.id, 'REJECT')}
                        className="px-2.5 py-1 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition"
                      >
                        Reject
                      </button>
                    )}

                    {/* Void (pre-decision) */}
                    {canRequest && ['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW'].includes(status) && (
                      <button
                        onClick={() => void handleReviewAction(vo.id, 'VOID')}
                        className="px-2.5 py-1 font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Variation Modal */}
      <CreateVariationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={projectId}
        onVariationCreated={handleVariationCreated}
      />
    </div>
  );
}
