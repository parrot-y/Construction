export interface ProjectHeaderInfo {
  id: string;
  name: string;
  code: string;
  location?: string | null;
  ncaRegistrationNo?: string | null;
  startDate?: string | null;
  targetEndDate?: string | null;
}

export interface TenantInfo {
  id: string;
  name: string;
  kraPin?: string | null;
  ncaCategory?: string | null;
  currency: string;
}

export interface PaymentCertificateData {
  certificateNo: string;
  valuationDate: string;
  project: ProjectHeaderInfo;
  employer: {
    name: string;
    organization?: string;
  };
  contractor: TenantInfo;
  consultant: {
    qsName: string;
    boraqsRegistrationNo: string;
    firmName?: string;
  };
  financials: {
    contractSum: string;
    approvedVariations: string;
    revisedContractSum: string;
    grossValuation: string;
    retentionDeductionRate: string; // e.g. "10%"
    retentionDeducted: string;
    retentionMaxCapRate: string; // e.g. "5%"
    retentionMaxCapAmount: string;
    cumulativeNetValuation: string;
    previousPaymentsCertified: string;
    netAmountDue: string;
  };
  notes?: string;
}

export interface LaborTradeEntry {
  tradeType: string;
  headcount: number;
}

export interface MaterialDeliveryEntry {
  materialName: string;
  quantity: string;
  unit: string;
  supplierName?: string | null;
  deliveryNote?: string | null;
}

export interface PhotoEvidenceEntry {
  id: string;
  caption?: string | null;
  storageKey: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  takenAt: string;
  isNairobiGeotagged: boolean;
}

export interface SiteDiaryReportData {
  project: ProjectHeaderInfo;
  contractor: TenantInfo;
  diary: {
    id: string;
    entryDate: string;
    weather: string;
    siteStatus: string;
    generalNotes?: string | null;
    recordedByName: string;
  };
  laborHeadcounts: LaborTradeEntry[];
  totalLaborHeadcount: number;
  materialDeliveries: MaterialDeliveryEntry[];
  photos: PhotoEvidenceEntry[];
}

export interface SectionSummaryEntry {
  title: string;
  allocatedBudget: string;
  actualSpent: string;
  remainingBudget: string;
  consumptionPercentage: string;
  status: 'NORMAL' | 'WATCH' | 'OVERRUN';
}

export interface ProjectSummaryData {
  project: ProjectHeaderInfo;
  contractor: TenantInfo;
  generatedAt: string;
  financials: {
    originalAgreedBudget: string;
    approvedVariationsTotal: string;
    currentApprovedBudget: string;
    totalSpentToDate: string;
    remainingBalance: string;
    budgetUsedPercentage: number;
  };
  progress: {
    physicalProgressPercentage: number;
    varianceDelta: number;
    healthStatus: 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED';
    healthNotice: string;
  };
  sections: SectionSummaryEntry[];
}

export interface IndependentInspectionReportData {
  inspectionId: string;
  reportRef: string;
  project: ProjectHeaderInfo;
  contractor: TenantInfo;
  stage: string;
  urgency: string;
  inspectionDate: string;
  conductedDate?: string | null;
  status: string;
  requestedBy: string;
  inspector: {
    name: string;
    license: string;
    latitude?: number | null;
    longitude?: number | null;
    arrivalTimestamp?: string | null;
  };
  metrics: {
    reportedProgressPct: string;
    verifiedProgressPct: string;
    variancePct: string;
    varianceStatus: string;
    isInflationFlagged: boolean;
    recommendedAction: string;
  };
  scopeDescription: string;
  materialsOnSiteNotes?: string | null;
  structuralDefectsFound: boolean;
  workmanshipRating?: number | null;
  safetyComplianceRating?: number | null;
  findingsNotes?: string | null;
  recommendations?: string | null;
  clientReviewNotes?: string | null;
  clientSatisfactionRating?: number | null;
  clientDiscrepancyFlagged: boolean;
  photos: Array<{
    id: string;
    photoUrl: string;
    caption?: string | null;
    elementInspected?: string | null;
    hasDiscrepancy: boolean;
    gpsLatitude?: number | null;
    gpsLongitude?: number | null;
    capturedAt: string;
  }>;
  securityHash: string; // SHA-256 tamper-evident verification hash
}

