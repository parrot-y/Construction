import React, { useState} from 'react';
import { formatMoney } from '@construction/money';
import { PRODUCT_NAME } from '../lib/product';
import { formatDateTime } from '../lib/format';
import {
  ActionSuccessBanner,
  DEFAULT_TENDERS,
  TenderBoardHeader,
  TenderCardsGrid,
  TenderDetailPanel,
  TenderFilterTabs,
} from './ContractorTenderBoardView.parts';
import { PostTenderModal } from './PostTenderModal';
import { BidSubmissionModal } from './BidSubmissionModal';

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

export default function ContractorTenderBoardView({
  projectId: _projectId = '',
  projectName = '',
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
    return scored.map((b, idx) => ({ ...b, rank: idx + 1}));
};

  const handlePostTender = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTender: TenderPackage = {
      id: `tnd-2026-${String(tenders.length + 1).padStart(3, '0')}`,
      tenderRef: `SSF-TND-2026-PKG-${String(tenders.length + 1).padStart(2, '0')}`,
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
    setActionSuccess(`Tender package"${newTender.title}" successfully posted to ${PRODUCT_NAME} Tender Board!`);
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
      submittedAt: formatDateTime(new Date()) + ' EAT',
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
    setActionSuccess(`Bid of ${formatMoney(bidAmountKes)} from ${bidContractorName} successfully submitted and ranked.`);
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
          awardedAt: formatDateTime(new Date()) + ' EAT',
};
}
      return t;
});

    setTenders(updated);
    setActionSuccess(`Tender ${targetRef} successfully AWARDED to ${winningBid.contractorName} for ${formatMoney(winningBid.bidAmountKes)}!`);
    if (onTenderAwarded) onTenderAwarded(targetTenderId, bidId);
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
<TenderBoardHeader
        projectName={projectName}
        onPostTender={() => setShowPostTenderModal(true)}
        onSubmitBid={() => setShowBidModal(true)}
      />

      {actionSuccess && (
<ActionSuccessBanner message={actionSuccess} onDismiss={() => setActionSuccess(null)} />
)}

      {/* Filter Tabs */}
<TenderFilterTabs
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filteredCount={filteredTenders.length}
      />

      {/* Active Tenders Cards Register */}
<TenderCardsGrid
        tenders={filteredTenders}
        selectedTenderId={selectedTenderId}
        setSelectedTenderId={setSelectedTenderId}
      />

      {/* Selected Tender Detail & Evaluation View */}
<TenderDetailPanel
        activeTender={activeTender}
        awardedBid={awardedBid}
        onSubmitBid={() => setShowBidModal(true)}
        onAwardTender={handleAwardTender}
        formatCombinedScore={(score) => score.toFixed(2)}
      />

      {/* Post New Tender Modal */}
      {showPostTenderModal && (
<PostTenderModal
          onClose={() => setShowPostTenderModal(false)}
          onSubmit={handlePostTender}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          newBudgetKes={newBudgetKes}
          setNewBudgetKes={setNewBudgetKes}
          newDeadline={newDeadline}
          setNewDeadline={setNewDeadline}
          newNca={newNca}
          setNewNca={setNewNca}
          newScope={newScope}
          setNewScope={setNewScope}
        />
)}

      {/* Bid Submission Modal */}
      {showBidModal && (
<BidSubmissionModal
          tenderTitle={activeTender.title}
          onClose={() => setShowBidModal(false)}
          onSubmit={handleSubmitBid}
          bidContractorName={bidContractorName}
          setBidContractorName={setBidContractorName}
          bidNcaCategory={bidNcaCategory}
          setBidNcaCategory={setBidNcaCategory}
          bidAmountKes={bidAmountKes}
          setBidAmountKes={setBidAmountKes}
          bidDurationWeeks={bidDurationWeeks}
          setBidDurationWeeks={setBidDurationWeeks}
          bidLabor={bidLabor}
          setBidLabor={setBidLabor}
          bidMaterials={bidMaterials}
          setBidMaterials={setBidMaterials}
          bidPlant={bidPlant}
          setBidPlant={setBidPlant}
          bidPrelims={bidPrelims}
          setBidPrelims={setBidPrelims}
          bidContactPerson={bidContactPerson}
          setBidContactPerson={setBidContactPerson}
          bidContactPhone={bidContactPhone}
          setBidContactPhone={setBidContactPhone}
          bidPastProjects={bidPastProjects}
          setBidPastProjects={setBidPastProjects}
        />
)}
</div>
);
}
