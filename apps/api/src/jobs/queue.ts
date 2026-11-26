import { PgBoss } from 'pg-boss';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';
import { runScheduledReport } from '../lib/scheduledReportRunner';
import { dispatchNotification, normalizeKePhone } from '../integrations/messaging';
import { recordMessageDelivery } from '../lib/messageDeliveries';

/**
 * P5.8 — pg-boss job queue.
 *
 * Two recurring jobs keep slow/recurring work off the request path:
 *  - `scheduled-report-sweep` (every 5 min): runs ACTIVE scheduled reports
 *    whose next_run_at has passed, via the same runner as POST /run.
 *  - `invoice-reminders` (daily 06:00 UTC): reminds clients of overdue
 *    invoices over their configured channel; deduped per invoice for 72 h
 *    so a daily job does not spam.
 *
 * The job bodies are plain exported functions so tests can exercise them
 * without booting the queue; `startJobs` wires them to pg-boss cron.
 */

export const QUEUE_SWEEP = 'scheduled-report-sweep';
export const QUEUE_REMINDERS = 'invoice-reminders';

const SWEEP_CRON = '*/5 * * * *';
const REMINDER_CRON = '0 6 * * *';
const REMINDER_DEDUPE_MS = 72 * 60 * 60 * 1000;
const SWEEP_BATCH = 25;
const REMINDER_BATCH = 200;

let boss: PgBoss | null = null;

function getBoss(): PgBoss {
  if (!boss) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required for the job queue');
    // The pgboss schema is provisioned by migration 20261126130000 — the app
    // role must not try to CREATE SCHEMA (needs database-level CREATE).
    boss = new PgBoss({ connectionString, schema: 'pgboss', createSchema: false });
  }
  return boss;
}

async function listTenantIds(): Promise<Array<{ id: string; name: string }>> {
  // tenants is a documented RLS exception (identity resolution precedes
  // tenant context) — safe to enumerate for fan-out.
  return prisma.tenant.findMany({ select: { id: true, name: true } });
}

/** Runs every ACTIVE scheduled report whose next_run_at is due. */
export async function sweepDueScheduledReports(): Promise<{ ran: number; failed: number }> {
  let ran = 0;
  let failed = 0;
  for (const tenant of await listTenantIds()) {
    const due = await withTenantTx(prisma, tenant.id, (tx) =>
      tx.scheduledReport.findMany({
        where: { tenant_id: tenant.id, status: 'ACTIVE', next_run_at: { lte: new Date() } },
        orderBy: { next_run_at: 'asc' },
        take: SWEEP_BATCH,
        select: { id: true },
      }),
    );
    for (const report of due) {
      try {
        await runScheduledReport(tenant.id, report.id);
        ran += 1;
      } catch (err) {
        // runScheduledReport already records a FAILED ScheduledReportRun
        // when the report exists; a missing row means it was deleted mid-sweep.
        failed += 1;
        console.warn(`[jobs] scheduled report ${report.id} failed`, err);
      }
    }
  }
  return { ran, failed };
}

/**
 * Reminds clients of overdue invoices. Prefers email, falls back to SMS.
 * Each invoice is reminded at most once per REMINDER_DEDUPE_MS window —
 * repeat runs inside the window escalate nothing and send nothing.
 */
export async function runOverdueInvoiceReminders(): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  const dedupeSince = new Date(Date.now() - REMINDER_DEDUPE_MS);

  for (const tenant of await listTenantIds()) {
    const invoices = await withTenantTx(prisma, tenant.id, (tx) =>
      tx.invoice.findMany({
        where: {
          tenant_id: tenant.id,
          status: { in: ['SENT', 'PART_PAID', 'OVERDUE'] },
          due_date: { lt: new Date() },
          balance_due: { gt: 0 },
        },
        orderBy: { due_date: 'asc' },
        take: REMINDER_BATCH,
        select: {
          id: true, invoice_no: true, title: true, client_name: true,
          client_email: true, client_phone: true, balance_due: true,
          due_date: true, currency: true,
        },
      }),
    );

    for (const inv of invoices) {
      const marker = `invoice-${inv.invoice_no}]`;
      const recent = await withTenantTx(prisma, tenant.id, (tx) =>
        tx.messageDelivery.findFirst({
          where: {
            tenant_id: tenant.id,
            source: 'invoice-reminder',
            subject: { contains: marker },
            created_at: { gt: dedupeSince },
          },
          select: { id: true },
        }),
      );
      if (recent) {
        skipped += 1;
        continue;
      }

      const subject = `Payment reminder [${marker}`;
      const dueIso = inv.due_date ? inv.due_date.toISOString().slice(0, 10) : 'n/a';
      const body =
        `Dear ${inv.client_name},\n\n` +
        `This is a reminder that invoice #${inv.invoice_no} — ${inv.title} — ` +
        `had a balance of ${inv.currency} ${inv.balance_due} due on ${dueIso}.\n\n` +
        `Please arrange payment at your earliest convenience.\n\n` +
        `Regards,\n${tenant.name}`;

      if (inv.client_email) {
        const r = await dispatchNotification({ channel: 'EMAIL', to: inv.client_email, subject, body });
        await recordMessageDelivery(tenant.id, { channel: 'EMAIL', to: inv.client_email, subject, body, source: 'invoice-reminder' }, r);
        sent += 1;
      } else if (inv.client_phone) {
        const phone = normalizeKePhone(inv.client_phone);
        const r = await dispatchNotification({ channel: 'SMS', to: phone, body: `${subject}: balance ${inv.currency} ${inv.balance_due} on invoice #${inv.invoice_no} was due ${dueIso}.` });
        await recordMessageDelivery(tenant.id, { channel: 'SMS', to: phone, subject, body, source: 'invoice-reminder' }, r);
        sent += 1;
      } else {
        skipped += 1;
      }
    }
  }
  return { sent, skipped };
}

/** Boots pg-boss, registers workers and cron schedules. Idempotent. */
export async function startJobs(server: FastifyInstance): Promise<void> {
  const instance = getBoss();
  instance.on('error', (err) => server.log.error({ err }, '[jobs] pg-boss error'));

  await instance.start();
  await instance.createQueue(QUEUE_SWEEP);
  await instance.createQueue(QUEUE_REMINDERS);

  await instance.work(QUEUE_SWEEP, async () => {
    const result = await sweepDueScheduledReports();
    if (result.ran || result.failed) {
      server.log.info({ ...result }, '[jobs] scheduled-report sweep complete');
    }
  });
  await instance.schedule(QUEUE_SWEEP, SWEEP_CRON, {});

  await instance.work(QUEUE_REMINDERS, async () => {
    const result = await runOverdueInvoiceReminders();
    if (result.sent || result.skipped) {
      server.log.info({ ...result }, '[jobs] invoice reminders complete');
    }
  });
  await instance.schedule(QUEUE_REMINDERS, REMINDER_CRON, {});

  server.log.info('[jobs] pg-boss workers started (sweep */5m, reminders daily 06:00 UTC)');
}

export async function stopJobs(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
  }
}
