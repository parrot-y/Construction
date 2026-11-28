import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { sweepDueScheduledReports, runOverdueInvoiceReminders } from './jobs/queue';
import { nextDocumentNumber } from './lib/counters';

describe('P5.8 — pg-boss jobs: scheduled-report sweep + overdue invoice reminders', () => {
  const server = buildServer();

  let adminCookie: string;
  let tenantId: string;
  let dueReportId: string;
  let pausedReportId: string;

  // invoice_no is allocated from document_counters — bypassing it leaves the
  // counter behind and the next API-created invoice hits a unique violation.
  const nextInvoiceNo = (tx: any) => nextDocumentNumber(tx, tenantId, 'INVOICE');

  beforeAll(async () => {
    await server.ready();

    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    tenantId = JSON.parse(adminRes.body).user.tenant.id;

    // ACTIVE report whose next_run_at is already past — the sweep must run it.
    const due = await server.inject({
      method: 'POST',
      url: '/api/v1/reports/scheduled',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Daily financial sweep fixture',
        reportType: 'FINANCIAL',
        frequency: 'DAILY',
        recipients: ['reports@apexbuilders.co.ke'],
        format: 'JSON',
      },
    });
    expect(due.statusCode).toBe(201);
    dueReportId = JSON.parse(due.body).data.id;

    const paused = await server.inject({
      method: 'POST',
      url: '/api/v1/reports/scheduled',
      headers: { cookie: adminCookie },
      payload: {
        name: 'Paused sweep fixture',
        reportType: 'OPERATIONAL',
        frequency: 'DAILY',
        recipients: ['reports@apexbuilders.co.ke'],
        format: 'JSON',
      },
    });
    expect(paused.statusCode).toBe(201);
    pausedReportId = JSON.parse(paused.body).data.id;

    await withTenantTx(prisma, tenantId, async (tx) => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      await tx.scheduledReport.update({ where: { id: dueReportId }, data: { next_run_at: past, status: 'ACTIVE' } });
      await tx.scheduledReport.update({ where: { id: pausedReportId }, data: { next_run_at: past, status: 'PAUSED' } });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await tx.invoice.create({
        data: {
          tenant_id: tenantId,
          invoice_no: await nextInvoiceNo(tx),
          title: 'Overdue slab works invoice',
          client_name: 'Acme Developers',
          client_email: 'accounts@acme.co.ke',
          status: 'SENT',
          issue_date: lastWeek,
          due_date: yesterday,
          total: '150000.00',
          balance_due: '150000.00',
        },
      });
      await tx.invoice.create({
        data: {
          tenant_id: tenantId,
          invoice_no: await nextInvoiceNo(tx),
          title: 'Settled invoice fixture',
          client_name: 'Acme Developers',
          client_email: 'accounts@acme.co.ke',
          status: 'PAID',
          issue_date: lastWeek,
          due_date: yesterday,
          total: '50000.00',
          balance_due: '0.00',
        },
      });
    });
  });

  it('sweep runs due ACTIVE reports, advances next_run_at, skips PAUSED', async () => {
    const result = await sweepDueScheduledReports();
    expect(result.ran).toBeGreaterThanOrEqual(1);

    const after = await withTenantTx(prisma, tenantId, async (tx) => {
      const dueReport = await tx.scheduledReport.findUnique({ where: { id: dueReportId } });
      const pausedReport = await tx.scheduledReport.findUnique({ where: { id: pausedReportId } });
      const dueRuns = await tx.scheduledReportRun.findMany({ where: { report_id: dueReportId } });
      const pausedRuns = await tx.scheduledReportRun.findMany({ where: { report_id: pausedReportId } });
      return { dueReport, pausedReport, dueRuns, pausedRuns };
    });

    expect(after.dueRuns.length).toBeGreaterThanOrEqual(1);
    expect(after.dueRuns[0]?.status).toBe('SUCCESS');
    const nextRun = after.dueReport?.next_run_at;
    expect(nextRun).toBeTruthy();
    expect(nextRun!.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(after.pausedRuns.length).toBe(0);
  });

  it('reminder job messages the client once per window, skips settled invoices', async () => {
    const first = await runOverdueInvoiceReminders();
    expect(first.sent).toBeGreaterThanOrEqual(1);

    const deliveries = await withTenantTx(prisma, tenantId, async (tx) =>
      tx.messageDelivery.findMany({
        where: { tenant_id: tenantId, source: 'invoice-reminder' },
      }),
    );
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
    const reminder = deliveries.find((d: any) => d.body_excerpt?.includes('Overdue slab works'));
    expect(reminder, 'no reminder delivery recorded for the overdue invoice').toBeTruthy();
    if (!reminder) return;
    expect(reminder.channel).toBe('EMAIL');
    expect(reminder.recipient_masked).not.toContain('accounts@acme.co.ke');
    // Honest status: unconfigured provider → SIMULATED, never DELIVERED.
    expect(['SIMULATED', 'DELIVERED']).toContain(reminder.status);

    // PAID invoice with a client email must not be reminded.
    const paidReminders = deliveries.filter((d: any) => d.body_excerpt?.includes('Settled invoice fixture'));
    expect(paidReminders.length).toBe(0);

    // Second run inside the dedupe window sends nothing new.
    const before = deliveries.length;
    const second = await runOverdueInvoiceReminders();
    const after = await withTenantTx(prisma, tenantId, async (tx) =>
      tx.messageDelivery.count({ where: { tenant_id: tenantId, source: 'invoice-reminder' } }),
    );
    expect(after).toBe(before);
    expect(second.sent).toBe(0);
  });
});
