import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { dispatchNotification, normalizeKePhone } from '../integrations/messaging';
import { recordMessageDelivery } from './messageDeliveries';

/** Compute next run time from frequency + optional weekday/day-of-month. */
export function nextRunAt(frequency: string, dayOfWeek?: number | null, dayOfMonth?: number | null, from = new Date()): Date {
  const d = new Date(from);
  if (frequency === 'DAILY') {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(6, 0, 0, 0);
    return d;
  }
  if (frequency === 'WEEKLY') {
    const target = dayOfWeek ?? 1; // default Monday
    const diff = ((target - d.getUTCDay()) + 7) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(6, 0, 0, 0);
    return d;
  }
  // MONTHLY — clamp to 28 to avoid month-length issues
  const target = Math.min(dayOfMonth ?? 1, 28);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(target);
  d.setUTCHours(6, 0, 0, 0);
  return d;
}

/** Snapshot tenant report summary — the payload a scheduled run stores. */
async function buildReportSummary(tx: any, tenantId: string, projectId: string | null, reportType: string) {
  const projectWhere = projectId ? { project_id: projectId } : {};
  const [projects, openSnags, pendingInvoices, invoiceCount, diaries, observations] = await Promise.all([
    tx.project.count({ where: { tenant_id: tenantId, ...(projectId ? { id: projectId } : {}) } }),
    tx.snagItem.count({ where: { tenant_id: tenantId, status: { in: ['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW'] }, ...projectWhere } }),
    tx.invoice.aggregate({
      where: { tenant_id: tenantId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, ...(projectId ? { project_id: projectId } : {}) },
      _sum: { total: true, amount_paid: true },
    }),
    tx.invoice.count({ where: { tenant_id: tenantId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }, ...(projectId ? { project_id: projectId } : {}) } }),
    tx.siteDiary.count({ where: { tenant_id: tenantId, ...(projectId ? { project_id: projectId } : {}) } }),
    tx.siteObservation.count({ where: { tenant_id: tenantId, status: { in: ['OPEN', 'IN_REVIEW'] }, ...projectWhere } }),
  ]);
  return {
    report_type: reportType,
    project_id: projectId,
    generated_at: new Date().toISOString(),
    projects,
    open_snags: openSnags,
    open_observations: observations,
    site_diaries: diaries,
    receivables: {
      invoice_count: invoiceCount,
      total_billed: pendingInvoices._sum.total?.toString() ?? '0',
      total_paid: pendingInvoices._sum.amount_paid?.toString() ?? '0',
    },
  };
}

export interface ScheduledReportRunResult {
  run: any;
  summary: any;
  report: any;
  deliveries: Array<{ to: string; channel: string; status: string; simulated?: boolean }>;
  deliveriesStatus: 'DONE' | 'QUEUED';
}

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';

/**
 * Executes one scheduled report: snapshots the summary into a
 * ScheduledReportRun, advances next_run_at, audits, then delivers the
 * snapshot to recipients that resolve to a contact channel.
 * Shared by the manual POST /run route and the pg-boss sweep worker.
 */
export async function runScheduledReport(
  tenantId: string,
  reportId: string,
  actorId?: string,
  opts: { skipDelivery?: boolean } = {},
): Promise<ScheduledReportRunResult> {
  const result = await withTenantTx(prisma, tenantId, async (tx) => {
    const report = await tx.scheduledReport.findUnique({ where: { id: reportId } });
    if (!report) throw { status: 404, message: 'Report not found' };
    try {
      const summary = await buildReportSummary(tx, tenantId, report.project_id, report.report_type);
      const run = await tx.scheduledReportRun.create({
        data: { tenant_id: tenantId, report_id: reportId, status: 'SUCCESS', summary },
      });
      await tx.scheduledReport.update({
        where: { id: reportId },
        data: {
          last_run_at: new Date(),
          next_run_at: report.status === 'ACTIVE' ? nextRunAt(report.frequency, report.day_of_week, report.day_of_month) : null,
        },
      });
      await recordAuditLog(tx, {
        tenantId, projectId: report.project_id ?? undefined, actorId: actorId ?? report.created_by_id ?? SYSTEM_ACTOR,
        action: 'SCHEDULED_REPORT_RUN', entityType: 'ScheduledReport', entityId: reportId,
        changes: { runId: run.id, reportType: report.report_type, triggeredBy: actorId ? 'user' : 'scheduler' },
      });
      return { run, summary, report };
    } catch (innerErr: any) {
      await tx.scheduledReportRun.create({
        data: { tenant_id: tenantId, report_id: reportId, status: 'FAILED', error: String(innerErr?.message ?? innerErr).slice(0, 2000) },
      });
      throw innerErr;
    }
  });

  // P5.10 — the manual /run route can defer delivery to the pg-boss queue;
  // the sweep worker and queue-down fallback deliver inline.
  if (opts.skipDelivery) {
    return { ...result, deliveries: [], deliveriesStatus: 'QUEUED' };
  }
  const deliveries = await deliverReportSnapshot(tenantId, result.report, result.run, result.summary);
  return { ...result, deliveries, deliveriesStatus: 'DONE' };
}

/**
 * Delivers the snapshot of a report's latest SUCCESS run to its recipients.
 * Used inline by runScheduledReport and by the pg-boss delivery worker when
 * the /run route defers delivery off the request path.
 */
export async function deliverScheduledReport(
  tenantId: string,
  reportId: string,
): Promise<ScheduledReportRunResult['deliveries']> {
  const loaded = await withTenantTx(prisma, tenantId, async (tx) => {
    const report = await tx.scheduledReport.findUnique({ where: { id: reportId } });
    if (!report) return null;
    const run = await tx.scheduledReportRun.findFirst({
      where: { report_id: reportId, status: 'SUCCESS' },
      orderBy: { ran_at: 'desc' },
    });
    return run ? { report, run } : null;
  });
  if (!loaded) return [];
  const summary = (loaded.run.summary && typeof loaded.run.summary === 'object') ? loaded.run.summary as any : {};
  return deliverReportSnapshot(tenantId, loaded.report, loaded.run, summary);
}

/** Recipient loop shared by inline and queued delivery paths. */
async function deliverReportSnapshot(
  tenantId: string,
  report: any,
  run: any,
  summary: any,
): Promise<ScheduledReportRunResult['deliveries']> {
  // Deliver snapshot to recipients that resolve to a contact channel:
  // emails → EMAIL, phone-like → SMS, role labels skipped (documented).
  const deliveries: ScheduledReportRunResult['deliveries'] = [];
  const recipients: string[] = Array.isArray(report.recipients) ? report.recipients : [];
  const reportTitle = `${report.report_type} report — ${report.name || report.id}`;
  for (const raw of recipients) {
    const target = String(raw).trim();
    if (!target) continue;
    if (target.includes('@')) {
      const body = `Scheduled report snapshot:\n\n${JSON.stringify(summary, null, 2).slice(0, 4000)}`;
      const r = await dispatchNotification({ channel: 'EMAIL', to: target, subject: reportTitle, body });
      deliveries.push({ to: target, channel: 'EMAIL', status: r.simulated ? 'SIMULATED' : r.ok ? 'DELIVERED' : 'FAILED' });
      await recordMessageDelivery(tenantId, { channel: 'EMAIL', to: target, subject: reportTitle, body, source: 'scheduled-report' }, r);
    } else if (/^[+0-9][0-9\s-]{8,}$/.test(target)) {
      const body = `${reportTitle}: report ready. View in app → Reports → Scheduled.`;
      const r = await dispatchNotification({ channel: 'SMS', to: normalizeKePhone(target), body });
      deliveries.push({ to: target, channel: 'SMS', status: r.simulated ? 'SIMULATED' : r.ok ? 'DELIVERED' : 'FAILED' });
      await recordMessageDelivery(tenantId, { channel: 'SMS', to: normalizeKePhone(target), body, source: 'scheduled-report' }, r);
    } else {
      deliveries.push({ to: target, channel: 'ROLE_LABEL', status: 'SKIPPED' });
    }
  }
  if (deliveries.length) {
    await withTenantTx(prisma, tenantId, async (tx) => {
      const existing = (run.summary && typeof run.summary === 'object') ? run.summary as any : {};
      await tx.scheduledReportRun.update({
        where: { id: run.id },
        data: { summary: { ...existing, deliveries } },
      });
    });
  }

  return deliveries;
}
