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

export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
