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
  .regex(/^(?:\+254|0)[17]\d{8}$/, { message: 'Must be a valid Kenyan mobile phone number (e.g., +254712345678 or 0712345678)' });

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

