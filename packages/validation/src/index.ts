import { z } from 'zod';

export const TenantIdSchema = z.string().uuid({ message: 'Invalid tenant identifier' });
export const ProjectIdSchema = z.string().uuid({ message: 'Invalid project identifier' });

export const CurrencyAmountSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, { message: 'Must be a valid decimal amount with up to 2 decimal places' });

export const UnitRateSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, { message: 'Unit rate must be a positive decimal with up to 4 decimal places' });

export const QuantitySchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, { message: 'Quantity must be a positive decimal with up to 4 decimal places' });

export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  version: z.string(),
});

export const KenyanPhoneSchema = z
  .string()
  .regex(/^(?:\+?254|0)[17]\d{8}$/, { message: 'Must be a valid Kenyan mobile phone number (e.g., +254712345678, 254712345678, or 0712345678)' });

export const LoginRequestSchema = z.object({
  email: z.string().email({ message: 'Must be a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  tenantId: z.string().uuid().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    phoneNumber: z.string().nullable().optional(),
    role: z.string(),
    tenant: z.object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      currency: z.string(),
    }),
  }),
  permissions: z.array(z.string()),
  token: z.string(),
});

export const CostCategoryEnum = z.enum([
  'MATERIAL',
  'LABOR',
  'PLANT',
  'SUBCONTRACT',
  'PRELIMINARY',
]);
export type CostCategory = z.infer<typeof CostCategoryEnum>;

export const CostStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'VOIDED',
]);
export type CostStatus = z.infer<typeof CostStatusEnum>;

export const CreateCostEntrySchema = z.object({
  projectId: z.string().uuid(),
  boqItemId: z.string().uuid().optional().nullable(),
  costCategory: CostCategoryEnum,
  amount: CurrencyAmountSchema,
  vendorName: z.string().max(255).optional().nullable(),
  invoiceRef: z.string().max(100).optional().nullable(),
  description: z.string().min(3).max(2000),
  receipts: z
    .array(
      z.object({
        filename: z.string().max(255),
        fileSize: z.number().int().positive().max(10 * 1024 * 1024),
        mimeType: z.string().max(100),
        storageKey: z.string().max(500),
      }),
    )
    .optional(),
});
export type CreateCostEntry = z.infer<typeof CreateCostEntrySchema>;

export const ApproveCostEntrySchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().max(1000).optional().nullable(),
});
export type ApproveCostEntry = z.infer<typeof ApproveCostEntrySchema>;

export const VoidCostEntrySchema = z.object({
  reason: z.string().min(5).max(1000),
});
export type VoidCostEntry = z.infer<typeof VoidCostEntrySchema>;

// -------------------------------------------------------------
// SITE DIARY, PROGRESS & OFFLINE QUEUE SCHEMAS (MILESTONE M6)
// -------------------------------------------------------------

export const WeatherConditionEnum = z.enum([
  'SUNNY_CLEAR',
  'CLOUDY',
  'LIGHT_RAIN',
  'HEAVY_RAIN',
  'RAIN_DELAY',
  'DUST_STORM',
]);
export type WeatherCondition = z.infer<typeof WeatherConditionEnum>;

export const SiteStatusEnum = z.enum([
  'OPERATIONAL',
  'PARTIAL',
  'STOPPED',
]);
export type SiteStatus = z.infer<typeof SiteStatusEnum>;

export const TradeHeadcountSchema = z.object({
  tradeType: z.string().min(2).max(100),
  headcount: z.number().int().min(1).max(500),
});
export type TradeHeadcount = z.infer<typeof TradeHeadcountSchema>;

export const MaterialDeliverySchema = z.object({
  materialName: z.string().min(2).max(255),
  quantity: QuantitySchema,
  unit: z.string().min(1).max(20),
  supplierName: z.string().max(255).optional().nullable(),
  deliveryNote: z.string().max(100).optional().nullable(),
});
export type MaterialDelivery = z.infer<typeof MaterialDeliverySchema>;

export const SitePhotoInputSchema = z.object({
  storageKey: z.string().max(500),
  caption: z.string().max(255).optional().nullable(),
  takenAt: z.string().datetime().optional(),
  gpsLatitude: z.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.number().min(-180).max(180).optional().nullable(),
});
export type SitePhotoInput = z.infer<typeof SitePhotoInputSchema>;

export const CreateSiteDiarySchema = z.object({
  projectId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  weather: WeatherConditionEnum,
  siteStatus: SiteStatusEnum,
  generalNotes: z.string().max(4000).optional().nullable(),
  laborHeadcounts: z.array(TradeHeadcountSchema).optional(),
  deliveries: z.array(MaterialDeliverySchema).optional(),
  photos: z.array(SitePhotoInputSchema).optional(),
});
export type CreateSiteDiary = z.infer<typeof CreateSiteDiarySchema>;

export const ProgressItemRecordSchema = z.object({
  boqItemId: z.string().uuid(),
  completedQuantity: QuantitySchema,
  completionPct: z
    .string()
    .regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/, { message: 'Completion percentage must be a decimal between 0 and 1 (up to 4 decimals)' }),
});
export type ProgressItemRecord = z.infer<typeof ProgressItemRecordSchema>;

export const CreateProgressRecordSchema = z.object({
  projectId: z.string().uuid(),
  recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  overallProgress: z
    .string()
    .regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/, { message: 'Overall progress must be a decimal between 0 and 1' }),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(ProgressItemRecordSchema).optional(),
});
export type CreateProgressRecord = z.infer<typeof CreateProgressRecordSchema>;

// -------------------------------------------------------------
// VARIATION ORDERS WORKFLOW SCHEMAS (MILESTONE M8)
// -------------------------------------------------------------

export const VariationQuantitySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, {
    message: 'Variation quantity must be a decimal with up to 4 decimal places (positive for additions, negative for omissions)',
  });

export const VariationItemInputSchema = z.object({
  boqItemId: z.string().uuid().optional().nullable(),
  description: z.string().min(2).max(1000),
  unit: z.string().min(1).max(20),
  quantity: VariationQuantitySchema,
  unitRate: UnitRateSchema,
});
export type VariationItemInput = z.infer<typeof VariationItemInputSchema>;

export const CreateVariationOrderSchema = z.object({
  title: z.string().min(3).max(255),
  reason: z.string().min(5).max(4000),
  timeExtensionDays: z.number().int().min(0).max(3650).default(0),
  items: z.array(VariationItemInputSchema).min(1, { message: 'At least one variation item is required' }),
});
export type CreateVariationOrder = z.infer<typeof CreateVariationOrderSchema>;

export const ReviewVariationOrderSchema = z.object({
  action: z.enum(['EVALUATE', 'APPROVE', 'REJECT']),
  comments: z.string().max(2000).optional(),
});
export type ReviewVariationOrder = z.infer<typeof ReviewVariationOrderSchema>;

export const AcceptInvitationSchema = z.object({
  token: z.string().min(16, { message: 'Invalid invitation token' }).max(128),
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters long' }).max(255),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }).max(128).optional(),
});
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;

export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;


// -------------------------------------------------------------
// LIFECYCLE EXTENSIONS SCHEMAS
// -------------------------------------------------------------

// Domain 1: RFI
export const RfiPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RfiPriority = z.infer<typeof RfiPriorityEnum>;

export const RfiStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'ANSWERED',
  'REJECTED',
  'CLOSED',
]);
export type RfiStatus = z.infer<typeof RfiStatusEnum>;

export const RFIAttachmentInputSchema = z.object({
  storageKey: z.string().max(500),
  filename: z.string().max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().max(100),
});
export type RFIAttachmentInput = z.infer<typeof RFIAttachmentInputSchema>;

export const CreateRfiSchema = z.object({
  title: z.string().min(3).max(255),
  question: z.string().min(5),
  suggestedSolution: z.string().optional().nullable(),
  drawingReference: z.string().max(100).optional().nullable(),
  specificationClause: z.string().max(100).optional().nullable(),
  priority: RfiPriorityEnum.default('MEDIUM'),
  costImpact: z.boolean().default(false),
  scheduleImpactDays: z.number().int().min(0).default(0),
  assignedToRole: z.string().min(2).max(50),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  attachments: z.array(RFIAttachmentInputSchema).optional(),
});
export type CreateRfi = z.infer<typeof CreateRfiSchema>;

export const RespondRfiSchema = z.object({
  officialAnswer: z.string().min(3),
  isAccepted: z.boolean().default(true),
});
export type RespondRfi = z.infer<typeof RespondRfiSchema>;

// Domain 2: Quality Assurance & Inspections
export const ChecklistTypeEnum = z.enum([
  'PRE_POUR_CONCRETE',
  'SUBSTRUCTURE_EXCAVATION',
  'REBAR_VERIFICATION',
  'SCAFFOLDING_SAFETY',
  'WATERPROOFING_FLOOD_TEST',
  'MEP_PRESSURE_TEST',
  'PRE_PLASTER_WALLING',
  'PRE_HANDOVER_INSPECTION',
]);
export type ChecklistType = z.infer<typeof ChecklistTypeEnum>;

export const InspectionStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'APPROVED_WITHOUT_COMMENTS',
  'APPROVED_WITH_CONDITIONS',
  'REJECTED',
]);
export type InspectionStatus = z.infer<typeof InspectionStatusEnum>;

export const InspectionItemInputSchema = z.object({
  orderIdx: z.number().int().min(0),
  checkPoint: z.string().min(2).max(255),
  isMandatory: z.boolean().default(true),
});
export type InspectionItemInput = z.infer<typeof InspectionItemInputSchema>;

export const CreateInspectionChecklistSchema = z.object({
  checklistType: ChecklistTypeEnum,
  title: z.string().min(3).max(255),
  location: z.string().min(2).max(255),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  inspectorName: z.string().max(255).optional().nullable(),
  inspectorRole: z.string().max(100).optional().nullable(),
  summaryNotes: z.string().optional().nullable(),
  items: z.array(InspectionItemInputSchema).optional(),
});
export type CreateInspectionChecklist = z.infer<typeof CreateInspectionChecklistSchema>;

export const UpdateInspectionItemSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'N/A', 'PENDING']),
  deficiencyNotes: z.string().optional().nullable(),
  photoStorageKey: z.string().max(500).optional().nullable(),
});
export type UpdateInspectionItem = z.infer<typeof UpdateInspectionItemSchema>;

// Domain 3: Concrete Cube Tests
export const ConcreteClassEnum = z.enum([
  'CLASS_15_20',
  'CLASS_20_20',
  'CLASS_25_20',
  'CLASS_30_20',
  'CLASS_35_20',
]);
export type ConcreteClass = z.infer<typeof ConcreteClassEnum>;

export const CreateConcreteCubeTestSchema = z.object({
  batchReference: z.string().min(2).max(100),
  pourLocation: z.string().min(2).max(255),
  pourDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  concreteClass: ConcreteClassEnum.default('CLASS_25_20'),
  targetStrengthMpa: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Must be a valid decimal MPa value' }),
  slumpTestedMm: z.number().int().min(0).max(300).optional().nullable(),
  supplierName: z.string().max(255).optional().nullable(),
  deliveryDocketNo: z.string().max(100).optional().nullable(),
  curingTankId: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateConcreteCubeTest = z.infer<typeof CreateConcreteCubeTestSchema>;

export const RecordCubeBreakSchema = z.object({
  cubeNumber: z.number().int().min(1).max(12),
  breakAgeDays: z.number().int().min(1).max(90),
  scheduledBreakDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  actualBreakDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  crushingLoadKn: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Must be a valid decimal kN load' }).optional().nullable(),
  compressiveMpa: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Must be a valid decimal MPa strength' }).optional().nullable(),
  isPass: z.boolean().optional().nullable(),
  labName: z.string().max(255).optional().nullable(),
  certificateKey: z.string().max(500).optional().nullable(),
  testedBy: z.string().max(255).optional().nullable(),
});
export type RecordCubeBreak = z.infer<typeof RecordCubeBreakSchema>;

// Domain 4: Snag Items (Punch List)
export const SnagSeverityEnum = z.enum(['COSMETIC', 'FUNCTIONAL', 'CRITICAL_SAFETY']);
export type SnagSeverity = z.infer<typeof SnagSeverityEnum>;

export const SnagStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'RECTIFIED_BY_CONTRACTOR',
  'VERIFIED_CLOSED',
  'CONTESTED',
]);
export type SnagStatus = z.infer<typeof SnagStatusEnum>;

export const SnagPhotoInputSchema = z.object({
  photoType: z.enum(['DEFECT', 'RECTIFIED']).default('DEFECT'),
  storageKey: z.string().max(500),
  caption: z.string().max(255).optional().nullable(),
  gpsLatitude: z.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.number().min(-180).max(180).optional().nullable(),
});
export type SnagPhotoInput = z.infer<typeof SnagPhotoInputSchema>;

export const CreateSnagItemSchema = z.object({
  locationBlock: z.string().max(100).optional().nullable(),
  locationFloor: z.string().min(1).max(100),
  locationRoom: z.string().min(1).max(100),
  tradeCategory: z.string().min(1).max(100),
  description: z.string().min(3),
  severity: SnagSeverityEnum.default('COSMETIC'),
  assignedTradeFirm: z.string().max(255).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  identifiedByName: z.string().min(2).max(255),
  photos: z.array(SnagPhotoInputSchema).optional(),
});
export type CreateSnagItem = z.infer<typeof CreateSnagItemSchema>;

export const UpdateSnagStatusSchema = z.object({
  status: SnagStatusEnum,
  verifiedByName: z.string().max(255).optional().nullable(),
  photos: z.array(SnagPhotoInputSchema).optional(),
});
export type UpdateSnagStatus = z.infer<typeof UpdateSnagStatusSchema>;

// Domain 5: Defects Liability Certificates
export const CertificateTypeEnum = z.enum([
  'PRACTICAL_COMPLETION',
  'MAKING_GOOD_DEFECTS',
  'FINAL_PAYMENT_CERTIFICATE',
]);
export type CertificateType = z.infer<typeof CertificateTypeEnum>;

export const CreateDefectsCertificateSchema = z.object({
  certificateType: CertificateTypeEnum,
  certificateReference: z.string().min(2).max(100),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  dlpDurationMonths: z.number().int().min(1).max(36).default(6),
  dlpExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  retentionAmountReleased: CurrencyAmountSchema.optional().nullable(),
  architectName: z.string().min(2).max(255),
  architectBoraqsNo: z.string().max(50).optional().nullable(),
  qsName: z.string().min(2).max(255),
  qsBoraqsNo: z.string().max(50).optional().nullable(),
  signedCertificateKey: z.string().max(500).optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateDefectsCertificate = z.infer<typeof CreateDefectsCertificateSchema>;

// -------------------------------------------------------------
// STAKEHOLDER PORTAL LINKS (ZERO SEAT TAX)
// -------------------------------------------------------------
export const PortalTypeEnum = z.enum([
  'CLIENT',
  'CONSULTANT',
  'SUBCONTRACTOR',
  'SUPPLIER',
  'COMPLIANCE',
]);
export type PortalType = z.infer<typeof PortalTypeEnum>;

export const CreatePortalLinkSchema = z.object({
  portalType: PortalTypeEnum,
  stakeholderName: z.string().min(2).max(255),
  stakeholderRole: z.string().max(100).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});
export type CreatePortalLink = z.infer<typeof CreatePortalLinkSchema>;

// -------------------------------------------------------------
// PROJECT SCHEDULE & GANTT TASKS (BUILD-SASA BENCHMARK)
// -------------------------------------------------------------
export const TaskStatusEnum = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const CreateScheduleTaskSchema = z.object({
  wbsPhase: z.string().min(2).max(100),
  taskName: z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  durationDays: z.number().int().min(1).default(1),
  assignedTrade: z.string().max(100).optional().nullable(),
  orderIndex: z.number().int().min(0).default(0),
});
export type CreateScheduleTask = z.infer<typeof CreateScheduleTaskSchema>;

export const UpdateScheduleTaskSchema = z.object({
  taskName: z.string().min(2).max(255).optional(),
  description: z.string().optional().nullable(),
  plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional(),
  plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional(),
  actualStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  actualEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  durationDays: z.number().int().min(1).optional(),
  progressPercentage: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Must be a valid decimal percentage' }).optional(),
  assignedTrade: z.string().max(100).optional().nullable(),
  status: TaskStatusEnum.optional(),
  orderIndex: z.number().int().min(0).optional(),
});
export type UpdateScheduleTask = z.infer<typeof UpdateScheduleTaskSchema>;

// -------------------------------------------------------------
// SITE STORE INVENTORY (BUILD-SASA BENCHMARK)
// -------------------------------------------------------------
export const CreateInventoryItemSchema = z.object({
  materialName: z.string().min(2).max(255),
  category: z.string().min(2).max(100),
  unit: z.string().min(1).max(50),
  openingBalance: QuantitySchema.default('0.00'),
  minimumReorderLevel: QuantitySchema.default('0.00'),
  unitCostEstimate: CurrencyAmountSchema.optional().nullable(),
});
export type CreateInventoryItem = z.infer<typeof CreateInventoryItemSchema>;

export const InventoryMovementTypeEnum = z.enum([
  'DELIVERY_IN',
  'USAGE_OUT',
  'TRANSFER',
  'WASTAGE_DAMAGE',
]);
export type InventoryMovementType = z.infer<typeof InventoryMovementTypeEnum>;

export const RecordInventoryMovementSchema = z.object({
  inventoryItemId: z.string().uuid(),
  movementType: InventoryMovementTypeEnum,
  quantity: QuantitySchema,
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  referenceNo: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  recordedByName: z.string().min(2).max(255),
});
export type RecordInventoryMovement = z.infer<typeof RecordInventoryMovementSchema>;

// -------------------------------------------------------------
// SAFETY & HSE INCIDENTS (OSHA 2007)
// -------------------------------------------------------------
export const IncidentTypeEnum = z.enum([
  'NEAR_MISS',
  'FIRST_AID',
  'MEDICAL_TREATMENT',
  'LOST_TIME_INJURY',
  'PROPERTY_DAMAGE',
  'PPE_VIOLATION',
]);
export type IncidentType = z.infer<typeof IncidentTypeEnum>;

export const SeverityLevelEnum = z.enum(['MINOR', 'MODERATE', 'SERIOUS', 'CRITICAL']);
export type SeverityLevel = z.infer<typeof SeverityLevelEnum>;

export const CreateSafetyIncidentSchema = z.object({
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  incidentTime: z.string().max(20).optional().nullable(),
  incidentType: IncidentTypeEnum,
  severity: SeverityLevelEnum,
  exactLocation: z.string().min(2).max(255),
  affectedPersonName: z.string().max(255).optional().nullable(),
  affectedTrade: z.string().max(100).optional().nullable(),
  description: z.string().min(3),
  immediateAction: z.string().optional().nullable(),
  preventativeAction: z.string().optional().nullable(),
  isOshaReportable: z.boolean().default(false),
  investigatedBy: z.string().min(2).max(255),
});
export type CreateSafetyIncident = z.infer<typeof CreateSafetyIncidentSchema>;

// -------------------------------------------------------------
// PROJECT DOCUMENTS & DRAWINGS (BUILD-SASA BENCHMARK)
// -------------------------------------------------------------
export const DocumentCategoryEnum = z.enum([
  'ARCHITECTURAL_DRAWING',
  'STRUCTURAL_DRAWING',
  'MEP_DRAWING',
  'COUNTY_APPROVAL_STAMP',
  'NEMA_LICENSE',
  'CONTRACT_AGREEMENT',
  'SPECIFICATION_SHEET',
]);
export type DocumentCategory = z.infer<typeof DocumentCategoryEnum>;

export const DocumentStatusEnum = z.enum([
  'APPROVED_FOR_CONSTRUCTION',
  'FOR_REVIEW',
  'SUPERSEDED',
  'INFORMATION_ONLY',
]);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

export const CreateProjectDocumentSchema = z.object({
  title: z.string().min(2).max(255),
  category: DocumentCategoryEnum,
  drawingReference: z.string().max(100).optional().nullable(),
  revisionCode: z.string().max(50).default('Rev 0'),
  storageKey: z.string().min(3).max(500),
  status: DocumentStatusEnum.default('APPROVED_FOR_CONSTRUCTION'),
  uploadedByName: z.string().min(2).max(255),
  notes: z.string().optional().nullable(),
});
export type CreateProjectDocument = z.infer<typeof CreateProjectDocumentSchema>;

// -------------------------------------------------------------
// SUBCONTRACTOR WORK PACKAGES (BUILD-SASA BENCHMARK)
// -------------------------------------------------------------
export const SubcontractorStatusEnum = z.enum(['AWARDED', 'ACTIVE', 'COMPLETED', 'TERMINATED']);
export type SubcontractorStatus = z.infer<typeof SubcontractorStatusEnum>;

export const CreateSubcontractorPackageSchema = z.object({
  tradeCategory: z.string().min(2).max(100),
  firmName: z.string().min(2).max(255),
  contactPerson: z.string().max(255).optional().nullable(),
  phoneNumber: z.string().max(50).optional().nullable(),
  subcontractSum: CurrencyAmountSchema,
  retentionRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Must be a valid percentage' }).default('5.00'),
  status: SubcontractorStatusEnum.default('ACTIVE'),
  scopeDescription: z.string().optional().nullable(),
});
export type CreateSubcontractorPackage = z.infer<typeof CreateSubcontractorPackageSchema>;

// -------------------------------------------------------------
// PROJECT DELAY & EXTENSION OF TIME CLAIMS (JBC 1999 CLAUSE 25/32)
// -------------------------------------------------------------
export const DelayTypeEnum = z.enum([
  'WEATHER_INCLEMENT',
  'ARCHITECT_INSTRUCTION',
  'FORCE_MAJEURE',
  'CLIENT_DELAY',
  'LABOR_DISPUTE',
  'STATUTORY_INSPECTION',
]);
export type DelayType = z.infer<typeof DelayTypeEnum>;

export const DelayStatusEnum = z.enum([
  'PENDING_REVIEW',
  'RECOMMENDED_BY_QS',
  'APPROVED_BY_ARCHITECT',
  'REJECTED',
]);
export type DelayStatus = z.infer<typeof DelayStatusEnum>;

export const CreateDelayEventSchema = z.object({
  delayType: DelayTypeEnum,
  title: z.string().min(3).max(255),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  daysClaimed: z.number().int().positive(),
  criticalPathImpact: z.enum(['CRITICAL', 'NON_CRITICAL']).default('CRITICAL'),
  dailyLadRateKes: CurrencyAmountSchema.default('50000.00'),
  siteDiaryReference: z.string().max(100).optional().nullable(),
  meteorologicalProof: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateDelayEvent = z.infer<typeof CreateDelayEventSchema>;

export const ReviewDelayEventSchema = z.object({
  status: DelayStatusEnum,
  approvedDays: z.number().int().min(0).optional().nullable(),
  certifyingAuthority: z.string().min(2).max(255),
  notes: z.string().optional().nullable(),
});
export type ReviewDelayEvent = z.infer<typeof ReviewDelayEventSchema>;

// -------------------------------------------------------------
// KRA STATUTORY WITHHOLDING TAX (CAP 470) & WHVAT CERTIFICATES
// -------------------------------------------------------------
export const PayeeTypeEnum = z.enum([
  'MAIN_CONTRACTOR',
  'TRADE_SUBCONTRACTOR',
  'CONSULTANT',
]);
export type PayeeType = z.infer<typeof PayeeTypeEnum>;

export const TaxCertStatusEnum = z.enum([
  'GENERATED',
  'REMITTED_TO_KRA',
  'ACKNOWLEDGED',
]);
export type TaxCertStatus = z.infer<typeof TaxCertStatusEnum>;

export const CreateTaxCertificateSchema = z.object({
  payeeType: PayeeTypeEnum,
  payeeName: z.string().min(2).max(255),
  payeeKraPin: z.string().regex(/^[A-Z]\d{9}[A-Z]$/, { message: 'Must be a valid Kenyan KRA PIN (e.g. P051234567Z)' }),
  invoiceOrIpcRef: z.string().min(2).max(100),
  grossAmount: CurrencyAmountSchema,
  whtRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid rate percentage' }).default('3.00'),
  whvatRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid rate percentage' }).default('2.00'),
});
export type CreateTaxCertificate = z.infer<typeof CreateTaxCertificateSchema>;

export const RemitTaxCertificateSchema = z.object({
  status: TaxCertStatusEnum,
  itaxAcknowledgementReceipt: z.string().min(3).max(100),
});
export type RemitTaxCertificate = z.infer<typeof RemitTaxCertificateSchema>;

// -------------------------------------------------------------
// MATERIAL REQUISITIONS & REORDER PURCHASE ORDERS
// -------------------------------------------------------------
export const RequisitionUrgencyEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']);
export type RequisitionUrgency = z.infer<typeof RequisitionUrgencyEnum>;

export const RequisitionStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PO_ISSUED',
  'FULFILLED',
  'REJECTED',
]);
export type RequisitionStatus = z.infer<typeof RequisitionStatusEnum>;

export const CreateMaterialRequisitionSchema = z.object({
  requisitionNo: z.string().min(2).max(100),
  inventoryItemId: z.string().uuid().optional().nullable(),
  itemDescription: z.string().min(2).max(255),
  unitOfMeasure: z.string().min(1).max(50),
  requestedQuantity: QuantitySchema,
  estimatedUnitCostKes: CurrencyAmountSchema,
  urgency: RequisitionUrgencyEnum.default('NORMAL'),
  requiredByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  supplierName: z.string().max(255).optional().nullable(),
  requestedBy: z.string().min(2).max(255),
});
export type CreateMaterialRequisition = z.infer<typeof CreateMaterialRequisitionSchema>;

export const ReviewMaterialRequisitionSchema = z.object({
  status: RequisitionStatusEnum,
  approvedBy: z.string().min(2).max(255).optional().nullable(),
  rejectionReason: z.string().max(1000).optional().nullable(),
});
export type ReviewMaterialRequisition = z.infer<typeof ReviewMaterialRequisitionSchema>;

// -------------------------------------------------------------
// MATERIAL WASTAGE & THEORETICAL CONSUMPTION VARIANCE ENGINE
// -------------------------------------------------------------
export const WastageStatusEnum = z.enum([
  'WITHIN_TOLERANCE',
  'ELEVATED_LOSS',
  'CRITICAL_UNEXPLAINED_LOSS',
]);
export type WastageStatus = z.infer<typeof WastageStatusEnum>;

export const CreateMaterialWastageReconciliationSchema = z.object({
  periodName: z.string().min(2).max(100),
  inventoryItemId: z.string().uuid().optional().nullable(),
  materialName: z.string().min(2).max(255),
  unitOfMeasure: z.string().min(1).max(50),
  theoreticalQuantity: QuantitySchema,
  actualConsumedQuantity: QuantitySchema,
  allowableWastagePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid percentage' }).default('5.00'),
  unitCostKes: CurrencyAmountSchema,
  investigationNotes: z.string().max(2000).optional().nullable(),
  createdBy: z.string().min(2).max(255),
});
export type CreateMaterialWastageReconciliation = z.infer<typeof CreateMaterialWastageReconciliationSchema>;

// -------------------------------------------------------------
// CONTRACTOR CASH FLOW FORECASTING & VALUATION S-CURVE
// -------------------------------------------------------------
export const CashFlowStatusEnum = z.enum([
  'AHEAD_UNDER_BUDGET',
  'ON_TRACK',
  'COST_OVERRUN',
  'SCHEDULE_DELAY',
  'CRITICAL_DIVERGENCE',
]);
export type CashFlowStatus = z.infer<typeof CashFlowStatusEnum>;

export const CreateCashFlowForecastSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, { message: 'Must be in YYYY-MM format' }),
  plannedValueKes: CurrencyAmountSchema,
  actualCostKes: CurrencyAmountSchema,
  earnedValueKes: CurrencyAmountSchema,
  clientBilledKes: CurrencyAmountSchema.default('0.00'),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateCashFlowForecast = z.infer<typeof CreateCashFlowForecastSchema>;

// -------------------------------------------------------------
// SUBCONTRACTOR VALUATIONS & BACK-TO-BACK RETENTION (JBC 1999)
// -------------------------------------------------------------
export const SubcontractorValuationStatusEnum = z.enum([
  'SUBMITTED',
  'QS_VERIFIED',
  'APPROVED_FOR_PAYMENT',
  'PAID',
  'REJECTED',
]);
export type SubcontractorValuationStatus = z.infer<typeof SubcontractorValuationStatusEnum>;

export const CreateSubcontractorValuationSchema = z.object({
  subcontractorPackageId: z.string().uuid(),
  certificateNo: z.string().min(2).max(100),
  valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  grossWorkCertifiedKes: CurrencyAmountSchema,
  retentionRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid retention percentage' }).default('10.00'),
  previousPaymentsDeductedKes: CurrencyAmountSchema.default('0.00'),
  withholdingTaxPct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid WHT percentage' }).default('3.00'),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateSubcontractorValuation = z.infer<typeof CreateSubcontractorValuationSchema>;

export const ReviewSubcontractorValuationSchema = z.object({
  paymentStatus: SubcontractorValuationStatusEnum,
  approvedBy: z.string().min(2).max(255).optional().nullable(),
  paymentReference: z.string().max(100).optional().nullable(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type ReviewSubcontractorValuation = z.infer<typeof ReviewSubcontractorValuationSchema>;

// -------------------------------------------------------------
// PLANT, MACHINERY & FUEL LOG SCHEMAS (MILESTONE M16)
// -------------------------------------------------------------
export const EquipmentTypeEnum = z.enum([
  'EXCAVATOR',
  'CONCRETE_MIXER',
  'VIBRATOR_POKER',
  'TOWER_CRANE',
  'TIPPER_TRUCK',
  'GENERATOR',
  'WATER_BOWSER',
  'DEWATERING_PUMP',
  'COMPACTOR_ROLLER',
  'OTHER',
]);
export type EquipmentType = z.infer<typeof EquipmentTypeEnum>;

export const OwnershipTypeEnum = z.enum(['OWNED', 'HIRED_DRY', 'HIRED_WET']);
export type OwnershipType = z.infer<typeof OwnershipTypeEnum>;

export const CreatePlantEquipmentSchema = z.object({
  equipmentCode: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  equipmentType: EquipmentTypeEnum,
  ownershipType: OwnershipTypeEnum.default('OWNED'),
  ratePerUnitKes: CurrencyAmountSchema.default('0.00'),
  rateUnit: z.enum(['PER_HOUR', 'PER_DAY', 'PER_MONTH']).default('PER_DAY'),
  registrationNo: z.string().max(50).optional().nullable(),
  supplierName: z.string().max(255).optional().nullable(),
  currentHoursMeter: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
});
export type CreatePlantEquipment = z.infer<typeof CreatePlantEquipmentSchema>;

export const CreateEquipmentDailyLogSchema = z.object({
  equipmentId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  operatorName: z.string().min(2).max(255),
  openingHoursMeter: z.string().regex(/^\d+(\.\d{1,2})?$/),
  closingHoursMeter: z.string().regex(/^\d+(\.\d{1,2})?$/),
  operatingHours: z.string().regex(/^\d+(\.\d{1,2})?$/),
  idleOrBreakdownHours: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  fuelLitersIssued: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  fuelCostPerLiterKes: CurrencyAmountSchema.default('180.00'),
  activitiesPerformed: z.string().max(2000).optional().nullable(),
  verifiedBySupervisor: z.string().min(2).max(255),
});
export type CreateEquipmentDailyLog = z.infer<typeof CreateEquipmentDailyLogSchema>;

// -------------------------------------------------------------
// CASUAL LABOR MUSTER ROLL & WAGE SCHEMAS (MILESTONE M17)
// -------------------------------------------------------------
export const TradeCategoryEnum = z.enum([
  'MASON',
  'CARPENTER',
  'STEEL_FIXER',
  'PLUMBER',
  'ELECTRICIAN',
  'PAINTER',
  'TILER',
  'CASUAL_LABORER',
  'SCAFFOLDER',
  'FOREMAN',
]);
export type TradeCategory = z.infer<typeof TradeCategoryEnum>;

export const SkillLevelEnum = z.enum([
  'CASUAL_MTU_WA_MKONO',
  'SEMI_SKILLED',
  'ARTISAN_FUNDI',
  'CHARGEHAND_FOREMAN',
]);
export type SkillLevel = z.infer<typeof SkillLevelEnum>;

export const CreateSiteLaborerSchema = z.object({
  workerCode: z.string().min(2).max(50),
  fullName: z.string().min(2).max(255),
  nationalIdNo: z.string().min(6).max(20),
  phoneNumber: z.string().regex(/^\+?254\d{9}$|^0[17]\d{8}$/, { message: 'Valid Kenyan mobile phone number' }),
  tradeCategory: TradeCategoryEnum,
  skillLevel: SkillLevelEnum.default('ARTISAN_FUNDI'),
  dailyRateKes: CurrencyAmountSchema,
});
export type CreateSiteLaborer = z.infer<typeof CreateSiteLaborerSchema>;

export const AttendanceItemInputSchema = z.object({
  laborerId: z.string().uuid(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daysWorked: z.string().regex(/^\d+(\.\d{1,2})?$/).default('1.00'),
  overtimeHours: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  taskAssigned: z.string().max(255).optional().nullable(),
  verifiedBy: z.string().min(2).max(255),
});
export type AttendanceItemInput = z.infer<typeof AttendanceItemInputSchema>;

export const CreateLaborMusterRollSchema = z.object({
  payrollNo: z.string().min(2).max(100),
  weekEndingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  notes: z.string().max(2000).optional().nullable(),
  attendances: z.array(AttendanceItemInputSchema).min(1, { message: 'At least one attendance line is required' }),
});
export type CreateLaborMusterRoll = z.infer<typeof CreateLaborMusterRollSchema>;

export const ReviewLaborMusterRollSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_VERIFICATION', 'QS_APPROVED', 'DISBURSED', 'REJECTED']),
  disbursementReference: z.string().max(100).optional().nullable(),
  approvedBy: z.string().min(2).max(255).optional().nullable(),
});
export type ReviewLaborMusterRoll = z.infer<typeof ReviewLaborMusterRollSchema>;

// -------------------------------------------------------------
// FIELD SAFETY AUDITS & DOSHS/NCA SCORECARDS (MILESTONE M18)
// -------------------------------------------------------------
export const CreateSafetyAuditSchema = z.object({
  auditNo: z.string().min(2).max(100),
  auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  auditorName: z.string().min(2).max(255),
  auditorType: z.enum(['INTERNAL_SAFETY_OFFICER', 'NCA_INSPECTOR', 'DOSHS_OFFICER', 'LEAD_CONSULTANT']),
  ppeComplianceScore: z.string().regex(/^\d+(\.\d{1,2})?$/),
  scaffoldingAndEdgeProtectionStatus: z.enum(['PASS', 'MINOR_DEFECTS', 'FAIL_STOP_WORK']),
  excavationAndShoringStatus: z.enum(['PASS', 'MINOR_DEFECTS', 'FAIL_STOP_WORK', 'NOT_APPLICABLE']),
  firstAidAndFireStationStatus: z.enum(['PASS', 'DEFICIENT', 'ABSENT']),
  electricalSafetyAndCablesStatus: z.enum(['PASS', 'HAZARDOUS']),
  correctiveActionPlan: z.string().max(3000).optional().nullable(),
  reinspectionDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
export type CreateSafetyAudit = z.infer<typeof CreateSafetyAuditSchema>;

// -------------------------------------------------------------
// KRA E-TIMS & ELECTRONIC TAX INVOICE SCHEMAS (MILESTONE M19)
// -------------------------------------------------------------
export const ETimsInvoiceTypeEnum = z.enum(['ORIGINAL', 'CREDIT_NOTE', 'DEBIT_NOTE']);
export type ETimsInvoiceType = z.infer<typeof ETimsInvoiceTypeEnum>;

export const ETimsTransmissionStatusEnum = z.enum(['PENDING', 'TRANSMITTED', 'VALIDATED', 'FAILED']);
export type ETimsTransmissionStatus = z.infer<typeof ETimsTransmissionStatusEnum>;

export const CreateETimsInvoiceSchema = z.object({
  projectId: z.string().uuid(),
  invoiceNumber: z.string().min(2).max(100),
  cuInvoiceNumber: z.string().min(2).max(100),
  invoiceType: ETimsInvoiceTypeEnum.default('ORIGINAL'),
  buyerPin: z.string().min(8).max(20),
  buyerName: z.string().min(2).max(255),
  totalTaxableAmount: CurrencyAmountSchema,
  totalTaxAmount: CurrencyAmountSchema,
  totalInvoiceAmount: CurrencyAmountSchema,
  taxBreakdown16: CurrencyAmountSchema.default('0.00'),
  taxBreakdown8: CurrencyAmountSchema.default('0.00'),
  taxBreakdown0: CurrencyAmountSchema.default('0.00'),
  taxBreakdownExempt: CurrencyAmountSchema.default('0.00'),
  qrCodeUrl: z.string().min(5).max(500),
  cryptographicSignature: z.string().min(2).max(255),
});
export type CreateETimsInvoice = z.infer<typeof CreateETimsInvoiceSchema>;

export const SubcontractorComplianceStatusEnum = z.enum(['COMPLIANT', 'EXPIRED', 'NON_COMPLIANT', 'EXEMPT']);
export type SubcontractorComplianceStatus = z.infer<typeof SubcontractorComplianceStatusEnum>;

export const CreateSubcontractorTaxComplianceSchema = z.object({
  subcontractorPackageId: z.string().uuid(),
  pinNumber: z.string().min(8).max(50),
  taxpayerName: z.string().min(2).max(255),
  tccNumber: z.string().min(2).max(100),
  tccExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  complianceStatus: SubcontractorComplianceStatusEnum.default('COMPLIANT'),
  withholdingTaxRate: z.string().regex(/^\d+(\.\d{1,2})?$/).default('3.00'),
  withholdingVatRate: z.string().regex(/^\d+(\.\d{1,2})?$/).default('2.00'),
});
export type CreateSubcontractorTaxCompliance = z.infer<typeof CreateSubcontractorTaxComplianceSchema>;

// -------------------------------------------------------------
// WHATSAPP & SMS TWO-WAY SITE OPS WEBHOOKS & ALERTS (MILESTONE M20)
// -------------------------------------------------------------
export const WebhookChannelEnum = z.enum(['WHATSAPP', 'SMS']);
export type WebhookChannel = z.infer<typeof WebhookChannelEnum>;

export const DetectedCommandEnum = z.enum(['DIARY', 'DELIVERY', 'INCIDENT', 'PLANT_FUEL', 'UNKNOWN']);
export type DetectedCommand = z.infer<typeof DetectedCommandEnum>;

export const ProcessWebhookPayloadSchema = z.object({
  senderPhone: z.string().min(8).max(50),
  senderName: z.string().max(255).optional().nullable(),
  channel: WebhookChannelEnum.default('WHATSAPP'),
  rawMessage: z.string().min(1).max(4000),
  projectId: z.string().uuid().optional().nullable(),
});
export type ProcessWebhookPayload = z.infer<typeof ProcessWebhookPayloadSchema>;

export const AlertRecipientRoleEnum = z.enum([
  'PROJECT_MANAGER',
  'QUANTITY_SURVEYOR',
  'SITE_SUPERVISOR',
  'SAFETY_OFFICER',
  'DIRECTOR',
]);
export type AlertRecipientRole = z.infer<typeof AlertRecipientRoleEnum>;

export const AlertTypeEnum = z.enum([
  'CRITICAL_SAFETY_STOP_WORK',
  'DIESEL_SIPHONING_FLAG',
  'STRUCTURAL_CONCRETE_FAIL',
  'BUDGET_OVERRUN',
]);
export type AlertType = z.infer<typeof AlertTypeEnum>;

export const CreateSiteAlertNotificationSchema = z.object({
  projectId: z.string().uuid(),
  recipientPhone: z.string().min(8).max(50),
  recipientName: z.string().min(2).max(255),
  recipientRole: AlertRecipientRoleEnum,
  alertType: AlertTypeEnum,
  messageBody: z.string().min(3).max(2000),
  deliveryChannel: z.enum(['WHATSAPP', 'SMS', 'IN_APP']).default('WHATSAPP'),
});
export type CreateSiteAlertNotification = z.infer<typeof CreateSiteAlertNotificationSchema>;

// -------------------------------------------------------------
// RETENTION RELEASE & CONTRACTOR PERFORMANCE BONDS (MILESTONE M21)
// -------------------------------------------------------------
export const MoietyStageEnum = z.enum(['FIRST_MOIETY_PRACTICAL_COMPLETION', 'SECOND_MOIETY_FINAL_COMPLETION']);
export type MoietyStage = z.infer<typeof MoietyStageEnum>;

export const CreateSubcontractorRetentionReleaseSchema = z.object({
  projectId: z.string().uuid(),
  subcontractorPackageId: z.string().uuid(),
  releaseNo: z.string().min(2).max(100),
  moietyStage: MoietyStageEnum,
  totalRetentionHeld: CurrencyAmountSchema,
  releasePercentage: z.string().regex(/^\d+(\.\d{1,2})?$/).default('50.00'),
  releaseAmount: CurrencyAmountSchema,
  qsRecommendationNotes: z.string().max(2000).optional().nullable(),
  defectClearanceVerified: z.boolean().default(false),
});
export type CreateSubcontractorRetentionRelease = z.infer<typeof CreateSubcontractorRetentionReleaseSchema>;

export const ReviewSubcontractorRetentionReleaseSchema = z.object({
  status: z.enum(['PENDING_QS_REVIEW', 'APPROVED_BY_DIRECTOR', 'PAID', 'REJECTED']),
  disbursementRef: z.string().max(100).optional().nullable(),
});
export type ReviewSubcontractorRetentionRelease = z.infer<typeof ReviewSubcontractorRetentionReleaseSchema>;

export const BondTypeEnum = z.enum([
  'PERFORMANCE_BOND',
  'ADVANCE_PAYMENT_GUARANTEE',
  'RETENTION_BOND',
  'BID_TENDER_BOND',
]);
export type BondType = z.infer<typeof BondTypeEnum>;

export const BondClaimStatusEnum = z.enum(['ACTIVE', 'RELEASED', 'CALLED_CLAIMED', 'EXPIRED']);
export type BondClaimStatus = z.infer<typeof BondClaimStatusEnum>;

export const CreateContractorBondSchema = z.object({
  projectId: z.string().uuid(),
  bondType: BondTypeEnum,
  issuingInstitution: z.string().min(2).max(255),
  bondReferenceNo: z.string().min(2).max(100),
  bondAmount: CurrencyAmountSchema,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  claimStatus: BondClaimStatusEnum.default('ACTIVE'),
  dischargeCertificateRef: z.string().max(100).optional().nullable(),
});
export type CreateContractorBond = z.infer<typeof CreateContractorBondSchema>;

// -------------------------------------------------------------
// SAFARICOM DARAJA M-PESA SUBSCRIPTION BILLING (MILESTONE M22)
// -------------------------------------------------------------
export const SubscriptionPlanCodeEnum = z.enum(['PROJECT_TIER', 'PORTFOLIO_TIER']);
export type SubscriptionPlanCode = z.infer<typeof SubscriptionPlanCodeEnum>;

export const InitiateMpesaStkPushSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  planCode: SubscriptionPlanCodeEnum,
  amount: CurrencyAmountSchema,
});
export type InitiateMpesaStkPush = z.infer<typeof InitiateMpesaStkPushSchema>;

export const ProcessMpesaCallbackSchema = z.object({
  MerchantRequestID: z.string(),
  CheckoutRequestID: z.string(),
  ResultCode: z.number().int(),
  ResultDesc: z.string(),
  MpesaReceiptNumber: z.string().optional().nullable(),
  TransactionDate: z.string().optional().nullable(),
  PhoneNumber: z.string().optional().nullable(),
});
export type ProcessMpesaCallback = z.infer<typeof ProcessMpesaCallbackSchema>;

// -------------------------------------------------------------
// PROJECT GEOFENCING & BIOMETRIC CLOCK-IN ENGINE (MILESTONE M23)
// -------------------------------------------------------------
export const CreateProjectGeofenceSchema = z.object({
  geofenceName: z.string().min(2).max(255),
  centerLatitude: z.string().regex(/^-?\d+(\.\d+)?$/, { message: 'Valid decimal latitude' }),
  centerLongitude: z.string().regex(/^-?\d+(\.\d+)?$/, { message: 'Valid decimal longitude' }),
  radiusMeters: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid radius in meters' }).default('150.00'),
});
export type CreateProjectGeofence = z.infer<typeof CreateProjectGeofenceSchema>;

export const ClockTypeEnum = z.enum(['CLOCK_IN', 'CLOCK_OUT']);
export type ClockType = z.infer<typeof ClockTypeEnum>;

export const RecordWorkerClockInSchema = z.object({
  laborerId: z.string().uuid(),
  clockType: ClockTypeEnum.default('CLOCK_IN'),
  capturedLatitude: z.string().regex(/^-?\d+(\.\d+)?$/, { message: 'Valid decimal latitude' }),
  capturedLongitude: z.string().regex(/^-?\d+(\.\d+)?$/, { message: 'Valid decimal longitude' }),
  photoSelfieUrl: z.string().max(500).optional().nullable(),
  deviceUserAgent: z.string().max(255).optional().nullable(),
});
export type RecordWorkerClockIn = z.infer<typeof RecordWorkerClockInSchema>;

// -------------------------------------------------------------
// DIRECT PLANT GPS TELEMATICS & FUEL FLOW METERS (MILESTONE M24)
// -------------------------------------------------------------
export const TelematicsProtocolEnum = z.enum(['OBD2', 'CANBUS', 'GPS_MODEM', 'MODBUS_FLOW']);
export type TelematicsProtocol = z.infer<typeof TelematicsProtocolEnum>;

export const RegisterTelematicsDeviceSchema = z.object({
  equipmentId: z.string().uuid(),
  deviceImei: z.string().min(8).max(50),
  protocol: TelematicsProtocolEnum.default('GPS_MODEM'),
  simPhoneNumber: z.string().max(50).optional().nullable(),
  calibrationTankCapacityLiters: z.string().regex(/^\d+(\.\d{1,2})?$/).default('300.00'),
});
export type RegisterTelematicsDevice = z.infer<typeof RegisterTelematicsDeviceSchema>;

export const EngineStatusEnum = z.enum(['RUNNING', 'IDLE', 'STOPPED']);
export type EngineStatus = z.infer<typeof EngineStatusEnum>;

export const IngestTelematicsPingSchema = z.object({
  deviceImei: z.string().min(8).max(50),
  latitude: z.string().regex(/^-?\d+(\.\d+)?$/),
  longitude: z.string().regex(/^-?\d+(\.\d+)?$/),
  engineStatus: EngineStatusEnum.default('RUNNING'),
  engineRpm: z.number().int().optional().nullable(),
  cumulativeEngineSeconds: z.number().int().nonnegative().default(0),
  fuelLevelPercent: z.string().regex(/^\d+(\.\d{1,2})?$/),
});
export type IngestTelematicsPing = z.infer<typeof IngestTelematicsPingSchema>;

// -------------------------------------------------------------
// REBAR TAKEOFF & BS 8666 BAR BENDING SCHEDULE (MILESTONE M25)
// -------------------------------------------------------------
export const BarTypeEnum = z.enum(['Y8', 'Y10', 'Y12', 'Y16', 'Y20', 'Y25', 'Y32']);
export type BarType = z.infer<typeof BarTypeEnum>;

export const ShapeCodeEnum = z.enum(['00', '11', '21', '51', '61']);
export type ShapeCode = z.infer<typeof ShapeCodeEnum>;

export const BarBendingItemInputSchema = z.object({
  memberTag: z.string().min(1).max(100),
  barMark: z.string().min(1).max(20),
  barType: BarTypeEnum,
  numberOfMembers: z.number().int().positive().default(1),
  barsPerMember: z.number().int().positive().default(1),
  shapeCode: ShapeCodeEnum.default('00'),
  dimensionAMm: z.number().int().min(0),
  dimensionBMm: z.number().int().min(0).optional().nullable(),
  dimensionCMm: z.number().int().min(0).optional().nullable(),
  dimensionDMm: z.number().int().min(0).optional().nullable(),
});
export type BarBendingItemInput = z.infer<typeof BarBendingItemInputSchema>;

export const CreateBarBendingScheduleSchema = z.object({
  scheduleNumber: z.string().min(3).max(50),
  elementName: z.string().min(2).max(255),
  drawingRef: z.string().max(100).optional().nullable(),
  steelGrade: z.enum(['HIGH_YIELD_460', 'MILD_STEEL_250']).default('HIGH_YIELD_460'),
  items: z.array(BarBendingItemInputSchema).min(1),
});
export type CreateBarBendingSchedule = z.infer<typeof CreateBarBendingScheduleSchema>;

export const UpdateBarBendingScheduleStatusSchema = z.object({
  status: z.enum(['DRAFT', 'APPROVED_FOR_CUTTING', 'FABRICATED']),
});
export type UpdateBarBendingScheduleStatus = z.infer<typeof UpdateBarBendingScheduleStatusSchema>;

export { z };

// -------------------------------------------------------------
// SAFARICOM DARAJA B2C BULK DISBURSEMENT (MILESTONE M26)
// -------------------------------------------------------------
export const DisbursementTypeEnum = z.enum(['CASUAL_LABOR_WAGE', 'SUBCONTRACTOR_RETENTION', 'EMERGENCY_PETTY_CASH']);
export type DisbursementType = z.infer<typeof DisbursementTypeEnum>;

export const InitiateB2CDisbursementSchema = z.object({
  disbursementType: DisbursementTypeEnum,
  referenceId: z.string().optional().nullable(),
  recipientPhone: KenyanPhoneSchema,
  recipientName: z.string().min(2).max(255),
  amount: CurrencyAmountSchema,
  remarks: z.string().max(100).optional().nullable(),
  idempotencyKey: z.string().min(5).max(100),
});
export type InitiateB2CDisbursement = z.infer<typeof InitiateB2CDisbursementSchema>;

export const ProcessB2CCallbackSchema = z.object({
  ConversationID: z.string(),
  OriginatorConversationID: z.string(),
  ResultCode: z.number().int(),
  ResultDesc: z.string(),
  TransactionID: z.string().optional().nullable(),
  TransactionReceipt: z.string().optional().nullable(),
  TransactionAmount: z.number().optional().nullable(),
  B2CWorkingAccountAvailableFunds: z.number().optional().nullable(),
});
export type ProcessB2CCallback = z.infer<typeof ProcessB2CCallbackSchema>;






