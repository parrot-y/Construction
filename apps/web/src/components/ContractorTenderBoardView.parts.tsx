import React from 'react';
import { formatMoney } from '@construction/money';
import { PRODUCT_NAME } from '../lib/product';
import { statusLabel } from '../lib/status-labels';
import type {
  ContractorBid,
  TenderPackage,
  TenderStatus,
} from './ContractorTenderBoardView';

export const DEFAULT_TENDERS: TenderPackage[] = [
  {
    id: 'tnd-2026-001',
    tenderRef: 'SSF-TND-2026-STR-01',
    title: 'Reinforced Concrete Framing & Suspended Slabs Package',
    category: 'Structural Works',
    estimatedBudgetKes: '18500000.00',
    submissionDeadline: '2026-11-28',
    status: 'UNDER_REVIEW',
    ncaRequirement: 'NCA 3 or NCA 4 (Building Works)',
    scopeDescription:
      'Supply of Class 25 concrete, BS 4449 Grade 500 TMT reinforcement, certified formwork and falsework staging for 3 storeys per EASMM 2008 standards.',
    bids: [
      {
        id: 'bid-001',
        contractorName: 'Apex Structural Builders Ltd',
        ncaCategory: 'NCA 3',
        bidAmountKes: '17800000.00',
        durationWeeks: 12,
        tradeBreakdown: {
          labor: '5200000.00',
          materials: '9800000.00',
          plantEquipment: '1600000.00',
          preliminaries: '1200000.00',
},
        technicalScore: 92.5,
        financialScore: 100.0,
        combinedScore: 94.75, // 92.5*0.7 + 100*0.3
        rank: 1,
        contactPerson: 'Eng. Dennis Mwangi',
        contactPhone: '+254 722 101 202',
        pastProjectsSummary: 'Completed Upperhill Towers & Karen Office Park structural concrete works.',
        submittedAt: '2026-11-01 10:30 EAT',
},
      {
        id: 'bid-002',
        contractorName: 'Kilimani Construction Works Ltd',
        ncaCategory: 'NCA 4',
        bidAmountKes: '18900000.00',
        durationWeeks: 14,
        tradeBreakdown: {
          labor: '5500000.00',
          materials: '10200000.00',
          plantEquipment: '1800000.00',
          preliminaries: '1400000.00',
},
        technicalScore: 84.0,
        financialScore: 94.18,
        combinedScore: 87.05, // 84*0.7 + 94.18*0.3
        rank: 2,
        contactPerson: 'Francis Kariuki',
        contactPhone: '+254 733 987 654',
        pastProjectsSummary: 'Nairobi West Plaza & Parklands Residential Apartments.',
        submittedAt: '2026-11-02 14:15 EAT',
},
      {
        id: 'bid-003',
        contractorName: 'Rift Valley Civils & Building Ltd',
        ncaCategory: 'NCA 4',
        bidAmountKes: '19400000.00',
        durationWeeks: 16,
        tradeBreakdown: {
          labor: '5800000.00',
          materials: '10500000.00',
          plantEquipment: '1700000.00',
          preliminaries: '1400000.00',
},
        technicalScore: 78.0,
        financialScore: 91.75,
        combinedScore: 82.13, // 78*0.7 + 91.75*0.3
        rank: 3,
        contactPerson: 'David Rotich',
        contactPhone: '+254 711 554 433',
        pastProjectsSummary: 'Nakuru Business Center & Eldoret Commercial Mall framing.',
        submittedAt: '2026-11-03 09:00 EAT',
},
    ],
    awardedBidId: null,
    awardedAt: null,
},
  {
    id: 'tnd-2026-002',
    tenderRef: 'SSF-TND-2026-BHOLE-02',
    title: 'Solar-Powered Submersible Borehole System & Pressed Steel Storage',
    category: 'Mechanical & Water Works',
    estimatedBudgetKes: '4200000.00',
    submissionDeadline: '2026-11-15',
    status: 'AWARDED',
    ncaRequirement: 'NCA 5 (Water Works)',
    scopeDescription:
      'Hydrogeological survey, borehole drilling to 220m, 8-inch steel casing, solar array with 15kW Grundfos pump, and 24,000L elevated pressed steel water tower.',
    bids: [
      {
        id: 'bid-bhole-1',
        contractorName: 'HydroTech Kenya Solutions Ltd',
        ncaCategory: 'NCA 5',
        bidAmountKes: '3950000.00',
        durationWeeks: 6,
        tradeBreakdown: {
          labor: '950000.00',
          materials: '2200000.00',
          plantEquipment: '600000.00',
          preliminaries: '200000.00',
},
        technicalScore: 95.0,
        financialScore: 100.0,
        combinedScore: 96.5,
        rank: 1,
        contactPerson: 'Eng. Samuel Oduor',
        contactPhone: '+254 720 123 456',
        pastProjectsSummary: 'Drilled 45 commercial boreholes across Kiambu and Nairobi counties.',
        submittedAt: '2026-10-20 11:00 EAT',
},
    ],
    awardedBidId: 'bid-bhole-1',
    awardedAt: '2026-10-25 16:00 EAT',
},
  {
    id: 'tnd-2026-003',
    tenderRef: 'SSF-TND-2026-FAC-03',
    title: 'High-Performance Aluminum Curtain Walling & Double Glazing',
    category: 'Finishes & Façade',
    estimatedBudgetKes: '9800000.00',
    submissionDeadline: '2026-12-05',
    status: 'OPEN',
    ncaRequirement: 'NCA 4 (Finishing Works)',
    scopeDescription:
      'Powder-coated architectural aluminum frames with 6mm + 12A + 6mm low-E toughened acoustic double-glazed glass units per architectural elevations.',
    bids: [],
    awardedBidId: null,
    awardedAt: null,
},
];

const getStatusBadge = (status: TenderStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'UNDER_REVIEW':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'AWARDED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
}
};

export const TenderBoardHeader: React.FC<{
  projectName: string;
  onPostTender: () => void;
  onSubmitBid: () => void;
}> = ({ projectName, onPostTender, onSubmitBid }) => (
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              BORAQS / EASMM Compliant
</span>
<span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Technical 70% • Financial 30% Evaluation
</span>
</div>
<h2 className="text-xl font-bold text-slate-900 mt-1">
            {PRODUCT_NAME} Contractor Tender Board &amp; Bidding Studio
</h2>
<p className="text-xs text-slate-500 mt-0.5">
            Transparent e-tendering, automated combined score ranking, and contractor contract awards for {projectName}.
</p>
</div>

<div className="flex items-center gap-2 shrink-0">
<button
            onClick={onPostTender}
            data-testid="post-tender-btn"
            className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
<span>+ Post New Tender</span>
</button>
<button
            onClick={onSubmitBid}
            data-testid="submit-bid-btn"
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
<span> Submit Contractor Bid</span>
</button>
</div>
</div>
);

export const ActionSuccessBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center">
<span> {message}</span>
<button onClick={onDismiss} className="font-bold text-emerald-900 ml-2">×</button>
</div>
);

export const TenderFilterTabs: React.FC<{
  statusFilter: 'ALL' | TenderStatus;
  setStatusFilter: React.Dispatch<React.SetStateAction<'ALL' | TenderStatus>>;
  filteredCount: number;
}> = ({ statusFilter, setStatusFilter, filteredCount }) => (
<div className="flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          {(['ALL', 'OPEN', 'UNDER_REVIEW', 'AWARDED'] as const).map((filter) => (
<button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              data-testid={`tender-filter-${filter.toLowerCase()}`}
              className={`px-3 py-1 rounded font-semibold text-[11px] transition ${
                statusFilter === filter
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
}`}
            >
              {filter.replace('_', ' ')}
</button>
))}
</div>

<span className="text-xs text-slate-500">
          Showing {filteredCount} Tender Package{filteredCount !== 1 ? 's' : ''}
</span>
</div>
);

export const TenderCardsGrid: React.FC<{
  tenders: TenderPackage[];
  selectedTenderId: string;
  setSelectedTenderId: React.Dispatch<React.SetStateAction<string>>;
}> = ({ tenders, selectedTenderId, setSelectedTenderId }) => (
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tenders.map((tender) => (
<button
            key={tender.id}
            onClick={() => setSelectedTenderId(tender.id)}
            data-testid={`tender-card-${tender.id}`}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
              selectedTenderId === tender.id
                ? 'border-purple-600 bg-purple-50/40 ring-1 ring-purple-500'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
}`}
          >
<div>
<div className="flex justify-between items-start gap-2">
<span className="tabular-nums text-xs font-bold text-slate-700">{tender.tenderRef}</span>
<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(tender.status)}`}>
                  {statusLabel(tender.status)}
</span>
</div>
<h4 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{tender.title}</h4>
<span className="text-[11px] text-slate-500 block mt-1">Category: {tender.category}</span>
</div>

<div className="mt-3 pt-2 border-t border-slate-200/60 text-xs">
<div className="flex justify-between items-center text-[11px]">
<span className="text-slate-500">Est. Budget:</span>
<span className="tabular-nums font-bold text-slate-900">{formatMoney(tender.estimatedBudgetKes)}</span>
</div>
<div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
<span>Deadline: {tender.submissionDeadline}</span>
<span>{tender.bids.length} Bid{tender.bids.length !== 1 ? 's' : ''}</span>
</div>
</div>
</button>
))}
</div>
);

export const TenderDetailPanel: React.FC<{
  activeTender: TenderPackage;
  awardedBid: ContractorBid | undefined;
  onSubmitBid: () => void;
  onAwardTender: (bidId: string) => void;
  formatCombinedScore: (score: number) => string;
}> = ({ activeTender, awardedBid, onSubmitBid, onAwardTender, formatCombinedScore }) => (
<div className="bg-slate-50/60 rounded-xl border border-slate-200 p-5 space-y-6">
        {/* Header of selected tender */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<div className="flex items-center gap-2">
<span className="tabular-nums text-sm font-bold text-purple-800">{activeTender.tenderRef}</span>
<span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(activeTender.status)}`}>
                  {statusLabel(activeTender.status)}
</span>
<span className="text-xs text-slate-500 font-medium">Category: {activeTender.category}</span>
</div>
<h3 className="text-base font-bold text-slate-900 mt-1">{activeTender.title}</h3>
</div>

<div className="text-left sm:text-right text-xs">
<span className="text-[10px] font-semibold text-slate-600 block">
                Estimated Project Budget
</span>
<span className="text-base tabular-nums font-bold text-slate-900">
                {formatMoney(activeTender.estimatedBudgetKes)}
</span>
<span className="text-[11px] text-slate-500 block">Deadline: {activeTender.submissionDeadline}</span>
</div>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
<div className="flex items-center gap-2">
<span className="font-semibold text-slate-700">Required NCA Registration:</span>
<span className="font-bold text-slate-900">{activeTender.ncaRequirement}</span>
</div>
<p className="text-slate-600 mt-1">{activeTender.scopeDescription}</p>
</div>

          {activeTender.status === 'AWARDED' && awardedBid && (
<div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-1">
<div className="flex items-center gap-2">
<span className="text-base"></span>
<span className="font-bold text-emerald-900">Official Tender Award Notice</span>
<span className="text-[10px] tabular-nums text-emerald-700 ml-auto">{activeTender.awardedAt}</span>
</div>
<p className="text-emerald-800">
                Contract officially awarded to<strong className="font-bold">{awardedBid.contractorName}</strong> ({awardedBid.ncaCategory}) at the competitively evaluated sum of<strong className="tabular-nums font-bold">{formatMoney(awardedBid.bidAmountKes)}</strong>.
</p>
</div>
)}
</div>

        {/* Tender Evaluation View & Ranked Bids Table */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-slate-600 block">
                Evaluation Metric: Technical 70% | Financial 30%
</span>
<h4 className="text-sm font-bold text-slate-900">
                Ranked Contractor Bids &amp; Commercial Evaluation
</h4>
</div>

<span className="text-xs font-semibold text-slate-600">
              {activeTender.bids.length} Responsive Bid{activeTender.bids.length !== 1 ? 's' : ''} Received
</span>
</div>

          {activeTender.bids.length === 0 ? (
<div className="p-8 text-center text-slate-600 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
<p>No contractor bids submitted yet for this tender package.</p>
<button
                onClick={onSubmitBid}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-2xs inline-block"
              >
                Submit First Bid
</button>
</div>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left text-xs border-collapse">
<thead>
<tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
<th className="py-2.5 px-3">Rank</th>
<th className="py-2.5 px-3">Contractor Name &amp; NCA</th>
<th className="py-2.5 px-3">Bid Amount (KES)</th>
<th className="py-2.5 px-3">Duration</th>
<th className="py-2.5 px-3">Technical (70%)</th>
<th className="py-2.5 px-3">Financial (30%)</th>
<th className="py-2.5 px-3">Combined Score</th>
<th className="py-2.5 px-3 text-right">Award Action</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
                  {activeTender.bids.map((bid) => {
                    const isAwarded = activeTender.awardedBidId === bid.id;
                    return (
<tr
                        key={bid.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isAwarded ? 'bg-emerald-50/50' : bid.rank === 1 ? 'bg-purple-50/20' : ''
}`}
                      >
<td className="py-3 px-3">
                          {bid.rank === 1 ? (
<span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                               Rank 1
</span>
) : bid.rank === 2 ? (
<span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                               Rank 2
</span>
) : (
<span className="font-bold text-amber-900 bg-amber-100/50 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                               Rank {bid.rank}
</span>
)}
</td>
<td className="py-3 px-3">
<span className="font-bold text-slate-900 block">{bid.contractorName}</span>
<span className="text-[11px] text-slate-500">
                            {bid.ncaCategory} • {bid.contactPerson} ({bid.contactPhone})
</span>
</td>
<td className="py-3 px-3 tabular-nums font-bold text-slate-900">
                          {formatMoney(bid.bidAmountKes)}
</td>
<td className="py-3 px-3 font-medium text-slate-700">
                          {bid.durationWeeks} Weeks
</td>
<td className="py-3 px-3">
<span className="font-bold text-blue-700">{bid.technicalScore.toFixed(1)} / 100</span>
<span className="text-[10px] text-slate-600 block tabular-nums">
                            Weighted: {(bid.technicalScore * 0.7).toFixed(1)}
</span>
</td>
<td className="py-3 px-3">
<span className="font-bold text-emerald-700">{bid.financialScore.toFixed(1)} / 100</span>
<span className="text-[10px] text-slate-600 block tabular-nums">
                            Weighted: {(bid.financialScore * 0.3).toFixed(1)}
</span>
</td>
<td className="py-3 px-3">
<span className="text-sm font-bold tabular-nums text-purple-900">
                            {formatCombinedScore(bid.combinedScore)} pts
</span>
</td>
<td className="py-3 px-3 text-right">
                          {isAwarded ? (
<span className="px-3 py-1 bg-emerald-700 text-white font-bold rounded text-xs shadow-2xs inline-block">
                               Contract Awarded
</span>
) : (
<button
                              onClick={() => onAwardTender(bid.id)}
                              data-testid={`award-bid-btn-${bid.id}`}
                              className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded text-xs shadow-2xs transition"
                            >
                              Award Tender
</button>
)}
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}

          {/* Trade breakdown cards for bids */}
          {activeTender.bids.length > 0 && (
<div className="pt-2 border-t border-slate-100">
<span className="text-[11px] font-bold text-slate-600 block mb-2">
                Bill of Quantities Trade Breakdown by Responsive Bidder:
</span>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {activeTender.bids.map((b) => (
<div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
<div className="flex justify-between items-center">
<span className="font-bold text-slate-900 truncate">{b.contractorName}</span>
<span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                        Rank {b.rank}
</span>
</div>
<div className="space-y-1 text-[11px] pt-1">
<div className="flex justify-between text-slate-600">
<span>Direct Labor:</span>
<span className="tabular-nums">{formatMoney(b.tradeBreakdown.labor)}</span>
</div>
<div className="flex justify-between text-slate-600">
<span>Materials Supply:</span>
<span className="tabular-nums">{formatMoney(b.tradeBreakdown.materials)}</span>
</div>
<div className="flex justify-between text-slate-600">
<span>Plant &amp; Equipment:</span>
<span className="tabular-nums">{formatMoney(b.tradeBreakdown.plantEquipment)}</span>
</div>
<div className="flex justify-between text-slate-600">
<span>Preliminaries &amp; Overheads:</span>
<span className="tabular-nums">{formatMoney(b.tradeBreakdown.preliminaries)}</span>
</div>
</div>
</div>
))}
</div>
</div>
)}
</div>
</div>
);
