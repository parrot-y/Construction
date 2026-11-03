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
