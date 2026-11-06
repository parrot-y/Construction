import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';

export type TenderStatus = 'OPEN' | 'UNDER_REVIEW' | 'AWARDED';

export interface TradeBreakdown {
  labor: string;
  materials: string;
  plantEquipment: string;
  preliminaries: string;
}

export interface ContractorBid {
  id: string;
  contractorName: string;
  ncaCategory: string; // e.g., 'NCA 3', 'NCA 4'
  bidAmountKes: string;
  durationWeeks: number;
  tradeBreakdown: TradeBreakdown;
  technicalScore: number; // 0 - 100
  financialScore: number; // 0 - 100
  combinedScore: number; // technical * 0.70 + financial * 0.30
  rank: number;
  contactPerson: string;
  contactPhone: string;
  pastProjectsSummary: string;
  submittedAt: string;
}

export interface TenderPackage {
  id: string;
  tenderRef: string;
  title: string;
  category: string;
  estimatedBudgetKes: string;
  submissionDeadline: string;
  status: TenderStatus;
  ncaRequirement: string;
  scopeDescription: string;
  bids: ContractorBid[];
  awardedBidId?: string | null;
  awardedAt?: string | null;
}

interface ContractorTenderBoardViewProps {
  projectId?: string;
  projectName?: string;
  userRole?: string;
  onTenderCreated?: (tender: TenderPackage) => void;
  onBidSubmitted?: (tenderId: string, bid: ContractorBid) => void;
  onTenderAwarded?: (tenderId: string, bidId: string) => void;
}

const DEFAULT_TENDERS: TenderPackage[] = [
  {
    id: 'tnd-2026-001',
    tenderRef: 'BDS-TND-2026-STR-01',
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
    tenderRef: 'BDS-TND-2026-BHOLE-02',
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
    tenderRef: 'BDS-TND-2026-FAC-03',
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

export default function ContractorTenderBoardView({
  projectId: _projectId = 'project-rcp-2026',
  projectName = 'Riverside Commercial Plaza',
  userRole: _userRole = 'PM_QS',
  onTenderCreated,
  onBidSubmitted,
  onTenderAwarded,
}: ContractorTenderBoardViewProps): React.JSX.Element {
  const [tenders, setTenders] = useState<TenderPackage[]>(DEFAULT_TENDERS);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(
    DEFAULT_TENDERS[0]?.id ?? 'tnd-2026-001'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenderStatus>('ALL');

  // Modals state
  const [showPostTenderModal, setShowPostTenderModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Tender Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Finishes & Façade');
  const [newBudgetKes, setNewBudgetKes] = useState('5000000.00');
  const [newDeadline, setNewDeadline] = useState('2026-12-15');
  const [newNca, setNewNca] = useState('NCA 4 (Building Works)');
  const [newScope, setNewScope] = useState('');

  // Bid Submission Form State
  const [bidContractorName, setBidContractorName] = useState('');
  const [bidNcaCategory, setBidNcaCategory] = useState('NCA 4');
  const [bidAmountKes, setBidAmountKes] = useState('18000000.00');
  const [bidDurationWeeks, setBidDurationWeeks] = useState(12);
  const [bidLabor, setBidLabor] = useState('5000000.00');
  const [bidMaterials, setBidMaterials] = useState('10000000.00');
  const [bidPlant, setBidPlant] = useState('1800000.00');
  const [bidPrelims, setBidPrelims] = useState('1200000.00');
  const [bidContactPerson, setBidContactPerson] = useState('');
  const [bidContactPhone, setBidContactPhone] = useState('+254 7');
  const [bidPastProjects, setBidPastProjects] = useState('');

  const activeTender = tenders.find((t) => t.id === selectedTenderId) ?? tenders[0];

  const filteredTenders =
    statusFilter === 'ALL' ? tenders : tenders.filter((t) => t.status === statusFilter);

  // Re-evaluates rankings whenever bids change:
  // Technical 70%, Financial 30% (Financial score = lowest_bid / current_bid * 100)
  const calculateRankedBids = (bids: ContractorBid[]): ContractorBid[] => {
    if (bids.length === 0) return [];
    const minBid = Math.min(...bids.map((b) => parseFloat(b.bidAmountKes) || 1));
    const scored = bids.map((b) => {
      const amount = parseFloat(b.bidAmountKes) || minBid;
      const finScore = parseFloat(((minBid / amount) * 100).toFixed(2));
      const combined = parseFloat((b.technicalScore * 0.7 + finScore * 0.3).toFixed(2));
      return {
        ...b,
        financialScore: finScore,
        combinedScore: combined,
      };
    });
    // Sort descending by combinedScore
    scored.sort((a, b) => b.combinedScore - a.combinedScore);
    return scored.map((b, idx) => ({ ...b, rank: idx + 1 }));
  };

  const handlePostTender = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTender: TenderPackage = {
      id: `tnd-2026-${String(tenders.length + 1).padStart(3, '0')}`,
      tenderRef: `BDS-TND-2026-PKG-${String(tenders.length + 1).padStart(2, '0')}`,
      title: newTitle.trim(),
      category: newCategory,
      estimatedBudgetKes: newBudgetKes.trim() || '0.00',
      submissionDeadline: newDeadline,
      status: 'OPEN',
      ncaRequirement: newNca,
      scopeDescription: newScope.trim() || 'Standard EASMM 2008 scope specification.',
      bids: [],
      awardedBidId: null,
      awardedAt: null,
    };

    setTenders([newTender, ...tenders]);
    setSelectedTenderId(newTender.id);
    setShowPostTenderModal(false);
    setActionSuccess(`Tender package "${newTender.title}" successfully posted to Platform Tender Board!`);
    setNewTitle('');
    setNewScope('');
    if (onTenderCreated) onTenderCreated(newTender);
  };

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTender || !bidContractorName.trim()) return;
    const targetTenderId = activeTender.id;

    const rawTechnical = 85.0 + Math.floor(Math.random() * 10);
    const newBid: ContractorBid = {
      id: `bid-${Date.now()}`,
      contractorName: bidContractorName.trim(),
      ncaCategory: bidNcaCategory,
      bidAmountKes: bidAmountKes.trim(),
      durationWeeks: Number(bidDurationWeeks),
      tradeBreakdown: {
        labor: bidLabor.trim(),
        materials: bidMaterials.trim(),
        plantEquipment: bidPlant.trim(),
        preliminaries: bidPrelims.trim(),
      },
      technicalScore: rawTechnical,
      financialScore: 100.0,
      combinedScore: rawTechnical,
      rank: 1,
      contactPerson: bidContactPerson.trim() || 'Managing Director',
      contactPhone: bidContactPhone.trim(),
      pastProjectsSummary: bidPastProjects.trim() || 'Past commercial construction works verified.',
      submittedAt: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) + ' EAT',
    };

    const updatedBids = calculateRankedBids([...activeTender.bids, newBid]);
    const updatedTenders = tenders.map((t) => {
      if (t.id === targetTenderId) {
        return {
          ...t,
          status: 'UNDER_REVIEW' as TenderStatus,
          bids: updatedBids,
        };
      }
      return t;
    });

    setTenders(updatedTenders);
    setShowBidModal(false);
    setActionSuccess(`Bid of KES ${toCurrencyString(bidAmountKes)} from ${bidContractorName} successfully submitted and ranked.`);
    setBidContractorName('');
    setBidPastProjects('');
    if (onBidSubmitted) onBidSubmitted(targetTenderId, newBid);
  };

  const handleAwardTender = (bidId: string) => {
    if (!activeTender) return;
    const winningBid = activeTender.bids.find((b) => b.id === bidId);
    if (!winningBid) return;
    const targetTenderId = activeTender.id;
    const targetRef = activeTender.tenderRef;

    const updated = tenders.map((t) => {
      if (t.id === targetTenderId) {
        return {
          ...t,
          status: 'AWARDED' as TenderStatus,
          awardedBidId: bidId,
          awardedAt: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) + ' EAT',
        };
      }
      return t;
    });

    setTenders(updated);
    setActionSuccess(`Tender ${targetRef} successfully AWARDED to ${winningBid.contractorName} for KES ${toCurrencyString(winningBid.bidAmountKes)}!`);
    if (onTenderAwarded) onTenderAwarded(targetTenderId, bidId);
  };

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

  if (!activeTender) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-xs">
        No tender package selected.
      </div>
    );
  }

  const awardedBid = activeTender.bids.find((b) => b.id === activeTender.awardedBidId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              BORAQS / EASMM Compliant
            </span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Technical 70% • Financial 30% Evaluation
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Platform Contractor Tender Board &amp; Bidding Studio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent e-tendering, automated combined score ranking, and contractor contract awards for {projectName}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowPostTenderModal(true)}
            data-testid="post-tender-btn"
            className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <span>+ Post New Tender</span>
          </button>
          <button
            onClick={() => setShowBidModal(true)}
            data-testid="submit-bid-btn"
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <span>📝 Submit Contractor Bid</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex justify-between items-center">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold text-emerald-900 ml-2">×</button>
        </div>
      )}

      {/* Filter Tabs */}
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

        <span className="text-xs text-slate-500 font-mono">
          Showing {filteredTenders.length} Tender Package{filteredTenders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active Tenders Cards Register */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {filteredTenders.map((tender) => (
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
                <span className="font-mono text-xs font-bold text-slate-700">{tender.tenderRef}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(tender.status)}`}>
                  {tender.status}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{tender.title}</h4>
              <span className="text-[11px] text-slate-500 block mt-1">Category: {tender.category}</span>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Est. Budget:</span>
                <span className="font-mono font-bold text-slate-900">KES {toCurrencyString(tender.estimatedBudgetKes)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
                <span>Deadline: {tender.submissionDeadline}</span>
                <span>{tender.bids.length} Bid{tender.bids.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Tender Detail & Evaluation View */}
      <div className="bg-slate-50/60 rounded-xl border border-slate-200 p-5 space-y-6">
        {/* Header of selected tender */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-purple-800">{activeTender.tenderRef}</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(activeTender.status)}`}>
                  {activeTender.status}
                </span>
                <span className="text-xs text-slate-500 font-medium">Category: {activeTender.category}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">{activeTender.title}</h3>
            </div>

            <div className="text-left sm:text-right text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Estimated Project Budget
              </span>
              <span className="text-base font-mono font-bold text-slate-900">
                KES {toCurrencyString(activeTender.estimatedBudgetKes)}
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
                <span className="text-base">🏆</span>
                <span className="font-bold text-emerald-900">Official Tender Award Notice</span>
                <span className="text-[10px] font-mono text-emerald-700 ml-auto">{activeTender.awardedAt}</span>
              </div>
              <p className="text-emerald-800">
                Contract officially awarded to <strong className="font-bold">{awardedBid.contractorName}</strong> ({awardedBid.ncaCategory}) at the competitively evaluated sum of <strong className="font-mono font-bold">KES {toCurrencyString(awardedBid.bidAmountKes)}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Tender Evaluation View & Ranked Bids Table */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
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
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
              <p>No contractor bids submitted yet for this tender package.</p>
              <button
                onClick={() => setShowBidModal(true)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-2xs inline-block"
              >
                Submit First Bid
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
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
                              🥇 Rank 1
                            </span>
                          ) : bid.rank === 2 ? (
                            <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              🥈 Rank 2
                            </span>
                          ) : (
                            <span className="font-bold text-amber-900 bg-amber-100/50 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              🥉 Rank {bid.rank}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{bid.contractorName}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {bid.ncaCategory} • {bid.contactPerson} ({bid.contactPhone})
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          KES {toCurrencyString(bid.bidAmountKes)}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">
                          {bid.durationWeeks} Weeks
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-blue-700">{bid.technicalScore.toFixed(1)} / 100</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Weighted: {(bid.technicalScore * 0.7).toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-emerald-700">{bid.financialScore.toFixed(1)} / 100</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Weighted: {(bid.financialScore * 0.3).toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm font-bold font-mono text-purple-900">
                            {bid.combinedScore.toFixed(2)} pts
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isAwarded ? (
                            <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded text-xs shadow-2xs inline-block">
                              ✓ Contract Awarded
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAwardTender(bid.id)}
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
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
                        <span className="font-mono">KES {toCurrencyString(b.tradeBreakdown.labor)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Materials Supply:</span>
                        <span className="font-mono">KES {toCurrencyString(b.tradeBreakdown.materials)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Plant &amp; Equipment:</span>
                        <span className="font-mono">KES {toCurrencyString(b.tradeBreakdown.plantEquipment)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Preliminaries &amp; Overheads:</span>
                        <span className="font-mono">KES {toCurrencyString(b.tradeBreakdown.preliminaries)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post New Tender Modal */}
      {showPostTenderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                  EASMM Commercial Studio
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Post New Contractor Tender</h3>
              </div>
              <button
                onClick={() => setShowPostTenderModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePostTender} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="tender-title" className="block font-semibold text-slate-700 mb-1">
                  Tender Package Title:
                </label>
                <input
                  id="tender-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Electrical 1st and 2nd Fix Reticulation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tender-category" className="block font-semibold text-slate-700 mb-1">
                    Trade Category:
                  </label>
                  <select
                    id="tender-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Structural Works">Structural Works</option>
                    <option value="Mechanical & Water Works">Mechanical &amp; Water Works</option>
                    <option value="Electrical & Solar Works">Electrical &amp; Solar Works</option>
                    <option value="Finishes & Façade">Finishes &amp; Façade</option>
                    <option value="Roofing & Waterproofing">Roofing &amp; Waterproofing</option>
                    <option value="Civil Earthworks & Paving">Civil Earthworks &amp; Paving</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="tender-nca" className="block font-semibold text-slate-700 mb-1">
                    NCA Category Required:
                  </label>
                  <select
                    id="tender-nca"
                    value={newNca}
                    onChange={(e) => setNewNca(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="NCA 1 (Unlimited)">NCA 1 (Unlimited)</option>
                    <option value="NCA 2 (Up to 500M)">NCA 2 (Up to 500M)</option>
                    <option value="NCA 3 (Up to 300M)">NCA 3 (Up to 300M)</option>
                    <option value="NCA 4 (Up to 150M)">NCA 4 (Up to 150M)</option>
                    <option value="NCA 5 (Up to 50M)">NCA 5 (Up to 50M)</option>
                    <option value="NCA 6 (Up to 20M)">NCA 6 (Up to 20M)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tender-budget" className="block font-semibold text-slate-700 mb-1">
                    Estimated Budget (KES):
                  </label>
                  <input
                    id="tender-budget"
                    type="text"
                    required
                    value={newBudgetKes}
                    onChange={(e) => setNewBudgetKes(e.target.value)}
                    placeholder="e.g. 5000000.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label htmlFor="tender-deadline" className="block font-semibold text-slate-700 mb-1">
                    Submission Deadline:
                  </label>
                  <input
                    id="tender-deadline"
                    type="date"
                    required
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tender-scope" className="block font-semibold text-slate-700 mb-1">
                  Scope of Works Description:
                </label>
                <textarea
                  id="tender-scope"
                  rows={3}
                  required
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  placeholder="Detail the technical specifications, delivery milestones, and quality standards."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPostTenderModal(false)}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="confirm-post-tender-btn"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  Publish Tender Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bid Submission Modal */}
      {showBidModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Subcontractor / Contractor Bidding
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Submit Bid: {activeTender.title}
                </h3>
              </div>
              <button
                onClick={() => setShowBidModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bid-contractor-name" className="block font-semibold text-slate-700 mb-1">
                    Contractor Enterprise Name:
                  </label>
                  <input
                    id="bid-contractor-name"
                    type="text"
                    required
                    value={bidContractorName}
                    onChange={(e) => setBidContractorName(e.target.value)}
                    placeholder="e.g. Coast Engineering Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="bid-nca-cat" className="block font-semibold text-slate-700 mb-1">
                    NCA Category:
                  </label>
                  <select
                    id="bid-nca-cat"
                    value={bidNcaCategory}
                    onChange={(e) => setBidNcaCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="NCA 1">NCA 1</option>
                    <option value="NCA 2">NCA 2</option>
                    <option value="NCA 3">NCA 3</option>
                    <option value="NCA 4">NCA 4</option>
                    <option value="NCA 5">NCA 5</option>
                    <option value="NCA 6">NCA 6</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bid-amount-kes" className="block font-semibold text-slate-700 mb-1">
                    Total Lump-Sum Bid (KES):
                  </label>
                  <input
                    id="bid-amount-kes"
                    type="text"
                    required
                    value={bidAmountKes}
                    onChange={(e) => setBidAmountKes(e.target.value)}
                    placeholder="e.g. 18000000.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="bid-duration-weeks" className="block font-semibold text-slate-700 mb-1">
                    Execution Duration (Weeks):
                  </label>
                  <input
                    id="bid-duration-weeks"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={bidDurationWeeks}
                    onChange={(e) => setBidDurationWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Trade breakdown inputs */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="font-bold text-slate-800 block text-[11px]">
                  BOQ Trade Component Breakdown (KES):
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Direct Labor (KES):</label>
                    <input
                      type="text"
                      value={bidLabor}
                      onChange={(e) => setBidLabor(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Materials Supply (KES):</label>
                    <input
                      type="text"
                      value={bidMaterials}
                      onChange={(e) => setBidMaterials(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Plant &amp; Equipment (KES):</label>
                    <input
                      type="text"
                      value={bidPlant}
                      onChange={(e) => setBidPlant(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Preliminaries (KES):</label>
                    <input
                      type="text"
                      value={bidPrelims}
                      onChange={(e) => setBidPrelims(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bid-contact-person" className="block font-semibold text-slate-700 mb-1">
                    Contact Representative:
                  </label>
                  <input
                    id="bid-contact-person"
                    type="text"
                    required
                    value={bidContactPerson}
                    onChange={(e) => setBidContactPerson(e.target.value)}
                    placeholder="e.g. Eng. Peter Otieno"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="bid-contact-phone" className="block font-semibold text-slate-700 mb-1">
                    Official Mobile / WhatsApp:
                  </label>
                  <input
                    id="bid-contact-phone"
                    type="text"
                    required
                    value={bidContactPhone}
                    onChange={(e) => setBidContactPhone(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bid-past-projects" className="block font-semibold text-slate-700 mb-1">
                  Track Record &amp; Similar Works:
                </label>
                <textarea
                  id="bid-past-projects"
                  rows={2}
                  required
                  value={bidPastProjects}
                  onChange={(e) => setBidPastProjects(e.target.value)}
                  placeholder="e.g. Executed structural frame for Westlands Heights and Parklands commercial plaza."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="px-3.5 py-2 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="confirm-submit-bid-btn"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-sm"
                >
                  Submit Responsive Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
