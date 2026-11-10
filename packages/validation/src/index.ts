import { z } from 'zod';

export const TenantIdSchema = z.string().uuid({ message: 'Invalid tenant identifier' });
export const ProjectIdSchema = z.string().uuid({ message: 'Invalid project identifier' });

export const CurrencyAmountSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, { message: 'Must be a valid decimal amount with up to 2 decimal places' });

export const UnitRateSchema = z
  .string()
  .regex(/^(?!0+(?:\.0+)?$)\d+(\.\d{1,4})?$/, { message: 'Unit rate must be a positive decimal with up to 4 decimal places' });

export const QuantitySchema = z
  .string()
  .regex(/^(?!0+(?:\.0+)?$)\d+(\.\d{1,4})?$/, { message: 'Quantity must be a positive decimal with up to 4 decimal places' });

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

export const RegisterCompanySchema = z.object({
  companyName: z.string().min(2, { message: 'Company name must be at least 2 characters' }).max(255),
  adminFullName: z.string().min(2, { message: 'Full name must be at least 2 characters' }).max(255),
  email: z.string().email({ message: 'Must be a valid email address' }),
  phone: KenyanPhoneSchema.optional().or(z.literal('')),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }).max(128),
});
export type RegisterCompany = z.infer<typeof RegisterCompanySchema>;

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
  'HIGH_WIND',
  'HIGH_TEMPERATURE',
  'LOW_TEMPERATURE',
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
  clientVisible: z.boolean().optional(),
  takenAt: z.string().datetime().optional(),
  gpsLatitude: z.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.number().min(-180).max(180).optional().nullable(),
});

export const UpdateSitePhotoVisibilitySchema = z.object({
  clientVisible: z.boolean(),
});
export type UpdateSitePhotoVisibility = z.infer<typeof UpdateSitePhotoVisibilitySchema>;
export type SitePhotoInput = z.infer<typeof SitePhotoInputSchema>;

export const CreateSiteDiarySchema = z.object({
  projectId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }),
  weather: WeatherConditionEnum,
  siteStatus: SiteStatusEnum,
  generalNotes: z.string().max(4000).optional().nullable(),
  isNonWorkDay: z.boolean().optional(),
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

const decimalOrNumber = (schema: z.ZodString) =>
  z
    .union([schema, z.number().finite()])
    .transform((v) => (typeof v === 'number' ? String(v) : v));

export const VariationItemInputSchema = z.object({
  boqItemId: z.string().uuid().optional().nullable(),
  description: z.string().min(2).max(1000),
  unit: z.string().min(1).max(20),
  quantity: decimalOrNumber(VariationQuantitySchema),
  unitRate: decimalOrNumber(UnitRateSchema),
});
export type VariationItemInput = z.infer<typeof VariationItemInputSchema>;

export const VariationTriggerTypeSchema = z.enum([
  'CLIENT_REQUEST',
  'DESIGN_CLARIFICATION',
  'OWNER_REQUEST',
  'UNFORESEEN_CONDITION',
  'CODE_COMPLIANCE',
  'STRUCTURAL_REVIEW',
  'WEATHER_DELAY',
  'OTHER',
]);
export type VariationTriggerType = z.infer<typeof VariationTriggerTypeSchema>;

export const CreateVariationOrderSchema = z.object({
  title: z.string().min(3).max(255),
  reason: z.string().min(5).max(4000),
  triggerType: VariationTriggerTypeSchema.optional().nullable(),
  linkedRfiId: z.string().uuid().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).max(20).optional().default([]),
  timeExtensionDays: z.number().int().min(0).max(3650).default(0),
  items: z.array(VariationItemInputSchema).min(1, { message: 'At least one variation item is required' }),
});
export type CreateVariationOrder = z.infer<typeof CreateVariationOrderSchema>;

export const ReviewVariationOrderSchema = z
  .object({
    action: z.enum(['EVALUATE', 'APPROVE', 'REJECT', 'VOID']),
    comments: z.string().max(2000).optional(),
  })
  .refine((v) => v.action !== 'REJECT' || (v.comments && v.comments.trim().length >= 3), {
    message: 'A rejection reason (comments) is required',
    path: ['comments'],
  });
export type ReviewVariationOrder = z.infer<typeof ReviewVariationOrderSchema>;

export const ClientVariationRespondSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    signedName: z.string().min(2).max(255),
    comments: z.string().max(2000).optional(),
  })
  .refine((v) => v.action !== 'REJECT' || (v.comments && v.comments.trim().length >= 3), {
    message: 'A rejection reason (comments) is required',
    path: ['comments'],
  });
export type ClientVariationRespond = z.infer<typeof ClientVariationRespondSchema>;

export const AcceptInvitationSchema = z.object({
  token: z.string().min(16, { message: 'Invalid invitation token' }).max(128),
  // Optional: when omitted the invited email is used. When supplied it must
  // match the invitation (wrong-email tokens are still rejected).
  email: z.string().email({ message: 'Must be the invited email address' }).optional(),
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters long' }).max(255),
  // Required: the invitee always sets/confirms their own password. For an
  // existing account this must be their CURRENT password (identity proof);
  // for a new account it becomes their password.
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }).max(128),
});
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;

export const RequestPasswordResetSchema = z.object({
  email: z.string().email({ message: 'Must be a valid email address' }),
});
export type RequestPasswordReset = z.infer<typeof RequestPasswordResetSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(16, { message: 'Invalid reset token' }).max(128),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }).max(128),
});
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(16, { message: 'Invalid verification token' }).max(128),
});
export type VerifyEmail = z.infer<typeof VerifyEmailSchema>;

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
  issueType: z.enum(['RFI', 'CLASH', 'DESIGN_QUESTION']).optional().nullable(),
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
  requiresConsultantReview: z.boolean().optional(),
  inspectionType: z.string().max(60).optional().nullable(),
  assignedConsultant: z.string().max(255).optional().nullable(),
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
  'CLASS_40_20',
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
  'READY_FOR_REVIEW',
  'RECTIFIED_BY_CONTRACTOR',
  'VERIFIED_CLOSED',
  'CONTESTED',
  'REJECTED',
]);
export type SnagStatus = z.infer<typeof SnagStatusEnum>;

/** Gate-4 S6: 36-trade punch-list taxonomy (observed form dropdown). */
export const SNAG_TRADE_CATEGORIES = [
  'Masonry & Blockwork',
  'Carpentry & Joinery',
  'Roofing & Waterproofing',
  'Plumbing & Drainage',
  'Electrical & ELV',
  'HVAC & Mechanical',
  'Plastering & Rendering',
  'Tiling & Flooring',
  'Painting & Decorating',
  'Glazing & Aluminum',
  'Structural Steel',
  'Reinforcement & Concrete',
  'Formwork & Falsework',
  'Scaffolding & Access',
  'Excavation & Earthworks',
  'Piling & Foundations',
  'Road Works & Paving',
  'Drainage & Sewerage',
  'Water Reticulation',
  'Boundary Wall & Fencing',
  'Gates & Ironmongery',
  'Doors & Windows',
  'Ceilings & Bulkheads',
  'Sanitary Fixtures',
  'Fire Protection',
  'Lightning Protection',
  'Solar & Energy',
  'CCTV & Security',
  'Data & Communications',
  'Generators & UPS',
  'Landscaping & Gardens',
  'External Works',
  'Bridge Works',
  'Traffic Control',
  'Surveying & Setting Out',
  'Cleaning & Handover',
  'Interior Design & Decor',
] as const;
export type SnagTradeCategory = (typeof SNAG_TRADE_CATEGORIES)[number];

export const SnagPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const SnagItemTypeEnum = z.enum(['ARCHITECTURAL', 'MEP', 'FINISHES', 'STRUCTURAL', 'CIVIL', 'OTHER']);

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
  // Gate-4 S6 punch depth
  priority: SnagPriorityEnum.default('MEDIUM'),
  itemType: SnagItemTypeEnum.optional().nullable(),
  isPrivate: z.boolean().default(false),
  managerName: z.string().max(255).optional().nullable(),
  finalApproverName: z.string().max(255).optional().nullable(),
  costImpactKes: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  scheduleImpactDays: z.number().int().min(0).max(3650).optional().nullable(),
  costCode: z.string().max(50).optional().nullable(),
  referenceDoc: z.string().max(255).optional().nullable(),
  assignedTradeFirm: z.string().max(255).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be in YYYY-MM-DD format' }).optional().nullable(),
  identifiedByName: z.string().min(2).max(255),
  photos: z.array(SnagPhotoInputSchema).optional(),
  distributions: z.array(z.object({
    recipientName: z.string().min(1).max(255),
    recipientContact: z.string().max(255).optional().nullable(),
    channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP']).optional().nullable(),
  })).optional(),
});
export type CreateSnagItem = z.infer<typeof CreateSnagItemSchema>;

export const UpdateSnagStatusSchema = z.object({
  status: SnagStatusEnum,
  verifiedByName: z.string().max(255).optional().nullable(),
  photos: z.array(SnagPhotoInputSchema).optional(),
});
export type UpdateSnagStatus = z.infer<typeof UpdateSnagStatusSchema>;

export const CreateSnagCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  authorName: z.string().max(255).optional().nullable(),
});
export type CreateSnagComment = z.infer<typeof CreateSnagCommentSchema>;

export const CreateSnagDistributionSchema = z.object({
  recipientName: z.string().min(1).max(255),
  recipientContact: z.string().max(255).optional().nullable(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP']).optional().nullable(),
});
export type CreateSnagDistribution = z.infer<typeof CreateSnagDistributionSchema>;

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
// STAKEHOLDER PORTAL LINKS
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
  // SUBCONTRACTOR links must bind to one work package (audit: no cross-subs visibility)
  subcontractorPackageId: z.string().uuid().optional().nullable(),
});

// Consultant portal RFI reply (external, unauthenticated token scope)
export const ConsultantRfiReplySchema = z.object({
  officialAnswer: z.string().min(3).max(5000),
  consultantName: z.string().max(255).optional().nullable(),
  consultantBoraqsNo: z.string().max(50).optional().nullable(),
});
export type ConsultantRfiReply = z.infer<typeof ConsultantRfiReplySchema>;

// Supplier portal delivery confirm/dispute
export const SupplierDeliveryActionSchema = z.object({
  action: z.enum(['CONFIRM', 'DISPUTE']),
  invoiceRef: z.string().max(100).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});
export type SupplierDeliveryAction = z.infer<typeof SupplierDeliveryActionSchema>;
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
  'FATALITY',
  'PROPERTY_DAMAGE',
  'PPE_VIOLATION',
  // Reference-observed site-hazard taxonomy (kept alongside OSHA types)
  'STRUCK_BY_EQUIPMENT',
  'EQUIPMENT_ROLLOVER',
  'CAVE_IN_TRENCH',
  'TRAFFIC_INCIDENT',
  'ASPHALT_HOT_MATERIAL',
  'ENVIRONMENTAL_RELEASE',
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
  'CIVIL_DRAWING',
  'ELECTRICAL_DRAWING',
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
  whtRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid rate percentage' }).optional().nullable(),
  whvatRatePct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid rate percentage' }).optional().nullable(),
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
  'UNDER_REVIEW',
  'QS_VERIFIED', // legacy alias of UNDER_REVIEW — kept for backward compatibility
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
  // Optional override — when omitted the route applies the tenant's configured
  // WHT rate for the SUBCONTRACTOR category (no hard-coded default).
  withholdingTaxPct: z.string().regex(/^\d+(\.\d{1,2})?$/, { message: 'Valid WHT percentage' }).optional().nullable(),
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
  'DIESEL_DISCREPANCY_FLAG',
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
  calibrationTankCapacityLiters: z.string().regex(/^(?!0+(?:\.0+)?$)\d+(\.\d{1,2})?$/).default('300.00'),
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

// -------------------------------------------------------------
// READY-MIX CONCRETE (RMC) BATCHING & TRANSIT SLUMP TRACKER (MILESTONE M27)
// -------------------------------------------------------------
export const CreateRmcBatchDeliverySchema = z.object({
  deliveryTicketNo: z.string().min(3).max(100),
  supplierName: z.string().min(2).max(255),
  truckRegistrationNo: z.string().min(3).max(50),
  driverName: z.string().max(255).optional().nullable(),
  driverPhone: z.string().max(50).optional().nullable(),
  concreteClass: ConcreteClassEnum,
  orderedVolumeM3: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]),
  dispatchedAt: z.string().datetime(),
  pourLocationElement: z.string().min(3).max(255),
});
export type CreateRmcBatchDelivery = z.infer<typeof CreateRmcBatchDeliverySchema>;

export const RecordRmcSlumpTestSchema = z.object({
  specifiedSlumpMm: z.number().int().min(20).max(250).default(100),
  measuredSlumpMm: z.number().int().min(0).max(300),
  slumpType: z.enum(['TRUE_SLUMP', 'SHEAR_SLUMP', 'COLLAPSE_SLUMP']).default('TRUE_SLUMP'),
  concreteTemperatureC: z.number().min(10).max(45),
  ambientTemperatureC: z.number().min(5).max(50).optional().nullable(),
  testedByInspector: z.string().min(2).max(255),
  cubesCastBatchNo: z.string().max(100).optional().nullable(),
});
export type RecordRmcSlumpTest = z.infer<typeof RecordRmcSlumpTestSchema>;

export const UpdateRmcDischargeSchema = z.object({
  arrivedAt: z.string().datetime().optional().nullable(),
  dischargeStartedAt: z.string().datetime().optional().nullable(),
  dischargeCompletedAt: z.string().datetime().optional().nullable(),
  waterAddedOnSiteLiters: z.number().min(0).max(500).default(0),
  rejectionReason: z.string().max(1000).optional().nullable(),
  status: z.enum(['IN_TRANSIT', 'ARRIVED', 'POURING', 'COMPLETED', 'REJECTED_COLD_JOINT_RISK']).optional(),
});
export type UpdateRmcDischarge = z.infer<typeof UpdateRmcDischargeSchema>;

// -------------------------------------------------------------
// STRUCTURAL STEEL FRAMING & FABRICATION TAKEOFF (MILESTONE M28)
// -------------------------------------------------------------
export const StructuralSteelGradeEnum = z.enum(['S275JR', 'S355JR', 'S355J2', 'S460NH']);
export type StructuralSteelGrade = z.infer<typeof StructuralSteelGradeEnum>;

export const StructuralSectionTypeEnum = z.enum(['UB', 'UC', 'RHS', 'SHS', 'CHS', 'ANGLE']);
export type StructuralSectionType = z.infer<typeof StructuralSectionTypeEnum>;

export const StructuralSteelMemberInputSchema = z.object({
  memberMark: z.string().min(1).max(50),
  sectionType: StructuralSectionTypeEnum,
  sectionDesignation: z.string().min(2).max(100),
  unitWeightKgPerM: z.union([z.number().positive(), z.string()]).optional(),
  paintAreaM2PerM: z.union([z.number().positive(), z.string()]).optional(),
  lengthMeters: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]),
  quantity: z.number().int().min(1).default(1),
  connectionBoltsCount: z.number().int().min(0).default(0),
});
export type StructuralSteelMemberInput = z.infer<typeof StructuralSteelMemberInputSchema>;

export const CreateStructuralSteelTakeoffSchema = z.object({
  takeoffNo: z.string().min(2).max(100),
  structureTitle: z.string().min(3).max(255),
  drawingReference: z.string().max(100).optional().nullable(),
  steelGrade: StructuralSteelGradeEnum.default('S355JR'),
  members: z.array(StructuralSteelMemberInputSchema).min(1),
});
export type CreateStructuralSteelTakeoff = z.infer<typeof CreateStructuralSteelTakeoffSchema>;

// -------------------------------------------------------------
// GEOTECHNICAL SOIL COMPACTION QA ENGINE (MILESTONE M29)
// -------------------------------------------------------------
export const SoilLayerTypeEnum = z.enum([
  'SUBGRADE',
  'SUBBASE',
  'BASE_COURSE',
  'FOUNDATION_PAD',
  'EMBANKMENT_FILL',
]);
export type SoilLayerType = z.infer<typeof SoilLayerTypeEnum>;

export const SoilTestMethodEnum = z.enum([
  'SAND_REPLACEMENT',
  'NUCLEAR_GAUGE',
  'CORE_CUTTER',
]);
export type SoilTestMethod = z.infer<typeof SoilTestMethodEnum>;

export const CreateGeotechnicalSoilTestSchema = z.object({
  testNumber: z.string().min(2).max(100),
  testDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid test date format' }).optional(),
  locationElement: z.string().min(2).max(255),
  layerType: SoilLayerTypeEnum.default('SUBBASE'),
  testMethod: SoilTestMethodEnum.default('SAND_REPLACEMENT'),
  laboratoryMddGCm3: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]),
  laboratoryOmcPercent: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]),
  fieldWetDensityGCm3: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]),
  fieldMoisturePercent: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
  requiredCompactionPercent: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).optional().default(95.0),
  dcpBlowsPer100mm: z.number().int().positive().optional().nullable(),
  inspectedBy: z.string().min(2).max(255),
});
export type CreateGeotechnicalSoilTest = z.infer<typeof CreateGeotechnicalSoilTestSchema>;

// -------------------------------------------------------------
// ASPHALT PAVEMENT QUALITY & THERMAL TRACKER (MILESTONE M30)
// -------------------------------------------------------------
export const AsphaltMixTypeEnum = z.enum([
  'AC_20_BASE',
  'AC_14_WEARING',
  'SUPERPAVE_19',
  'SUPERPAVE_12_5',
  'BITUMEN_MACADAM',
]);
export type AsphaltMixType = z.infer<typeof AsphaltMixTypeEnum>;

export const LaneDirectionEnum = z.enum([
  'NORTHBOUND',
  'SOUTHBOUND',
  'EASTBOUND',
  'WESTBOUND',
  'MAIN_CARRIAGEWAY',
  'SERVICE_LANE',
]);
export type LaneDirection = z.infer<typeof LaneDirectionEnum>;

export const CreateAsphaltPavementBatchSchema = z.object({
  ticketNumber: z.string().min(2).max(100),
  supplierName: z.string().min(2).max(255),
  mixType: AsphaltMixTypeEnum.default('AC_14_WEARING'),
  truckRegNo: z.string().min(3).max(50),
  tonnageTons: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]),
  chainageStart: z.string().min(1).max(50),
  chainageEnd: z.string().min(1).max(50),
  laneDirection: LaneDirectionEnum.default('NORTHBOUND'),
  plantTempC: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,1})?$/)]),
  deliveryTempC: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,1})?$/)]),
  breakdownTempC: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,1})?$/)]),
  finishTempC: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,1})?$/)]),
  designThicknessMm: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).optional().default(50.0),
  inspectedBy: z.string().min(2).max(255),
});
export type CreateAsphaltPavementBatch = z.infer<typeof CreateAsphaltPavementBatchSchema>;

export const RecordAsphaltCoreTestSchema = z.object({
  coreThicknessMm: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]),
  coreDensityGCm3: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]),
  marshallDensityGCm3: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]),
  inspectedBy: z.string().min(2).max(255).optional(),
});
export type RecordAsphaltCoreTest = z.infer<typeof RecordAsphaltCoreTestSchema>;

// -------------------------------------------------------------
// TOPOGRAPHIC SURVEY & CUT/FILL EARTHWORKS (MILESTONE M31)
// -------------------------------------------------------------
export const SurveyCalculationMethodEnum = z.enum(['AVERAGE_END_AREA', 'PRISMOIDAL', 'SIMPSONS_RULE']);
export type SurveyCalculationMethod = z.infer<typeof SurveyCalculationMethodEnum>;

export const CreateCrossSectionStationInputSchema = z.object({
  stationIndex: z.number().int().nonnegative(),
  chainageMeters: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
  chainageLabel: z.string().min(1).max(50),
  existingGroundLevelM: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d{1,3})?$/)]),
  proposedFormationLevelM: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d{1,3})?$/)]),
  cutAreaM2: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,3})?$/)]).default(0),
  fillAreaM2: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,3})?$/)]).default(0),
  midCutAreaM2: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,3})?$/)]).optional().nullable(),
  midFillAreaM2: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,3})?$/)]).optional().nullable(),
  offsetsAndLevels: z.array(z.tuple([z.number(), z.number()])).optional().nullable(),
});
export type CreateCrossSectionStationInput = z.infer<typeof CreateCrossSectionStationInputSchema>;

export const CreateTopographicSurveySchema = z.object({
  surveyCode: z.string().min(2).max(100),
  title: z.string().min(2).max(255),
  surveyDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid survey date format' }).optional(),
  surveyorName: z.string().min(2).max(255),
  instrumentType: z.enum(['TOTAL_STATION', 'RTK_GNSS', 'DRONE_LIDAR', 'AUTO_LEVEL']).default('TOTAL_STATION'),
  calculationMethod: SurveyCalculationMethodEnum.default('PRISMOIDAL'),
  bulkingFactor: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]).default(1.200),
  shrinkageFactor: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,3})?$/)]).default(0.900),
  freehaulDistanceMeters: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).default(500.00),
  overhaulUnitRateKes: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).default(85.00),
  borrowUnitRateKes: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).default(350.00),
  stations: z.array(CreateCrossSectionStationInputSchema).min(2, { message: 'Survey must contain at least 2 cross-section stations' }),
});
export type CreateTopographicSurvey = z.infer<typeof CreateTopographicSurveySchema>;

// -------------------------------------------------------------
// CAN-BUS OBD-II TELEMATICS & PREDICTIVE MAINTENANCE (MILESTONE M32)
// -------------------------------------------------------------
export const RegisterCanBusTelematicsDeviceSchema = z.object({
  equipmentId: z.string().uuid(),
  deviceImei: z.string().min(8).max(50),
  deviceToken: z.string().max(100).optional().nullable(),
  protocol: z.enum(['OBD2', 'CANBUS', 'GPS_MODEM', 'MODBUS_FLOW']).default('CANBUS'),
  canBusBaudRate: z.union([z.literal(250000), z.literal(500000)]).default(250000),
  maxEngineBurnRateLph: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).default(35.00),
  simPhoneNumber: z.string().max(50).optional().nullable(),
  calibrationTankCapacityLiters: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).default(300.00),
  tankGeometry: z.enum(['RECTANGULAR', 'CYLINDRICAL_HORIZONTAL', 'CUSTOM_CURVE']).default('RECTANGULAR'),
});
export type RegisterCanBusTelematicsDevice = z.infer<typeof RegisterCanBusTelematicsDeviceSchema>;

export const IngestCanBusTelematicsPingSchema = z.object({
  deviceImei: z.string().min(8).max(50),
  deviceToken: z.string().max(100).optional().nullable(),
  latitude: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)]),
  longitude: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)]),
  engineStatus: z.enum(['RUNNING', 'IDLE', 'STOPPED']).default('RUNNING'),
  engineRpm: z.number().int().min(0).max(8000).optional().nullable(),
  coolantTempC: z.union([z.number().min(-40).max(150), z.string().regex(/^-?\d+(?:\.\d{1,1})?$/)]).optional().nullable(),
  oilTempC: z.union([z.number().min(-40).max(180), z.string().regex(/^-?\d+(?:\.\d{1,1})?$/)]).optional().nullable(),
  fuelRateLPerH: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]).optional().nullable(),
  engineLoadPercent: z.union([z.number().min(0).max(100), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]).optional().nullable(),
  speedKmh: z.union([z.number().min(0).max(250), z.string().regex(/^\d+(?:\.\d{1,1})?$/)]).optional().nullable(),
  batteryVoltage: z.union([z.number().min(0).max(36), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]).optional().nullable(),
  dtcFaultCodes: z.string().max(255).optional().nullable(),
  cumulativeEngineSeconds: z.number().int().nonnegative().default(0),
  fuelLevelPercent: z.union([z.number().min(0).max(100), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
});
export type IngestCanBusTelematicsPing = z.infer<typeof IngestCanBusTelematicsPingSchema>;

export const AcknowledgeMaintenanceAlertSchema = z.object({
  acknowledgedBy: z.string().min(2).max(255),
  actionNotes: z.string().max(1000).optional(),
});
export type AcknowledgeMaintenanceAlert = z.infer<typeof AcknowledgeMaintenanceAlertSchema>;

// -------------------------------------------------------------
// INDEPENDENT SITE INSPECTION & CONTRACTOR TENDERING (MILESTONE M33 )
// -------------------------------------------------------------

export const InspectionPhotoInputSchema = z.object({
  photoUrl: z.string().min(3),
  caption: z.string().max(255).optional().nullable(),
  elementInspected: z.string().max(100).optional().nullable(),
  tag: z.string().max(50).optional().nullable(),
  hasDiscrepancy: z.boolean().default(false),
  gpsLatitude: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)]).optional().nullable(),
  gpsLongitude: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)]).optional().nullable(),
});
export type InspectionPhotoInput = z.infer<typeof InspectionPhotoInputSchema>;

export const CreateIndependentInspectionSchema = z.object({
  inspectionCode: z.string().min(2).max(50).optional(),
  stage: z.string().min(2).max(100).optional().default('SUBSTRUCTURE'),
  scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid scheduled date format' }).optional(),
  scopeDescription: z.string().min(3).max(2000).optional(),
  reportedProgressPct: z.union([
    z.number().min(0).max(100),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  ]).optional(),
  contractorClaimedProgress: z.union([
    z.number().min(0).max(100),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  ]).optional(),
  inspectorName: z.string().min(2).max(255).optional().nullable(),
  inspectorLicense: z.string().min(2).max(100).optional().nullable(),
  inspectorPhone: z.string().max(50).optional().nullable(),
});
export type CreateIndependentInspection = z.infer<typeof CreateIndependentInspectionSchema>;

export const SubmitInspectionFindingsSchema = z.object({
  gpsLatitude: z.union([z.number().min(-90).max(90), z.string().regex(/^-?\d+(?:\.\d+)?$/)]),
  gpsLongitude: z.union([z.number().min(-180).max(180), z.string().regex(/^-?\d+(?:\.\d+)?$/)]),
  verifiedProgressPct: z.union([
    z.number().min(0).max(100),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  ]).optional(),
  verifiedProgress: z.union([
    z.number().min(0).max(100),
    z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  ]).optional(),
  cementBrandVerified: z.string().max(255).optional().nullable(),
  rebarVerified: z.string().max(255).optional().nullable(),
  materialsOnSiteNotes: z.string().max(2000).optional().nullable(),
  workmanshipRating: z.number().int().min(1).max(5).optional().default(4),
  safetyComplianceRating: z.number().int().min(1).max(5).optional().default(4),
  structuralDefectsFound: z.boolean().default(false),
  findingsNotes: z.string().max(5000).optional().nullable(),
  findingsSummary: z.string().max(5000).optional().nullable(),
  recommendations: z.string().max(5000).optional().nullable(),
  photos: z.array(InspectionPhotoInputSchema).optional().default([]),
});
export type SubmitInspectionFindings = z.infer<typeof SubmitInspectionFindingsSchema>;

export const ReviewInspectionSchema = z.object({
  clientReviewNotes: z.string().max(2000).optional().nullable(),
  feedback: z.string().max(2000).optional().nullable(),
  clientDiscrepancyFlagged: z.boolean().default(false),
  clientSatisfactionRating: z.number().int().min(1).max(5).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});
export type ReviewInspection = z.infer<typeof ReviewInspectionSchema>;

export const CreateProjectTenderSchema = z.object({
  tenderCode: z.string().min(2).max(50).optional(),
  tenderNumber: z.string().min(2).max(50).optional(),
  title: z.string().min(3).max(255),
  tradeCategory: z.string().min(2).max(100).optional(),
  category: z.string().min(2).max(100).optional(),
  scopeOfWork: z.string().min(5).max(10000),
  budgetKes: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).optional(),
  estimatedBudget: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).optional(),
  currency: z.string().max(10).default('KES'),
  durationWeeks: z.number().int().positive().optional().default(24),
  submissionDeadline: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid submission deadline date format' }),
});
export type CreateProjectTender = z.infer<typeof CreateProjectTenderSchema>;

export const SubmitTenderBidSchema = z.object({
  contractorName: z.string().min(2).max(255),
  contractorNcaCategory: z.string().min(2).max(50),
  amountKes: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).optional(),
  totalBidAmount: z.union([z.number().positive(), z.string().regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,2})?$/)]).optional(),
  currency: z.string().max(10).default('KES'),
  durationWeeks: z.number().int().positive(),
  technicalScore: z.number().min(0).max(100).optional(),
  proposalNotes: z.string().max(5000).optional().nullable(),
  easmmTradeBreakdown: z.any().optional().nullable(),
});
export type SubmitTenderBid = z.infer<typeof SubmitTenderBidSchema>;

export const EvaluateTenderBidsSchema = z.object({
  evaluations: z.array(
    z.object({
      bidId: z.string().uuid(),
      technicalScore: z.number().min(0).max(100),
      financialScore: z.number().min(0).max(100).optional(),
      notes: z.string().max(1000).optional().nullable(),
    }),
  ).optional(),
});
export type EvaluateTenderBids = z.infer<typeof EvaluateTenderBidsSchema>;

export const AwardTenderBidSchema = z.object({
  bidId: z.string().uuid().optional(),
  awardReason: z.string().max(1000).optional().nullable(),
});
export type AwardTenderBid = z.infer<typeof AwardTenderBidSchema>;








// -------------------------------------------------------------
// QUOTES (quotes-to-cash, ADR-007)
// -------------------------------------------------------------

export const QuoteLineItemInputSchema = z.object({
  section: z.string().max(120).optional().nullable(),
  description: z.string().min(1).max(2000),
  unit: z.enum(['item', 'sum', 'm', 'm2', 'm3', 'no', 'kg', 'day', 'hr', 'lot']).default('item'),
  quantity: z.number().positive(),
  unitRate: z.number().min(0),
});
export type QuoteLineItemInput = z.infer<typeof QuoteLineItemInputSchema>;

export const CreateQuoteSchema = z.object({
  title: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
  clientEmail: z.string().email().max(255).optional().nullable(),
  clientPhone: z.string().max(50).optional().nullable(),
  siteLocation: z.string().max(255).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  currency: z.enum(['KES', 'USD']).default('KES'),
  taxPct: z.number().min(0).max(100).default(0),
  depositPct: z.number().min(0).max(100).default(0),
  terms: z.string().max(5000).optional().nullable(),
  scopeNotes: z.string().max(5000).optional().nullable(),
  validDays: z.number().int().min(1).max(365).optional(),
  items: z.array(QuoteLineItemInputSchema).min(1),
});
export type CreateQuote = z.infer<typeof CreateQuoteSchema>;

export const UpdateQuoteSchema = CreateQuoteSchema.partial();
export type UpdateQuote = z.infer<typeof UpdateQuoteSchema>;

export const SendQuoteSchema = z.object({
  channel: z.enum(['link', 'whatsapp', 'email']).default('link'),
});
export type SendQuote = z.infer<typeof SendQuoteSchema>;

export const PublicQuoteRespondSchema = z.object({
  action: z.enum(['accept', 'decline', 'comment']),
  typedName: z.string().min(2).max(255).optional(),
  note: z.string().max(2000).optional().nullable(),
});
export type PublicQuoteRespond = z.infer<typeof PublicQuoteRespondSchema>;

export const ConvertQuoteSchema = z.object({
  projectName: z.string().min(1).max(255).optional(),
  projectCode: z.string().max(50).optional().nullable(),
  createDepositInvoice: z.boolean().default(false),
});
export type ConvertQuote = z.infer<typeof ConvertQuoteSchema>;

// -------------------------------------------------------------
// INVOICES (accounts receivable, Gate-4 slice S2)
// -------------------------------------------------------------

export const InvoiceLineItemInputSchema = QuoteLineItemInputSchema;
export type InvoiceLineItemInput = QuoteLineItemInput;

export const CreateInvoiceSchema = z.object({
  title: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
  clientEmail: z.string().email().max(255).optional().nullable(),
  clientPhone: z.string().max(50).optional().nullable(),
  billTo: z.string().max(2000).optional().nullable(),
  poNumber: z.string().max(100).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
  currency: z.enum(['KES', 'USD']).default('KES'),
  taxPct: z.number().min(0).max(100).default(0),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDays: z.number().int().min(0).max(365).default(30),
  terms: z.string().max(5000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  paybill: z.string().max(20).optional().nullable(),
  items: z.array(InvoiceLineItemInputSchema).min(1),
});
export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();
export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;

export const RecordInvoicePaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK', 'M_PESA', 'CHEQUE', 'CARD', 'OTHER']).default('BANK'),
  reference: z.string().max(100).optional().nullable(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(2000).optional().nullable(),
});
export type RecordInvoicePayment = z.infer<typeof RecordInvoicePaymentSchema>;

export const VoidInvoiceSchema = z.object({
  reason: z.string().min(1).max(255),
});
export type VoidInvoice = z.infer<typeof VoidInvoiceSchema>;

// -----------------------------------------------------------------------------
// Gate-4 S4: Payment Certificates & Closeout (ADR-008)
// -----------------------------------------------------------------------------

export const PaymentCertificateLineInputSchema = z.object({
  boqItemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  unit: z.string().max(20).optional().nullable(),
  progressPct: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Valid progress percentage').optional().nullable(),
  unitRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Valid unit rate').optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
});
export type PaymentCertificateLineInput = z.infer<typeof PaymentCertificateLineInputSchema>;

export const CreatePaymentCertificateSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodStart must be YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodEnd must be YYYY-MM-DD'),
  thisPeriodAmount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  lines: z.array(PaymentCertificateLineInputSchema).max(500).optional().nullable(),
  retentionPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid percentage').optional().nullable(),
  retentionReleased: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  advanceRecovery: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  amountDuePrevious: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreatePaymentCertificate = z.infer<typeof CreatePaymentCertificateSchema>;

export const UpdatePaymentCertificateSchema = z.object({
  thisPeriodAmount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  lines: z.array(PaymentCertificateLineInputSchema).max(500).optional().nullable(),
  retentionPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid percentage').optional().nullable(),
  retentionReleased: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  advanceRecovery: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  amountDuePrevious: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type UpdatePaymentCertificate = z.infer<typeof UpdatePaymentCertificateSchema>;

export const CreateInvoiceFromCertificateSchema = z.object({
  // Optional — falls back to the accepted quote's client, then the project name.
  clientName: z.string().min(2).max(255).optional(),
  clientEmail: z.string().email().optional().nullable(),
  clientPhone: z.string().max(50).optional().nullable(),
  billTo: z.string().max(2000).optional().nullable(),
  poNumber: z.string().max(100).optional().nullable(),
  dueDays: z.number().int().min(0).max(365).default(30),
  terms: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateInvoiceFromCertificate = z.infer<typeof CreateInvoiceFromCertificateSchema>;

export const TaxSettingsSchema = z.object({
  vatPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid VAT percentage').optional(),
  whtContractorPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid WHT percentage').optional(),
  whtSubcontractorPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid WHT percentage').optional(),
  whtConsultantPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid WHT percentage').optional(),
  whtSupplierPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid WHT percentage').optional(),
  whvatPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valid WHVAT percentage').optional(),
});
export type TaxSettings = z.infer<typeof TaxSettingsSchema>;

export const PaymentCertificateActionSchema = z.object({
  action: z.enum(['SUBMIT', 'REVIEW', 'CERTIFY', 'REJECT', 'MARK_PAID']),
  comments: z.string().max(2000).optional(),
  paidReference: z.string().max(100).optional().nullable(),
}).refine((v) => v.action !== 'REJECT' || (v.comments && v.comments.trim().length >= 3), {
  message: 'A rejection reason (comments) is required',
  path: ['comments'],
});
export type PaymentCertificateAction = z.infer<typeof PaymentCertificateActionSchema>;

export const CloseoutTransitionSchema = z.object({
  stage: z.enum(['HANDED_OVER', 'DEFECTS_LIABILITY', 'DEFECTS_EXPIRED', 'CLOSED']),
  notes: z.string().max(2000).optional(),
});
export type CloseoutTransition = z.infer<typeof CloseoutTransitionSchema>;

// -----------------------------------------------------------------------------
// Gate-4 S5: Commitments -> Claims -> Payment Applications
// -----------------------------------------------------------------------------

export const CreateCommitmentSchema = z.object({
  vendorName: z.string().min(2).max(255),
  vendorType: z.enum(['SUBCONTRACTOR', 'SUPPLIER', 'CONSULTANT', 'OTHER']).default('SUBCONTRACTOR'),
  scopeDescription: z.string().max(5000).optional().nullable(),
  contractValue: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  currency: z.string().length(3).default('KES'),
  retentionPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid percentage').optional().nullable(),
  retentionCapPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid percentage').optional().nullable(),
  advanceAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  advancePaid: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  advanceRecoverPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid percentage').optional().nullable(),
  costCode: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateCommitment = z.infer<typeof CreateCommitmentSchema>;

export const UpdateCommitmentSchema = z.object({
  vendorName: z.string().min(2).max(255).optional(),
  scopeDescription: z.string().max(5000).optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});
export type UpdateCommitment = z.infer<typeof UpdateCommitmentSchema>;

export const CreatePaymentApplicationSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodStart must be YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'periodEnd must be YYYY-MM-DD'),
  grossClaimed: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount'),
  whtPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid percentage').optional().nullable(),
  previousBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid amount').optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreatePaymentApplication = z.infer<typeof CreatePaymentApplicationSchema>;

export const PaymentApplicationActionSchema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'REJECT', 'MARK_PAID']),
  comments: z.string().max(2000).optional(),
  paidReference: z.string().max(100).optional().nullable(),
}).refine((v) => v.action !== 'REJECT' || (v.comments && v.comments.trim().length >= 3), {
  message: 'A rejection reason (comments) is required',
  path: ['comments'],
});
export type PaymentApplicationAction = z.infer<typeof PaymentApplicationActionSchema>;

// -----------------------------------------------------------------------------
// Gate-4 S8: Project onboarding & edit (edit-project modal coverage)
// -----------------------------------------------------------------------------

export const ProjectHealthStatusEnum = z.enum([
  'PLANNING',
  'ON_TRACK',
  'AT_RISK',
  'CLOSING',
  'ARCHIVED',
  // Legacy/internal values kept for backward compatibility
  'ACTIVE',
  'COMPLETED',
  'ON_HOLD',
]);
export type ProjectHealthStatus = z.infer<typeof ProjectHealthStatusEnum>;

export const ProjectMemberRoleEnum = z.enum([
  'PROJECT_LEAD',
  'PM',
  'ARCHITECT',
  'QS',
  'SITE_MANAGER',
  'CLIENT',
  'MEMBER',
]);
export type ProjectMemberRole = z.infer<typeof ProjectMemberRoleEnum>;

const MoneyAmount = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount');
const Coord = z.string().regex(/^-?\d+(\.\d{1,6})?$/, 'Must be a valid coordinate');
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const CreateProjectDetailsSchema = z.object({
  name: z.string().min(2).max(255),
  code: z.string().min(1).max(50),
  // Legacy aliases accepted for backward compatibility
  budget: z.union([z.number(), z.string()]).optional().nullable(),
  originalContractSum: z.union([z.number(), z.string()]).optional().nullable(),
  currentApprovedBudget: z.union([z.number(), z.string()]).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  mapLatitude: Coord.optional().nullable(),
  mapLongitude: Coord.optional().nullable(),
  contractValue: MoneyAmount.optional().nullable(),
  contractCurrency: z.string().length(3).optional().nullable(),
  ncaProjectNo: z.string().max(100).optional().nullable(),
  moneyAtRiskKes: MoneyAmount.optional().nullable(),
  status: ProjectHealthStatusEnum.optional().nullable(),
  startDate: IsoDate.optional().nullable(),
  targetEndDate: IsoDate.optional().nullable(),
});
export type CreateProjectDetails = z.infer<typeof CreateProjectDetailsSchema>;

export const UpdateProjectDetailsSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  mapLatitude: Coord.optional().nullable(),
  mapLongitude: Coord.optional().nullable(),
  contractValue: MoneyAmount.optional().nullable(),
  contractCurrency: z.string().length(3).optional().nullable(),
  ncaProjectNo: z.string().max(100).optional().nullable(),
  moneyAtRiskKes: MoneyAmount.optional().nullable(),
  status: ProjectHealthStatusEnum.optional().nullable(),
  startDate: IsoDate.optional().nullable(),
  targetEndDate: IsoDate.optional().nullable(),
  progressPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a percentage 0-100').optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateProjectDetails = z.infer<typeof UpdateProjectDetailsSchema>;

export const AssignProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  // Free-form project-scoped role label (legacy roles like PROJECT_QS,
  // PM_QS, SITE_SUPERVISOR are valid); observed modal offers PM/Architect/QS.
  role: z.string().min(1).max(50).default('MEMBER'),
});
export type AssignProjectMember = z.infer<typeof AssignProjectMemberSchema>;

// -----------------------------------------------------------------------------
// Gate-5 G5-1: Announcements
// -----------------------------------------------------------------------------

export const AnnouncementAudienceEnum = z.enum(['ALL', 'INTERNAL', 'CLIENTS', 'FIELD_TEAM']);
export const AnnouncementPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(3).max(255),
  body: z.string().min(3).max(10000),
  priority: AnnouncementPriorityEnum.default('NORMAL'),
  audience: AnnouncementAudienceEnum.default('ALL'),
  targetRoles: z.array(z.string().min(1).max(50)).max(20).optional(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type CreateAnnouncement = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  body: z.string().min(3).max(10000).optional(),
  priority: AnnouncementPriorityEnum.optional(),
  audience: AnnouncementAudienceEnum.optional(),
  targetRoles: z.array(z.string().min(1).max(50)).max(20).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateAnnouncement = z.infer<typeof UpdateAnnouncementSchema>;

// -----------------------------------------------------------------------------
// Gate-5 G5-3: Inbox messages
// -----------------------------------------------------------------------------

export const InboxAudienceEnum = z.enum(['ALL_MEMBERS', 'PROJECT_TEAM', 'ROLE']);

export const SendInboxMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  projectId: z.string().uuid().optional().nullable(),
  audience: InboxAudienceEnum.default('PROJECT_TEAM'),
  targetRoles: z.array(z.string().min(1).max(50)).max(20).optional(),
  parentId: z.string().uuid().optional().nullable(),
});
export type SendInboxMessage = z.infer<typeof SendInboxMessageSchema>;

// -----------------------------------------------------------------------------
// Gate-5 G5-4: Site observations & corrective actions
// -----------------------------------------------------------------------------

export const ObservationTypeEnum = z.enum(['QUALITY', 'SAFETY', 'ENVIRONMENTAL', 'COMMISSIONING']);
export const ObservationPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const ObservationStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'CLOSED']);

export const CreateObservationSchema = z.object({
  title: z.string().min(3).max(255),
  type: ObservationTypeEnum.default('QUALITY'),
  priority: ObservationPriorityEnum.default('MEDIUM'),
  location: z.string().max(255).optional().nullable(),
  description: z.string().min(3).max(10000),
});
export type CreateObservation = z.infer<typeof CreateObservationSchema>;

export const UpdateObservationStatusSchema = z.object({
  status: ObservationStatusEnum,
  note: z.string().max(2000).optional(),
});

export const CreateCorrectiveActionSchema = z.object({
  title: z.string().min(3).max(255),
  ownerName: z.string().min(2).max(255),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  observationId: z.string().uuid().optional().nullable(),
  sourceRef: z.string().max(50).optional().nullable(),
  steps: z.array(z.string().min(1).max(500)).max(20).default([]),
});
export type CreateCorrectiveAction = z.infer<typeof CreateCorrectiveActionSchema>;

export const UpdateCorrectiveActionSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
  steps: z.array(z.string().min(1).max(500)).max(20).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  ownerName: z.string().min(2).max(255).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

// -----------------------------------------------------------------------------
// Gate-5 G5-5: Crews
// -----------------------------------------------------------------------------

export const CreateCrewSchema = z.object({
  name: z.string().min(2).max(255),
  trade: z.string().min(2).max(100),
  foremanName: z.string().max(255).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateCrew = z.infer<typeof CreateCrewSchema>;

export const UpdateCrewSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  trade: z.string().min(2).max(100).optional(),
  foremanName: z.string().max(255).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  notes: z.string().max(2000).optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

export const AddCrewMemberSchema = z.object({
  name: z.string().min(2).max(255),
  trade: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  dailyRateKes: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
});
export type AddCrewMember = z.infer<typeof AddCrewMemberSchema>;

// -----------------------------------------------------------------------------
// Gate-5 G5-7: Company documents vault
// -----------------------------------------------------------------------------

export const CompanyDocCategoryEnum = z.enum(['POLICY', 'TEMPLATE', 'CERTIFICATION', 'INSURANCE', 'HR', 'LEGAL', 'OTHER']);

export const CreateCompanyDocumentSchema = z.object({
  title: z.string().min(2).max(255),
  category: CompanyDocCategoryEnum.optional().nullable(), // omit → lands in Unfiled
  referenceNo: z.string().max(100).optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  mimeType: z.string().max(100).optional().nullable(),
  fileSize: z.number().int().positive().optional().nullable(),
  storageKey: z.string().max(500).optional().nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});
export type CreateCompanyDocument = z.infer<typeof CreateCompanyDocumentSchema>;

export const UpdateCompanyDocumentSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  category: CompanyDocCategoryEnum.optional().nullable(),
  referenceNo: z.string().max(100).optional().nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  notes: z.string().max(5000).optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

// -----------------------------------------------------------------------------
// Gate-5 G5-8: Correspondence log
// -----------------------------------------------------------------------------

export const CorrespondenceTypeEnum = z.enum(['LETTER', 'SUBMITTAL', 'TRANSMITTAL', 'NOTICE']);
export const CorrespondenceDirectionEnum = z.enum(['OUTGOING', 'INCOMING']);
export const CorrespondenceStatusEnum = z.enum(['DRAFT', 'SENT', 'RECEIVED', 'RESPONDED', 'FILED']);

export const CreateCorrespondenceSchema = z.object({
  type: CorrespondenceTypeEnum,
  direction: CorrespondenceDirectionEnum.default('OUTGOING'),
  subject: z.string().min(3).max(500),
  fromName: z.string().min(2).max(255),
  toName: z.string().min(2).max(255),
  reference: z.string().max(100).optional().nullable(),
  letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  body: z.string().max(20000).optional().nullable(),
  attachmentName: z.string().max(255).optional().nullable(),
});
export type CreateCorrespondence = z.infer<typeof CreateCorrespondenceSchema>;

export const UpdateCorrespondenceSchema = z.object({
  status: CorrespondenceStatusEnum.optional(),
  subject: z.string().min(3).max(500).optional(),
  reference: z.string().max(100).optional().nullable(),
  body: z.string().max(20000).optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

// -----------------------------------------------------------------------------
// Gate-5 G5-9: Scheduled reports
// -----------------------------------------------------------------------------

export const ScheduledReportTypeEnum = z.enum(['FINANCIAL', 'OPERATIONAL', 'BY_PROJECT', 'BY_REGION', 'CUSTOM']);
export const ReportFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const CreateScheduledReportSchema = z.object({
  name: z.string().min(3).max(255),
  reportType: ScheduledReportTypeEnum,
  frequency: ReportFrequencyEnum,
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  recipients: z.array(z.string().min(1).max(255)).min(1).max(20),
  format: z.enum(['PDF', 'EXCEL', 'JSON']).default('PDF'),
});
export type CreateScheduledReport = z.infer<typeof CreateScheduledReportSchema>;

export const UpdateScheduledReportSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  frequency: ReportFrequencyEnum.optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  recipients: z.array(z.string().min(1).max(255)).min(1).max(20).optional(),
  format: z.enum(['PDF', 'EXCEL', 'JSON']).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

// -----------------------------------------------------------------------------
// Gate-5 G5-4b: Consultant review on inspections
// -----------------------------------------------------------------------------

export const ConsultantReviewDecisionEnum = z.enum(['APPROVE', 'REJECT']);

export const ConsultantReviewSchema = z.object({
  decision: ConsultantReviewDecisionEnum,
  notes: z.string().max(5000).optional().nullable(),
});
export type ConsultantReview = z.infer<typeof ConsultantReviewSchema>;

// -----------------------------------------------------------------------------
// Gate-5 G5-10: Daily attendance
// -----------------------------------------------------------------------------

export const AttendanceStatusEnum = z.enum(['PRESENT', 'HALF_DAY', 'LEAVE', 'OFF_DAY', 'ABSENT']);

export const RecordAttendanceSchema = z.object({
  laborerId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // default today
  status: AttendanceStatusEnum.default('PRESENT'),
  notes: z.string().max(2000).optional().nullable(),
  crewId: z.string().uuid().optional().nullable(),
});
export type RecordAttendance = z.infer<typeof RecordAttendanceSchema>;

export const CheckInOutSchema = z.object({
  laborerId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

// -----------------------------------------------------------------------------
// Gate-5 G5-6: Checklist templates & assignments
// -----------------------------------------------------------------------------

export const ChecklistQuestionTypeEnum = z.enum(['TEXT', 'NUMBER', 'DATE', 'YES_NO', 'PASS_FAIL', 'DROPDOWN', 'CHECKBOX', 'PHOTO', 'SIGNATURE']);

export const ChecklistQuestionSchema = z.object({
  text: z.string().min(2).max(500),
  type: ChecklistQuestionTypeEnum.default('TEXT'),
  options: z.array(z.string().min(1).max(100)).max(20).optional(),
  required: z.boolean().default(false),
});
export type ChecklistQuestion = z.infer<typeof ChecklistQuestionSchema>;

export const ChecklistTradeEnum = z.enum([
  'GENERAL', 'MASONRY', 'CONCRETE', 'STEEL_FIXING', 'CARPENTRY', 'ELECTRICAL',
  'PLUMBING', 'PAINTING', 'TILING_FLOORING', 'ROOFING', 'STRUCTURAL_STEEL',
  'WELDING_FABRICATION', 'GLAZING_ALUMINIUM', 'WATERPROOFING', 'SCAFFOLDING', 'CUSTOM',
]);

export const CreateChecklistTemplateSchema = z.object({
  title: z.string().min(3).max(255),
  tradeCategory: ChecklistTradeEnum.default('GENERAL'),
  kind: z.enum(['SAFETY', 'QUALITY', 'PRE_HANDOVER', 'CUSTOM']).default('CUSTOM'),
  isGlobal: z.boolean().default(false),
  questions: z.array(ChecklistQuestionSchema).min(1).max(100),
});
export type CreateChecklistTemplate = z.infer<typeof CreateChecklistTemplateSchema>;

export const CreateChecklistAssignmentSchema = z.object({
  templateId: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(255),
  trade: z.string().min(2).max(100),
  assignedToName: z.string().max(255).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
export type CreateChecklistAssignment = z.infer<typeof CreateChecklistAssignmentSchema>;

export const SubmitChecklistResponseSchema = z.object({
  responses: z.array(z.object({
    questionIdx: z.number().int().min(0),
    answer: z.union([z.string().max(5000), z.boolean(), z.number()]),
    notes: z.string().max(2000).optional(),
  })).min(1).max(200),
});
export type SubmitChecklistResponse = z.infer<typeof SubmitChecklistResponseSchema>;

export const ReviewChecklistAssignmentSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().max(5000).optional().nullable(),
});
export type ReviewChecklistAssignment = z.infer<typeof ReviewChecklistAssignmentSchema>;
