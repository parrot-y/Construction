import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { getTaxSettings } from '../lib/tax';
import { issuePasswordResetToken, passwordResetUrl } from '../lib/accountTokens';
import { TaxSettingsSchema, UpdateCompanySettingsSchema } from '@construction/validation';
import { Permissions, Roles } from '@construction/permissions';
import { toDecimal, Decimal } from '@construction/money';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../plugins/rbac';
import { listParams, listPage } from '../lib/pagination';

export const companyRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /api/v1/company - Get company profile
  server.get(
    '/api/v1/company',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Not Found', message: 'Company tenant not found' });
      }

      return reply.status(200).send({ data: tenant });
    },
  );


  // GET /api/v1/company/modules — enabled non-core module flags for this
  // tenant (B1). Any authenticated member may read; writes are operator-only.
  server.get(
    '/api/v1/company/modules',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const flags = await withTenantTx(prisma, tenantId, (tx) =>
        tx.tenantModuleFlag.findMany({ where: { tenant_id: tenantId, enabled: true }, select: { module: true } }),
      );
      return reply.status(200).send({ data: { modules: flags.map((f) => f.module) } });
    },
  );

  // GET /api/v1/company/payment-instructions - Where clients/owners should pay
  // (paybill, till, bank). Any authenticated member may read it — clients need
  // it to pay; it contains no internal data.
  server.get(
    '/api/v1/company/payment-instructions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { payment_instructions: true, currency: true, name: true },
      });
      return reply.status(200).send({
        data: {
          paymentInstructions: tenant?.payment_instructions ?? null,
          currency: tenant?.currency ?? 'KES',
          companyName: tenant?.name ?? null,
        },
      });
    },
  );

  // GET /api/v1/company/settings - Get company settings (Admin only)
  server.get(
    '/api/v1/company/settings',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId } = request.user;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      return reply.status(200).send({ data: tenant });
    },
  );

  // PATCH /api/v1/company/settings - Tenant-facing terms (retention, payment
  // instructions). Stage-2: replaces hard-coded client-dashboard values.
  server.patch(
    '/api/v1/company/settings',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = UpdateCompanySettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid company settings', details: parsed.error.flatten() });
      }
      const d = parsed.data;
      const data: Record<string, unknown> = {};
      if (d.retentionTerms !== undefined) data.retention_terms = d.retentionTerms;
      if (d.paymentInstructions !== undefined) data.payment_instructions = d.paymentInstructions;
      if (d.fxRates !== undefined) data.fx_rates = d.fxRates;
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No settings provided' });
      }

      const updated = await withTenantTx(prisma, tenantId, async (tx) => {
        const tenant = await tx.tenant.update({ where: { id: tenantId }, data });
        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'COMPANY_SETTINGS_UPDATED',
          entityType: 'Tenant',
          entityId: tenantId,
          changes: data,
        });
        return tenant;
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // PATCH /api/v1/company - Update company details (Admin only)
  server.patch(
    '/api/v1/company',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const body = request.body as { name?: string; kra_pin?: string; nca_category?: string };

      const updated = await withTenantTx(prisma, tenantId, async (tx) => {
        const tenant = await tx.tenant.update({
          where: { id: tenantId },
          data: {
            name: body.name,
            kra_pin: body.kra_pin,
            nca_category: body.nca_category,
          },
        });

        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'COMPANY_SETTINGS_UPDATED',
          entityType: 'Tenant',
          entityId: tenantId,
          changes: body,
        });

        return tenant;
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // GET /api/v1/company/members - List team members
  server.get(
    '/api/v1/company/members',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const pg = listParams(request);

      const members = await withTenantTx(prisma, tenantId, async (tx) => {
        return tx.membership.findMany({
          include: {
            user: {
              select: {
                id: true,
                email: true,
                full_name: true,
                phone_number: true,
                is_active: true,
                email_verified_at: true,
                phone_verified_at: true,
                created_at: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
          skip: pg.skip,
          take: pg.limit + 1,
        });
      });

      const pagedMembers = listPage(members, pg);
      const formatted = pagedMembers.data.map((m) => ({
        membershipId: m.id,
        role: m.role,
        coApprovalLimit: m.co_approval_limit ? m.co_approval_limit.toFixed(2) : null,
        joinedAt: m.created_at,
        user: m.user,
        verificationPending: !m.user.email_verified_at && !m.user.phone_verified_at,
      }));

      return reply.status(200).send({ data: formatted, page: pagedMembers.page });
    },
  );

  // PATCH /api/v1/company/members/:membershipId/co-approval-limit - ADR-010
  // Sets the max |net_amount| (KES) a member may finally approve on a change
  // order. Body: { limit: number | null } — null clears the limit.
  server.patch(
    '/api/v1/company/members/:membershipId/co-approval-limit',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { membershipId } = request.params as { membershipId: string };
      const body = (request.body || {}) as { limit?: number | string | null };

      const raw = body.limit;
      let limitValue: string | null = null;
      if (raw !== null && raw !== undefined) {
        let parsed;
        try {
          parsed = toDecimal(typeof raw === 'number' ? String(raw) : raw);
        } catch {
          parsed = null;
        }
        if (!parsed || !parsed.isFinite() || parsed.isNegative()) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Approval limit must be a non-negative number or null',
          });
        }
        limitValue = parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const target = await tx.membership.findUnique({
            where: { id: membershipId },
            include: { user: { select: { email: true } } },
          });

          if (!target || target.tenant_id !== tenantId) {
            throw { status: 404, message: 'Membership not found' };
          }

          const updated = await tx.membership.update({
            where: { id: membershipId },
            data: { co_approval_limit: limitValue },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'MEMBER_CO_APPROVAL_LIMIT_SET',
            entityType: 'Membership',
            entityId: membershipId,
            changes: {
              userEmail: target.user.email,
              role: target.role,
              previousLimit: target.co_approval_limit?.toString() ?? null,
              newLimit: limitValue,
            },
          });

          return {
            membershipId: updated.id,
            role: updated.role,
            coApprovalLimit: updated.co_approval_limit ? updated.co_approval_limit.toFixed(2) : null,
          };
        });

        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to update CO approval limit');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to update CO approval limit',
        });
      }
    },
  );

  // PATCH /api/v1/company/members/:membershipId/role - Change member role
  server.patch(
    '/api/v1/company/members/:membershipId/role',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { membershipId } = request.params as { membershipId: string };
      const body = (request.body || {}) as { role?: string };
      const newRole = (body.role || '').toUpperCase();

      const validRoles = Object.values(Roles) as string[];
      if (!validRoles.includes(newRole)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid role. Allowed: ${validRoles.join(', ')}`,
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const target = await tx.membership.findUnique({
            where: { id: membershipId },
            include: { user: { select: { email: true } } },
          });

          if (!target || target.tenant_id !== tenantId) {
            throw { status: 404, message: 'Membership not found' };
          }

          const wasAdmin = target.role === 'ADMIN' || target.role === 'COMPANY_ADMIN';
          const willBeAdmin = newRole === 'ADMIN' || newRole === 'COMPANY_ADMIN';

          if (wasAdmin && !willBeAdmin) {
            const adminCount = await tx.membership.count({
              where: { tenant_id: tenantId, role: { in: ['ADMIN', 'COMPANY_ADMIN'] } },
            });
            if (adminCount <= 1) {
              throw { status: 400, message: 'Cannot demote the only company admin' };
            }
          }

          const updated = await tx.membership.update({
            where: { id: membershipId },
            data: { role: newRole },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'MEMBER_ROLE_CHANGED',
            entityType: 'Membership',
            entityId: membershipId,
            changes: { userEmail: target.user.email, previousRole: target.role, newRole },
          });

          return { membershipId: updated.id, role: updated.role };
        });

        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to update member role');
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update member role' });
      }
    },
  );

  // DELETE /api/v1/company/members/:membershipId - Revoke company access
  server.delete(
    '/api/v1/company/members/:membershipId',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { membershipId } = request.params as { membershipId: string };

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const target = await tx.membership.findUnique({
            where: { id: membershipId },
            include: { user: true },
          });

          if (!target || target.tenant_id !== tenantId) {
            throw { status: 404, message: 'Membership not found' };
          }

          // Prevent removing the last admin in the company
          if (target.role === 'ADMIN' || target.role === 'COMPANY_ADMIN') {
            const adminCount = await tx.membership.count({
              where: {
                tenant_id: tenantId,
                role: { in: ['ADMIN', 'COMPANY_ADMIN'] },
              },
            });

            if (adminCount <= 1) {
              throw { status: 400, message: 'Cannot revoke membership of the only company admin' };
            }
          }

          await tx.membership.delete({
            where: { id: membershipId },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'MEMBER_REVOKED',
            entityType: 'Membership',
            entityId: membershipId,
            changes: { userEmail: target.user.email, role: target.role },
          });

          return { success: true, message: `Access revoked for ${target.user.email}` };
        });

        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err, 'Failed to revoke membership');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to revoke membership',
        });
      }
    },
  );

  // POST /api/v1/company/members/:userId/password-reset — admin-assisted
  // reset: mints a one-time reset link the admin copies and sends to the
  // member out-of-band (email delivery is simulated for the pilot).
  server.post(
    '/api/v1/company/members/:userId/password-reset',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { userId } = request.params as { userId: string };

      const membership = await withTenantTx(prisma, tenantId, (tx) =>
        tx.membership.findFirst({
          where: { tenant_id: tenantId, user_id: userId },
          include: { user: { select: { id: true, email: true, is_active: true } } },
        }),
      );
      if (!membership) {
        return reply.status(404).send({ error: 'Not Found', message: 'Member not found in this company' });
      }
      if (!membership.user.is_active) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Cannot issue a reset link for a deactivated account' });
      }

      const token = await issuePasswordResetToken(userId, tenantId, sub);
      await withTenantTx(prisma, tenantId, (tx) =>
        recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'MEMBER_PASSWORD_RESET_LINK_GENERATED',
          entityType: 'User',
          entityId: userId,
          changes: { memberEmail: membership.user.email },
        }),
      );

      return reply.status(201).send({
        data: {
          resetUrl: passwordResetUrl(token),
          expiresInMinutes: 30,
          memberEmail: membership.user.email,
        },
      });
    },
  );

  // POST /api/v1/company/members/:userId/activate — admin-approved activation
  // for accounts whose email/phone verification cannot complete yet (pilot
  // path while delivery providers are unconfigured).
  server.post(
    '/api/v1/company/members/:userId/activate',
    {
      preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { userId } = request.params as { userId: string };

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const membership = await tx.membership.findFirst({
            where: { tenant_id: tenantId, user_id: userId },
            include: { user: { select: { id: true, email: true, email_verified_at: true, phone_verified_at: true } } },
          });
          if (!membership) throw { status: 404, message: 'Member not found in this company' };

          const alreadyVerified = !!(membership.user.email_verified_at || membership.user.phone_verified_at);
          if (!alreadyVerified) {
            await tx.user.update({
              where: { id: userId },
              data: { email_verified_at: new Date() },
            });
          }
          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'MEMBER_ACTIVATED',
            entityType: 'User',
            entityId: userId,
            changes: { memberEmail: membership.user.email, alreadyVerified },
          });
          return { activated: true, alreadyVerified, memberEmail: membership.user.email };
        });
        return reply.status(200).send({ data: result });
      } catch (err: any) {
        if (err?.status) {
          return reply.status(err.status).send({ error: 'Not Found', message: err.message });
        }
        throw err;
      }
    },
  );

  // GET /api/v1/company/tax-settings - Central tenant tax configuration
  server.get(
    '/api/v1/company/tax-settings',
    { preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const settings = await withTenantTx(prisma, tenantId, async (tx) => getTaxSettings(tx, tenantId));
      return reply.status(200).send({
        data: {
          vatPct: settings.vatPct.toFixed(2),
          whtContractorPct: settings.whtContractorPct.toFixed(2),
          whtSubcontractorPct: settings.whtSubcontractorPct.toFixed(2),
          whtConsultantPct: settings.whtConsultantPct.toFixed(2),
          whtSupplierPct: settings.whtSupplierPct.toFixed(2),
          whvatPct: settings.whvatPct.toFixed(2),
        },
      });
    },
  );

  // PUT /api/v1/company/tax-settings - Update tenant tax configuration
  server.put(
    '/api/v1/company/tax-settings',
    { preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const parsed = TaxSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid tax settings', details: parsed.error.flatten() });
      }
      const d = parsed.data;
      const data: Record<string, string> = {};
      if (d.vatPct !== undefined) data.vat_pct = d.vatPct;
      if (d.whtContractorPct !== undefined) data.wht_contractor_pct = d.whtContractorPct;
      if (d.whtSubcontractorPct !== undefined) data.wht_subcontractor_pct = d.whtSubcontractorPct;
      if (d.whtConsultantPct !== undefined) data.wht_consultant_pct = d.whtConsultantPct;
      if (d.whtSupplierPct !== undefined) data.wht_supplier_pct = d.whtSupplierPct;
      if (d.whvatPct !== undefined) data.whvat_pct = d.whvatPct;
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No tax settings provided' });
      }

      const updated = await withTenantTx(prisma, tenantId, async (tx) => {
        const row = await tx.tenantTaxSetting.upsert({
          where: { tenant_id: tenantId },
          update: { ...data, updated_by: sub },
          create: { tenant_id: tenantId, ...data, updated_by: sub },
        });
        await recordAuditLog(tx, {
          tenantId,
          actorId: sub,
          action: 'TAX_SETTINGS_UPDATED',
          entityType: 'TenantTaxSetting',
          entityId: tenantId,
          changes: data,
        });
        return row;
      });

      const settings = await withTenantTx(prisma, tenantId, async (tx) => getTaxSettings(tx, tenantId));
      void updated;
      return reply.status(200).send({
        data: {
          vatPct: settings.vatPct.toFixed(2),
          whtContractorPct: settings.whtContractorPct.toFixed(2),
          whtSubcontractorPct: settings.whtSubcontractorPct.toFixed(2),
          whtConsultantPct: settings.whtConsultantPct.toFixed(2),
          whtSupplierPct: settings.whtSupplierPct.toFixed(2),
          whvatPct: settings.whvatPct.toFixed(2),
        },
      });
    },
  );

  // GET /api/v1/company/export — COMPANY_ADMIN-only data export.
  // ?format=json (default): full tenant export. ?format=csv&entity=<name>:
  // flat CSV of one entity. Every export is audit-logged.
  server.get(
    '/api/v1/company/export',
    { preHandler: [server.authenticate, requirePermission(Permissions.COMPANY_MANAGE)] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      if (role !== 'COMPANY_ADMIN' && role !== 'ADMIN') {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Company admin role required' });
      }
      const { format = 'json', entity } = request.query as { format?: string; entity?: string };

      const CSV_ENTITIES: Record<string, { model: string; fields: string[] }> = {
        projects: { model: 'project', fields: ['id', 'code', 'name', 'status', 'client_name', 'site_location', 'original_contract_sum', 'current_approved_budget', 'start_date', 'target_end_date', 'created_at'] },
        members: { model: 'membership', fields: ['id', 'role', 'created_at'] },
        invoices: { model: 'invoice', fields: ['id', 'invoice_no', 'title', 'status', 'client_name', 'currency', 'subtotal', 'tax', 'total', 'amount_paid', 'issue_date', 'due_date', 'created_at'] },
        quotes: { model: 'quote', fields: ['id', 'quote_no', 'title', 'status', 'client_name', 'client_email', 'currency', 'total', 'valid_until', 'created_at'] },
        'cost-entries': { model: 'costEntry', fields: ['id', 'project_id', 'cost_category', 'description', 'amount', 'status', 'entry_date', 'created_at'] },
        'site-diaries': { model: 'siteDiary', fields: ['id', 'project_id', 'entry_date', 'weather', 'site_status', 'general_notes', 'created_at'] },
        'payment-certificates': { model: 'paymentCertificate', fields: ['id', 'project_id', 'certificate_no', 'status', 'gross_amount', 'retention_amount', 'net_payable', 'certificate_date', 'created_at'] },
        documents: { model: 'companyDocument', fields: ['id', 'title', 'category', 'reference_no', 'issuer', 'expiry_date', 'status', 'created_at'] },
      };

      const esc = (v: unknown) => {
        if (v === null || v === undefined) return '';
        const str = v instanceof Date ? v.toISOString() : String(v);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };

      try {
        if (format === 'csv') {
          const cfg = entity ? CSV_ENTITIES[entity] : undefined;
          if (!cfg) {
            return reply.status(400).send({
              statusCode: 400, error: 'Bad Request',
              message: `entity required for CSV export. One of: ${Object.keys(CSV_ENTITIES).join(', ')}`,
            });
          }
          const rows: any[] = await withTenantTx(prisma, tenantId, async (tx) => {
            const delegate = (tx as any)[cfg.model];
            if (cfg.model === 'membership') {
              return delegate.findMany({
                where: { tenant_id: tenantId },
                include: { user: { select: { email: true, full_name: true, phone_number: true } } },
                orderBy: { created_at: 'asc' },
              }).then((ms: any[]) => ms.map((m) => ({
                id: m.id, role: m.role, created_at: m.created_at,
                email: m.user?.email, full_name: m.user?.full_name, phone: m.user?.phone_number,
              })));
            }
            if (cfg.model === 'companyDocument') {
              return delegate.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } });
            }
            return delegate.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } });
          });

          const headers = cfg.model === 'membership'
            ? ['id', 'role', 'email', 'full_name', 'phone', 'created_at']
            : cfg.fields;
          const csvRows = [headers.join(',')];
          for (const r of rows) {
            csvRows.push(headers.map((h) => esc((r as any)[h])).join(','));
          }
          await withTenantTx(prisma, tenantId, (tx) => recordAuditLog(tx, {
            tenantId, actorId: sub, action: 'COMPANY_DATA_EXPORTED',
            entityType: 'Tenant', entityId: tenantId,
            changes: { format: 'csv', entity },
          }));
          reply.header('content-type', 'text/csv; charset=utf-8');
          reply.header('content-disposition', `attachment; filename="${entity}-export.csv"`);
          return reply.status(200).send(csvRows.join('\n'));
        }

        // JSON full export
        const data = await withTenantTx(prisma, tenantId, async (tx) => {
          const [tenant, memberships, projects, invoices, quotes, costEntries, diaries, certificates, documents] = await Promise.all([
            tx.tenant.findUnique({ where: { id: tenantId } }),
            tx.membership.findMany({
              where: { tenant_id: tenantId },
              include: { user: { select: { id: true, email: true, full_name: true, phone_number: true, is_active: true, created_at: true } } },
            }),
            tx.project.findMany({ include: { members: { include: { user: { select: { id: true, full_name: true, email: true } } } } } }),
            tx.invoice.findMany({ include: { items: true, payments: true } }),
            tx.quote.findMany({ include: { items: true } }),
            tx.costEntry.findMany(),
            tx.siteDiary.findMany({ include: { labor_headcounts: true, deliveries: true, photos: true } }),
            tx.paymentCertificate.findMany({ include: { lines: true } }),
            tx.companyDocument.findMany(),
          ]);
          return { tenant, memberships, projects, invoices, quotes, costEntries, diaries, certificates, documents };
        });
        await withTenantTx(prisma, tenantId, (tx) => recordAuditLog(tx, {
          tenantId, actorId: sub, action: 'COMPANY_DATA_EXPORTED',
          entityType: 'Tenant', entityId: tenantId,
          changes: { format: 'json' },
        }));
        reply.header('content-type', 'application/json; charset=utf-8');
        reply.header('content-disposition', 'attachment; filename="company-export.json"');
        return reply.status(200).send(JSON.stringify({
          exportedAt: new Date().toISOString(),
          tenantId,
          ...data,
        }, null, 2));
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to export company data' });
      }
    },
  );
};
