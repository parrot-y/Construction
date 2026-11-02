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

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
