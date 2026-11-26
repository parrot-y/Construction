import ExcelJS from 'exceljs';
import { prisma, withTenantTx } from '@construction/db';
import { PRODUCT_NAME } from './product';

/**
 * P5.10 — project report workbook builders, shared by the synchronous
 * GET *.xlsx endpoints (auditor contract) and the pg-boss export jobs
 * (console path). Each returns the workbook buffer + download filename.
 */

const money = (v: any) => Number(v ?? 0);
const safeCode = (code: string | null | undefined, fallback: string) =>
  (code || fallback).replace(/[^a-z0-9-]/gi, '');

export async function buildFinancialsXlsx(tenantId: string, projectId: string): Promise<{ buffer: Buffer; filename: string }> {
  const data = await withTenantTx(prisma, tenantId, async (tx) => {
    const project = await tx.project.findFirst({ where: { id: projectId }, select: { name: true, code: true, project_type: true, project_subtype: true } });
    const [invoices, costs, variations, commitments] = await Promise.all([
      tx.invoice.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'desc' }, take: 500 }),
      tx.costEntry.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'desc' }, take: 500 }),
      tx.variationOrder.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'desc' }, take: 500 }),
      tx.subcontractorPackage.findMany({ where: { project_id: projectId }, take: 200 }).catch(() => []),
    ]);
    return { project, invoices, costs, variations, commitments };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = PRODUCT_NAME;

  const cash = wb.addWorksheet('Cash flow');
  cash.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'desc', width: 50 },
    { header: 'Category', key: 'cat', width: 20 },
    { header: 'Type', key: 'type', width: 8 },
    { header: 'Amount (KES)', key: 'amt', width: 16 },
  ];
  cash.getRow(1).font = { bold: true };
  let cashIn = 0; let cashOut = 0;
  for (const i of data.invoices) {
    const paid = money(i.amount_paid);
    if (paid > 0) { cash.addRow({ date: i.issue_date || i.created_at, desc: `Invoice ${i.invoice_no ?? ''} — ${i.title ?? i.client_name ?? ''}`, cat: 'Client payment', type: 'In', amt: paid }); cashIn += paid; }
  }
  for (const c of data.costs) {
    const amt = money(c.amount);
    cash.addRow({ date: c.created_at, desc: c.description ?? 'Cost', cat: c.cost_category ?? 'Other', type: 'Out', amt }); cashOut += amt;
  }
  cash.addRow({});
  cash.addRow({ desc: 'TOTAL CASH IN', type: 'In', amt: cashIn }).font = { bold: true };
  cash.addRow({ desc: 'TOTAL CASH OUT', type: 'Out', amt: cashOut }).font = { bold: true };
  cash.addRow({ desc: 'NET', amt: cashIn - cashOut }).font = { bold: true, size: 12 };

  const vars = wb.addWorksheet('Change orders');
  vars.columns = [
    { header: 'CO #', key: 'no', width: 10 },
    { header: 'Title', key: 'title', width: 45 },
    { header: 'Trigger', key: 'trigger', width: 20 },
    { header: 'Net amount (KES)', key: 'amt', width: 18 },
    { header: 'Time ext (days)', key: 'days', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Created', key: 'created', width: 12 },
  ];
  vars.getRow(1).font = { bold: true };
  for (const v of data.variations) {
    vars.addRow({ no: v.variation_no, title: v.title, trigger: v.trigger_type ?? '', amt: money(v.net_amount), days: v.time_extension_days, status: v.status, created: v.created_at });
  }

  const coms = wb.addWorksheet('Commitments');
  coms.columns = [
    { header: 'Vendor / package', key: 'vendor', width: 40 },
    { header: 'Trade', key: 'trade', width: 22 },
    { header: 'Contract sum (KES)', key: 'sum', width: 18 },
    { header: 'Retention %', key: 'ret', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  coms.getRow(1).font = { bold: true };
  for (const c of data.commitments as any[]) {
    coms.addRow({ vendor: c.firm_name ?? c.vendor_name ?? '', trade: c.trade_category ?? '', sum: money(c.subcontract_sum ?? c.contract_sum), ret: money(c.retention_rate_pct), status: c.status });
  }

  const filename = `financials-${safeCode(data.project?.code, projectId)}.xlsx`;
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename };
}

export async function buildCostXlsx(tenantId: string, projectId: string): Promise<{ buffer: Buffer; filename: string }> {
  const data = await withTenantTx(prisma, tenantId, async (tx) => {
    const project = await tx.project.findFirst({ where: { id: projectId }, select: { name: true, code: true, project_type: true, project_subtype: true } });
    const costs = await tx.costEntry.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      take: 2000,
    });
    return { project, costs };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = PRODUCT_NAME;

  const ws = wb.addWorksheet('Costs');
  ws.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'desc', width: 55 },
    { header: 'Category', key: 'cat', width: 22 },
    { header: 'Vendor', key: 'vendor', width: 30 },
    { header: 'Amount (KES)', key: 'amt', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  const byCat = new Map<string, number>();
  for (const c of data.costs as any[]) {
    const amt = money(c.amount);
    const cat = c.cost_category ?? 'Other';
    ws.addRow({
      date: c.created_at,
      desc: c.description ?? '',
      cat,
      vendor: c.vendor_name ?? c.supplier_name ?? '',
      amt,
      status: c.status ?? '',
    });
    byCat.set(cat, (byCat.get(cat) ?? 0) + amt);
  }
  ws.addRow({});
  ws.addRow({ desc: 'TOTAL', amt: [...byCat.values()].reduce((a, b) => a + b, 0) }).font = { bold: true };

  const summary = wb.addWorksheet('By category');
  summary.columns = [
    { header: 'Category', key: 'cat', width: 30 },
    { header: 'Total (KES)', key: 'amt', width: 18 },
  ];
  summary.getRow(1).font = { bold: true };
  for (const [cat, amt] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    summary.addRow({ cat, amt });
  }

  const filename = `cost-report-${safeCode(data.project?.code, projectId)}.xlsx`;
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename };
}

export const EXPORT_BUILDERS: Record<string, (tenantId: string, projectId: string) => Promise<{ buffer: Buffer; filename: string }>> = {
  financials: buildFinancialsXlsx,
  cost: buildCostXlsx,
};
