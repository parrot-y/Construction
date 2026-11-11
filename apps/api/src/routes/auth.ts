import crypto from 'node:crypto';
import { hashPassword, prisma, recordAuditLog, verifyPassword, withTenantTx } from '@construction/db';
import { getPermissionsForRole, Role } from '@construction/permissions';
import {
  AuthUserResponse,
  FieldLoginSchema,
  LoginRequestSchema,
  RegisterCompanySchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from '@construction/validation';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  consumeEmailVerificationToken,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  lookupPasswordResetToken,
  passwordResetUrl,
} from '../lib/accountTokens';
import { normalizeKenyaPhone } from './invitations';

interface LoginAttempt {
  count: number;
  resetAt: number;
}

// In-memory sliding window rate limiter for login protection (OWASP A07)
const MAX_FAILED_ATTEMPTS = 20;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5-minute lockout window
const failedLoginsMap = new Map<string, LoginAttempt>();

// Clean up stale attempt records
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of failedLoginsMap.entries()) {
    if (now > attempt.resetAt) {
      failedLoginsMap.delete(ip);
    }
  }
}, 60 * 1000).unref();

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const setSessionCookies = (reply: any, accessToken: string, refreshToken: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  reply.setCookie('access_token', accessToken, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 15 * 60,
  });
  reply.setCookie('refresh_token', refreshToken, {
    path: '/api/v1/auth', httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
  });
};

const clearSessionCookies = (reply: any) => {
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
};

/**
 * Shared post-credential session issuance: resolves memberships, picks the
 * target tenant, signs access+refresh JWTs, sets cookies, returns the
 * AuthUserResponse payload. Used by password login and phone+PIN field login.
 */
type SessionIssueResult =
  | { __error: { status: number; message: string } }
  | { response: AuthUserResponse };

async function issueSessionForUser(
  server: FastifyInstance,
  reply: any,
  user: { id: string; email: string; full_name: string; phone_number: string | null },
  requestedTenantId?: string,
): Promise<SessionIssueResult> {
  // Retrieve tenant memberships via narrow SECURITY DEFINER lookup function without auth_context bypasses (2c)
  const membershipRows = await prisma.$queryRaw<any[]>`
    SELECT * FROM lookup_user_memberships_for_login(${user.id}::uuid);
  `;

  const memberships = membershipRows.map((m) => ({
    id: m.id,
    tenant_id: m.tenant_id,
    role: m.role,
    tenant: {
      id: m.tenant_id,
      name: m.tenant_name,
      slug: m.tenant_slug,
      currency: m.tenant_currency || 'KES',
    },
  }));

  if (memberships.length === 0) {
    return { __error: { status: 403, message: 'User does not belong to any active company tenant' } };
  }

  const activeMembership = requestedTenantId
    ? memberships.find((m) => m.tenant_id === requestedTenantId)
    : memberships[0];

  if (!activeMembership) {
    return { __error: { status: 403, message: 'User is not authorized for the requested company tenant' } };
  }

  const tokenPayloadBase = {
    sub: user.id,
    email: user.email,
    fullName: user.full_name,
    tenantId: activeMembership.tenant_id,
    role: activeMembership.role,
  };

  const token = server.jwt.sign({ ...tokenPayloadBase, typ: 'access' as const }, { expiresIn: ACCESS_TTL });
  const refreshJti = crypto.randomUUID();
  const refreshToken = server.jwt.sign(
    { ...tokenPayloadBase, typ: 'refresh' as const, jti: refreshJti },
    { expiresIn: REFRESH_TTL },
  );

  await withTenantTx(prisma, activeMembership.tenant_id, (tx) =>
    tx.refreshToken.create({
      data: {
        jti: refreshJti,
        tenant_id: activeMembership.tenant_id,
        user_id: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  );

  setSessionCookies(reply, token, refreshToken);

  const permissions = getPermissionsForRole(activeMembership.role as Role);

  const response: AuthUserResponse = {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      role: activeMembership.role,
      tenant: {
        id: activeMembership.tenant.id,
        name: activeMembership.tenant.name,
        slug: activeMembership.tenant.slug,
        currency: activeMembership.tenant.currency,
      },
    },
    permissions: [...permissions],
    token,
  };

  return { response };
}

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // POST /api/v1/auth/login
  server.post('/api/v1/auth/login', {
    config: { rateLimit: { max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 30), timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    const now = Date.now();
    const attempt = failedLoginsMap.get(clientIp);

    // Rate limiting guard
    if (attempt && now < attempt.resetAt && attempt.count >= MAX_FAILED_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((attempt.resetAt - now) / 1000);
      reply.header('Retry-After', retryAfterSeconds);
      server.log.warn(
        { ip: clientIp, attempts: attempt.count },
        'Security Audit: Login rate limit exceeded; request throttled',
      );
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Too many failed login attempts. Please try again later.',
      });
    }

    const recordFailedAttempt = () => {
      const cur = failedLoginsMap.get(clientIp);
      if (!cur || now > cur.resetAt) {
        failedLoginsMap.set(clientIp, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
      } else {
        cur.count += 1;
      }
    };

    // Field workers sign in with { phone, pin } on the standard login endpoint.
    const body0 = request.body as { phone?: string; pin?: string } | undefined;
    if (body0 && typeof body0.phone === 'string' && typeof body0.pin === 'string') {
      return handleFieldLogin(request, reply);
    }

    const parseResult = LoginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid login payload',
        details: parseResult.error.flatten(),
      });
    }

    const { email, password, tenantId } = parseResult.data;

    // Retrieve user directly from public schema without auth_context bypasses (2c)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.is_active) {
      recordFailedAttempt();
      server.log.warn(
        { ip: clientIp, email: email.toLowerCase(), reason: 'USER_NOT_FOUND_OR_INACTIVE' },
        'Security Audit: Failed authentication attempt',
      );
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      recordFailedAttempt();
      server.log.warn(
        { ip: clientIp, email: email.toLowerCase(), reason: 'INVALID_PASSWORD' },
        'Security Audit: Failed authentication attempt',
      );
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Reset failed login counter on successful authentication
    failedLoginsMap.delete(clientIp);

    // Account verification gate: self-serve accounts (register-company,
    // invite accept) cannot sign in until email/phone is verified or a company
    // admin activates them. Credentials were valid — this is not a failed
    // login attempt and must not feed the lockout counter.
    if (!user.email_verified_at && !user.phone_verified_at) {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'ACCOUNT_NOT_VERIFIED',
        message: 'Verify your email address, or ask your company administrator to activate your account.',
      });
    }

    const session = await issueSessionForUser(server, reply, user, tenantId);
    if ('__error' in session) {
      return reply.status(session.__error.status).send({
        error: session.__error.status === 403 ? 'Forbidden' : 'Error',
        message: session.__error.message,
      });
    }
    return reply.status(200).send(session.response);
  });

  // Shared phone + PIN sign-in used by both /auth/field-login and /auth/login
  // (field workers authenticate with { phone, pin } on the standard login
  // endpoint too — a basic phone has no email/password form).
  const handleFieldLogin = async (request: any, reply: any) => {
    const clientIp = request.ip || '127.0.0.1';
    const parsed = FieldLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid field login payload — phone and 6-digit PIN required',
      });
    }
    const { phone, pin } = parsed.data;
    const normalized = normalizeKenyaPhone(phone);

    const user = await prisma.user.findFirst({
      where: { phone_number: normalized },
    });

    const invalid = () => reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid phone number or PIN',
    });

    if (!user || !user.is_active || !user.pin_hash) {
      server.log.warn({ ip: clientIp, reason: 'FIELD_USER_NOT_FOUND' }, 'Security Audit: Failed field login');
      return invalid();
    }

    // Per-account PIN lockout (independent of IP rate limiting)
    if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      reply.header('Retry-After', Math.ceil((new Date(user.pin_locked_until).getTime() - Date.now()) / 1000));
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Too many failed PIN attempts. Try again later.',
      });
    }

    const pinOk = await verifyPassword(pin, user.pin_hash);
    if (!pinOk) {
      const attempts = user.pin_failed_attempts + 1;
      const lock = attempts >= 5;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          pin_failed_attempts: lock ? 0 : attempts,
          pin_locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      server.log.warn({ ip: clientIp, userId: user.id, reason: 'INVALID_PIN', attempts }, 'Security Audit: Failed field login');
      return invalid();
    }

    if (user.pin_failed_attempts > 0 || user.pin_locked_until) {
      await prisma.user.update({
        where: { id: user.id },
        data: { pin_failed_attempts: 0, pin_locked_until: null },
      });
    }

    // Field accounts are phone-verified at invite-accept; the standard
    // verification gate still applies for any account lacking both.
    if (!user.email_verified_at && !user.phone_verified_at) {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'ACCOUNT_NOT_VERIFIED',
        message: 'This account is not verified — ask your company administrator to activate it.',
      });
    }

    const session = await issueSessionForUser(server, reply, user);
    if ('__error' in session) {
      return reply.status(session.__error.status).send({
        error: 'Forbidden',
        message: session.__error.message,
      });
    }
    return reply.status(200).send(session.response);
  };

  // POST /api/v1/auth/field-login — phone + PIN sign-in for field roles
  // (FOREMAN, WORKER, SITE_ENGINEER, TRADE_LEAD). PINs are stored hashed;
  // failed attempts lock the account PIN for 15 minutes after 5 failures,
  // independent of the password lockout.
  server.post('/api/v1/auth/field-login', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, handleFieldLogin);

  // POST /api/v1/auth/register-company
  // Self-serve tenant onboarding: creates tenant + first COMPANY_ADMIN user +
  // membership atomically. The account is NOT usable until the email is
  // verified (or an admin activates it) — see the login verification gate.
  server.post(
    '/api/v1/auth/register-company',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parseResult = RegisterCompanySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid registration payload',
          details: parseResult.error.flatten(),
        });
      }

      const { companyName, adminFullName, email, phone, password } = parseResult.data;
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'An account with this email already exists',
        });
      }

      const baseSlug = slugify(companyName) || 'company';
      let slug = baseSlug;
      for (let i = 2; ; i++) {
        const clash = await prisma.tenant.findUnique({ where: { slug } });
        if (!clash) break;
        slug = `${baseSlug}-${i}`.slice(0, 100);
      }

      const passwordHash = await hashPassword(password);

      const created = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: companyName.trim(), slug, currency: 'KES' },
        });
        // Bind tenant context so RLS-covered inserts (memberships, audit_logs)
        // pass the tenant check inside this same transaction.
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, TRUE)`;
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password_hash: passwordHash,
            full_name: adminFullName.trim(),
            phone_number: phone && phone.trim() ? phone.trim() : null,
            country: 'Kenya',
            // Pilot behaviour: outside production, self-serve sign-up is
            // treated as verified (delivery is simulated). In production the
            // account stays PENDING until a provider confirms or an operator
            // activates it (docs/DEPLOY.md §7).
            ...(process.env.NODE_ENV === 'development'
              ? {
                  email_verified_at: new Date(),
                  ...(phone && phone.trim() ? { phone_verified_at: new Date() } : {}),
                }
              : {}),
          },
        });
        const membership = await tx.membership.create({
          data: { tenant_id: tenant.id, user_id: user.id, role: 'COMPANY_ADMIN' },
        });
        await recordAuditLog(tx, {
          tenantId: tenant.id,
          actorId: user.id,
          action: 'COMPANY_REGISTERED',
          entityType: 'Tenant',
          entityId: tenant.id,
          changes: {
            companyName: companyName.trim(),
            slug,
            adminEmail: normalizedEmail,
            verification: 'PENDING — email/phone verification provider not yet configured',
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
        return { tenant, user, membership };
      });

      // Issue the single-use verification token. Email delivery is simulated
      // for the pilot, so the raw token is returned outside production.
      const verificationToken = await issueEmailVerificationToken(created.user.id);

      return reply.status(201).send({
        data: {
          tenant: {
            id: created.tenant.id,
            name: created.tenant.name,
            slug: created.tenant.slug,
            currency: created.tenant.currency,
          },
          user: {
            id: created.user.id,
            email: created.user.email,
            fullName: created.user.full_name,
            role: created.membership.role,
          },
          verification: {
            email: 'PENDING',
            phone: 'PENDING',
            note: 'Verify your email address before signing in, or ask your administrator to activate the account.',
          },
          ...(process.env.NODE_ENV !== 'production' ? { verificationToken } : {}),
        },
      });
    },
  );

  // POST /api/v1/auth/verify-email — consume a single-use verification token.
  server.post(
    '/api/v1/auth/verify-email',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parseResult = VerifyEmailSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid verification payload',
          details: parseResult.error.flatten(),
        });
      }
      const result = await consumeEmailVerificationToken(parseResult.data.token);
      if (result === 'ok') {
        return reply.status(200).send({ data: { verified: true } });
      }
      if (result === 'expired') {
        return reply.status(410).send({ error: 'Gone', message: 'This verification link has expired' });
      }
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid or already used verification link' });
    },
  );

  // POST /api/v1/auth/request-password-reset — self-serve reset request.
  // Always returns the same shape so the endpoint cannot enumerate accounts.
  // Email delivery is simulated; outside production the raw token is returned
  // so the flow is exercisable before a provider is configured.
  server.post(
    '/api/v1/auth/request-password-reset',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parseResult = RequestPasswordResetSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid reset request payload',
          details: parseResult.error.flatten(),
        });
      }

      const email = parseResult.data.email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email } });

      let resetToken: string | null = null;
      let resetUrl: string | null = null;
      if (user && user.is_active) {
        // The token is tenant-scoped for RLS; use the user's first membership.
        const membershipRows = await prisma.$queryRaw<{ tenant_id: string }[]>`
          SELECT tenant_id FROM lookup_user_memberships_for_login(${user.id}::uuid) LIMIT 1;
        `;
        const tenantId = membershipRows[0]?.tenant_id;
        if (tenantId) {
          resetToken = await issuePasswordResetToken(user.id, tenantId);
          resetUrl = passwordResetUrl(resetToken);
        }
      }

      return reply.status(200).send({
        data: {
          ok: true,
          // Simulated delivery: expose the link only outside production.
          ...(process.env.NODE_ENV !== 'production' && resetToken
            ? { resetToken, resetUrl }
            : {}),
        },
      });
    },
  );

  // POST /api/v1/auth/reset-password — consume a single-use reset token.
  server.post(
    '/api/v1/auth/reset-password',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parseResult = ResetPasswordSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid reset payload',
          details: parseResult.error.flatten(),
        });
      }

      const row = await lookupPasswordResetToken(parseResult.data.token);
      if (!row || row.used_at) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid or already used reset link' });
      }
      if (row.expires_at < new Date()) {
        return reply.status(410).send({ error: 'Gone', message: 'This reset link has expired' });
      }

      const passwordHash = await hashPassword(parseResult.data.password);

      // Consume atomically: a concurrent replay sees used_at already set.
      const consumed = await withTenantTx(prisma, row.tenant_id, async (tx) => {
        const res = await tx.passwordResetToken.updateMany({
          where: { id: row.id, used_at: null },
          data: { used_at: new Date() },
        });
        if (res.count === 0) return false;
        await tx.user.update({ where: { id: row.user_id }, data: { password_hash: passwordHash } });
        await tx.refreshToken.deleteMany({ where: { user_id: row.user_id, tenant_id: row.tenant_id } });
        await recordAuditLog(tx, {
          tenantId: row.tenant_id,
          actorId: row.user_id,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: row.user_id,
          changes: { via: 'self-serve token' },
        });
        return true;
      });
      if (!consumed) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid or already used reset link' });
      }

      // Revoke refresh sessions in the user's other tenants too.
      const memberships = await prisma.$queryRaw<{ tenant_id: string }[]>`
        SELECT tenant_id FROM lookup_user_memberships_for_login(${row.user_id}::uuid);
      `;
      for (const m of memberships) {
        if (m.tenant_id === row.tenant_id) continue;
        await withTenantTx(prisma, m.tenant_id, (tx) =>
          tx.refreshToken.deleteMany({ where: { user_id: row.user_id, tenant_id: m.tenant_id } }),
        );
      }

      return reply.status(200).send({ data: { ok: true } });
    },
  );

  // POST /api/v1/auth/logout
  // List the caller's active refresh sessions (audit S-01 self-service).
  server.get('/api/v1/auth/sessions', { preHandler: [server.authenticate] }, async (request, reply) => {
    const access = request.cookies?.access_token
      ?? request.headers.authorization?.replace(/^Bearer /, '');
    if (!access) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No session' });
    }
    let payload: any;
    try { payload = server.jwt.verify(access); } catch {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
    }
    const refresh = request.cookies?.refresh_token;
    let currentJti: string | null = null;
    if (refresh) {
      try { currentJti = (server.jwt.verify(refresh) as any)?.jti ?? null; } catch { /* ignore */ }
    }
    const rows = await withTenantTx(prisma, payload.tenantId, (tx) =>
      tx.refreshToken.findMany({
        where: { user_id: payload.sub, tenant_id: payload.tenantId, expires_at: { gt: new Date() } },
        orderBy: { created_at: 'desc' },
        select: { jti: true, created_at: true, expires_at: true },
      }),
    );
    return reply.send({
      data: rows.map((r) => ({
        id: r.jti.slice(0, 8),
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        current: r.jti === currentJti,
      })),
    });
  });

  // Revoke one session by jti prefix, or all others via ?all=others.
  server.delete('/api/v1/auth/sessions/:id', { preHandler: [server.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const access = request.cookies?.access_token
      ?? request.headers.authorization?.replace(/^Bearer /, '');
    if (!access) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No session' });
    }
    let payload: any;
    try { payload = server.jwt.verify(access); } catch {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
    }
    const refresh = request.cookies?.refresh_token;
    let currentJti: string | null = null;
    if (refresh) {
      try { currentJti = (server.jwt.verify(refresh) as any)?.jti ?? null; } catch { /* ignore */ }
    }
    const result = await withTenantTx(prisma, payload.tenantId, async (tx) => {
      if (id === 'others') {
        return tx.refreshToken.deleteMany({
          where: {
            user_id: payload.sub, tenant_id: payload.tenantId,
            ...(currentJti ? { jti: { not: currentJti } } : {}),
          },
        });
      }
      // jti prefix match (ids are exposed truncated)
      const rows = await tx.refreshToken.findMany({
        where: { user_id: payload.sub, tenant_id: payload.tenantId },
        select: { jti: true },
      });
      const match = rows.find((r) => r.jti.startsWith(id));
      if (!match) return { count: 0 };
      if (match.jti === currentJti) {
        throw { status: 400, message: 'Cannot revoke your current session — use sign out' };
      }
      return tx.refreshToken.delete({ where: { jti: match.jti } });
    });
    return reply.send({ data: { revoked: (result as any).count ?? 1 } });
  });

  server.post('/api/v1/auth/logout', async (request, reply) => {
    // Revoke refresh tokens when we can identify the session (best-effort).
    const access = request.cookies?.access_token;
    if (access) {
      try {
        const p = server.jwt.verify(access) as any;
        if (p?.sub && p?.tenantId) {
          await withTenantTx(prisma, p.tenantId, (tx) =>
            tx.refreshToken.deleteMany({ where: { user_id: p.sub, tenant_id: p.tenantId } }),
          );
        }
      } catch { /* expired/invalid token — cookies still cleared */ }
    }
    clearSessionCookies(reply);
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  // POST /api/v1/auth/refresh — rotate the refresh token and issue a new pair
  server.post('/api/v1/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Missing refresh token' });
    }
    let payload: any;
    try {
      payload = server.jwt.verify(refreshToken);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }
    if (payload.typ !== 'refresh' || !payload.sub || !payload.tenantId || !payload.jti) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }

    // Rotation + reuse detection: the presented jti must exist unconsumed.
    // A missing row means the token was already rotated (theft/replay) or never
    // issued — revoke the whole family and force re-login.
    const consumed = await withTenantTx(prisma, payload.tenantId, (tx) =>
      tx.refreshToken.deleteMany({
        where: { jti: payload.jti, user_id: payload.sub, tenant_id: payload.tenantId },
      }),
    );
    if (consumed.count === 0) {
      await withTenantTx(prisma, payload.tenantId, (tx) =>
        tx.refreshToken.deleteMany({ where: { user_id: payload.sub, tenant_id: payload.tenantId } }),
      );
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Unauthorized', message: 'Refresh token already used or revoked' });
    }
    // Opportunistic cleanup of expired rows for this user.
    await withTenantTx(prisma, payload.tenantId, (tx) =>
      tx.refreshToken.deleteMany({
        where: { user_id: payload.sub, tenant_id: payload.tenantId, expires_at: { lt: new Date() } },
      }),
    );

    const membership = await withTenantTx(prisma, payload.tenantId, async (tx) => {
      const m = await tx.membership.findFirst({
        where: { tenant_id: payload.tenantId, user_id: payload.sub },
        include: { user: { select: { is_active: true, email: true, full_name: true } }, tenant: true },
      });
      return m;
    });
    if (!membership || !membership.user.is_active) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Unauthorized', message: 'Session revoked' });
    }

    const token = server.jwt.sign(
      {
        sub: membership.user_id ?? payload.sub,
        email: membership.user.email,
        fullName: membership.user.full_name,
        tenantId: payload.tenantId,
        role: membership.role,
        typ: 'access',
      },
      { expiresIn: ACCESS_TTL },
    );
    const newJti = crypto.randomUUID();
    const newRefresh = server.jwt.sign(
      {
        sub: payload.sub,
        email: membership.user.email,
        fullName: membership.user.full_name,
        tenantId: payload.tenantId,
        role: membership.role,
        typ: 'refresh',
        jti: newJti,
      },
      { expiresIn: REFRESH_TTL },
    );
    await withTenantTx(prisma, payload.tenantId, (tx) =>
      tx.refreshToken.create({
        data: {
          jti: newJti,
          tenant_id: payload.tenantId,
          user_id: payload.sub,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    );
    setSessionCookies(reply, token, newRefresh);
    return reply.status(200).send({ success: true });
  });

  // GET /api/v1/auth/me
  server.get(
    '/api/v1/auth/me',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const userPayload = request.user;

      const user = await withTenantTx(prisma, userPayload.tenantId, async (tx) => {
        return tx.user.findUnique({
          where: { id: userPayload.sub },
          include: {
            memberships: {
              where: { tenant_id: userPayload.tenantId },
              include: {
                tenant: true,
              },
            },
          },
        });
      });

      const activeMembership = user?.memberships[0];
      if (!user || !user.is_active || !activeMembership) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User session is inactive or revoked',
        });
      }

      const permissions = getPermissionsForRole(activeMembership.role as Role);

      const response: AuthUserResponse = {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          role: activeMembership.role,
          tenant: {
            id: activeMembership.tenant.id,
            name: activeMembership.tenant.name,
            slug: activeMembership.tenant.slug,
            currency: activeMembership.tenant.currency,
          },
        },
        permissions: [...permissions],
        token: request.headers.authorization?.replace(/^Bearer\s+/i, '') || '',
      };

      return reply.status(200).send(response);
    },
  );

  // PATCH /api/v1/auth/me — profile self-service (name, phone, country)
  server.patch(
    '/api/v1/auth/me',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const body = (request.body || {}) as { fullName?: string; phoneNumber?: string | null; country?: string | null };
      const data: Record<string, unknown> = {};
      if (typeof body.fullName === 'string' && body.fullName.trim()) data.full_name = body.fullName.trim().slice(0, 255);
      if (body.phoneNumber !== undefined) data.phone_number = body.phoneNumber ? String(body.phoneNumber).slice(0, 30) : null;
      if (body.country !== undefined) data.country = body.country ? String(body.country).slice(0, 60) : null;
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No updatable fields provided' });
      }
      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) =>
          tx.user.update({ where: { id: sub }, data }),
        );
        return reply.status(200).send({ data: { id: updated.id, fullName: updated.full_name, phoneNumber: updated.phone_number, country: updated.country } });
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update profile' });
      }
    },
  );
};
