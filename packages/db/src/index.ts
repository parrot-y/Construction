import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Creates and configures a PrismaClient instance.
 */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const url = databaseUrl || process.env.DATABASE_URL;
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

/**
 * Global singleton Prisma client for base application connections.
 */
export const prisma = createPrismaClient();

/**
 * Executes a callback within an interactive transaction on the base client,
 * binding the PostgreSQL runtime variable `app.current_tenant_id` to this transaction lease.
 *
 * This pattern directly resolves ADR-001 requirements A1–A3, preventing extension-based
 * transaction isolation leakage or rollback failure.
 */
export async function withTenantTx<T>(
  client: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error('Tenant context isolation requires a valid non-empty tenantId');
  }

  return client.$transaction(async (tx) => {
    // 1. Set current_tenant_id scoped strictly to this transaction lease (is_local = TRUE)
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`;

    // 2. Execute business operations inside the same transaction
    return fn(tx);
  });
}

/**
 * Hashes a plaintext password using crypto.scrypt with a cryptographically secure 16-byte salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a salt:hash string using constant-time comparison.
 */
export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  const parts = combinedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, key] = parts;
  if (!salt || !key) {
    return false;
  }
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

export * from '@prisma/client';
