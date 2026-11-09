import crypto from 'node:crypto';

/**
 * Validates production environment security configuration (Fail-Closed).
 * Refuses server startup if critical webhook secrets or JWT signing keys are missing or under 32 characters.
 */
export function validateEnvironmentSecurity(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const requiredSecrets: Array<{ name: string; value?: string; minLen: number }> = [
      { name: 'MPESA_WEBHOOK_SECRET', value: process.env.MPESA_WEBHOOK_SECRET, minLen: 32 },
      { name: 'SITE_OPS_WEBHOOK_SECRET', value: process.env.SITE_OPS_WEBHOOK_SECRET, minLen: 32 },
      { name: 'JWT_ACCESS_SECRET', value: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET, minLen: 32 },
    ];

    for (const secret of requiredSecrets) {
      if (!secret.value || secret.value.trim().length < secret.minLen) {
        throw new Error(
          `FATAL: Production security configuration error - ${secret.name} must be set and at least ${secret.minLen} characters long.`
        );
      }
    }
  }
}

/**
 * Constant-time string comparison using crypto.timingSafeEqual to prevent side-channel timing attacks.
 */
export function timingSafeCompare(provided: string | undefined | null, expected: string | undefined | null): boolean {
  if (!provided || !expected) {
    return false;
  }
  const bufProvided = Buffer.from(provided, 'utf8');
  const bufExpected = Buffer.from(expected, 'utf8');
  if (bufProvided.length !== bufExpected.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Generates a cryptographically signed tenant webhook token for Site Operations ingest (C3, 2b).
 * Token format: <tenantId>.<hmacSignature>
 */
export function generateSignedSiteOpsToken(tenantId: string, secret?: string): string {
  const signingKey = secret || process.env.SITE_OPS_WEBHOOK_SECRET || '';
  if (!signingKey) {
    throw new Error('Cannot sign site-ops token: SITE_OPS_WEBHOOK_SECRET is not configured');
  }
  const signature = crypto.createHmac('sha256', signingKey).update(tenantId).digest('hex');
  return `${tenantId}.${signature}`;
}

/**
 * Verifies a signed Site Operations webhook token and extracts the authenticated tenantId (C3, 2b).
 * Returns the verified tenantId if signature matches, or null if tampered/invalid.
 */
export function verifySignedSiteOpsToken(token: string | undefined | null, secret?: string): string | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [tenantId, providedSignature] = parts;
  if (!tenantId || !providedSignature) {
    return null;
  }
  const signingKey = secret || process.env.SITE_OPS_WEBHOOK_SECRET || '';
  if (!signingKey) {
    return null;
  }

  const expectedSignature = crypto.createHmac('sha256', signingKey).update(tenantId).digest('hex');
  const isValid = timingSafeCompare(providedSignature, expectedSignature);
  return isValid ? tenantId : null;
}
