import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scryptAsync = promisify(scrypt) as any;

// scrypt parameters (Stage-7): N=2^17, r=8, p=1 — stored inside the hash so
// parameters can be raised again without breaking existing credentials.
// maxmem must cover 128 * N * r ≈ 128 MiB plus overhead.
const SCRYPT_PARAMS = { N: 1 << 17, r: 8, p: 1 } as const;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
const KEY_LEN = 64;
const SALT_LEN = 16;
const FORMAT_PREFIX = 's2$';

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
 * Hashes a plaintext password. Format: `s2$N$r$p$<saltHex>$<keyHex>`.
 * Legacy format `<saltHex>:<keyHex>` (scrypt defaults N=2^14,r=8,p=1) still verifies.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;
  return `${FORMAT_PREFIX}${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derivedKey.toString('hex')}`;
}

function parseHash(combinedHash: string): { N: number; r: number; p: number; salt: string; key: string } | null {
  if (combinedHash.startsWith(FORMAT_PREFIX)) {
    const parts = combinedHash.slice(FORMAT_PREFIX.length).split('$');
    if (parts.length !== 5) return null;
    const [n = '', r = '', p = '', salt = '', key = ''] = parts;
    const N = parseInt(n, 10);
    const rr = parseInt(r, 10);
    const pp = parseInt(p, 10);
    if (!Number.isFinite(N) || !Number.isFinite(rr) || !Number.isFinite(pp) || !salt || !key) return null;
    return { N, r: rr, p: pp, salt, key };
  }
  // Legacy: `<saltHex>:<keyHex>` with scrypt defaults (N=16384, r=8, p=1)
  const parts = combinedHash.split(':');
  if (parts.length !== 2) return null;
  const [salt, key] = parts;
  if (!salt || !key) return null;
  return { N: 1 << 14, r: 8, p: 1, salt, key };
}

/** True when the stored hash uses the current parameter-bearing format. */
export function isCurrentHashFormat(combinedHash: string): boolean {
  return combinedHash.startsWith(FORMAT_PREFIX);
}

/**
 * Verifies a plaintext password against a stored hash. Supports both the
 * current `s2$N$r$p$salt$key` format and the legacy `salt:key` format.
 */
export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  const parsed = parseHash(combinedHash);
  if (!parsed) return false;
  const keyBuffer = Buffer.from(parsed.key, 'hex');
  const derivedKey = (await scryptAsync(password, parsed.salt, KEY_LEN, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

export * from './audit';
export * from '@prisma/client';
