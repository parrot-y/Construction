import crypto from 'node:crypto';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Account-lifecycle token helpers. Raw tokens are 32-byte random hex values;
 * only their SHA-256 hashes are persisted. Email delivery is simulated for the
 * pilot — callers may surface the raw token in non-production responses so the
 * flow is exercisable end-to-end before a provider is configured.
 */

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30min

/** Issues (or re-issues) a single-use email verification token for a user. */
export async function issueEmailVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: userId },
    data: {
      email_verify_token_hash: sha256(token),
      email_verify_token_expires_at: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      email_verify_token_used_at: null,
    },
  });
  return token;
}

export type ConsumeVerificationResult = 'ok' | 'invalid' | 'expired';

/** Consumes an email verification token, marking the user's email verified. */
export async function consumeEmailVerificationToken(token: string): Promise<ConsumeVerificationResult> {
  const user = await prisma.user.findFirst({
    where: { email_verify_token_hash: sha256(token) },
  });
  if (!user) return 'invalid';
  if (user.email_verify_token_used_at) return 'invalid';
  if (!user.email_verify_token_expires_at || user.email_verify_token_expires_at < new Date()) return 'expired';

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email_verified_at: new Date(),
      email_verify_token_used_at: new Date(),
    },
  });
  return 'ok';
}

/**
 * Issues a single-use password-reset token for a user inside a tenant. Any
 * previous unused tokens for the same user+tenant are invalidated first.
 * `createdBy` records an admin-assisted reset for audit.
 */
export async function issuePasswordResetToken(
  userId: string,
  tenantId: string,
  createdBy: string | null = null,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await withTenantTx(prisma, tenantId, async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { tenant_id: tenantId, user_id: userId, used_at: null },
      data: { used_at: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        token_hash: sha256(token),
        expires_at: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        created_by: createdBy,
      },
    });
  });
  return token;
}

export interface PasswordResetTokenRow {
  id: string;
  tenant_id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
}

/** Unauthenticated lookup by raw token — hash-only, via SECURITY DEFINER fn. */
export async function lookupPasswordResetToken(token: string): Promise<PasswordResetTokenRow | null> {
  const rows = await prisma.$queryRaw<PasswordResetTokenRow[]>`
    SELECT * FROM lookup_password_reset_token(${sha256(token)}::text);
  `;
  return rows[0] ?? null;
}

/** Absolute URL for a copy-and-send reset link (simulated delivery pilot). */
export function passwordResetUrl(token: string): string {
  const base = (process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/?reset=${token}`;
}

/** Absolute verify-email link for transactional email delivery. */
export function emailVerificationUrl(token: string): string {
  const base = (process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/?verify=${token}`;
}

/** Absolute invitation-acceptance link for transactional email delivery. */
export function invitationAcceptUrl(token: string): string {
  const base = (process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/?invite=${token}`;
}
