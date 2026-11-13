import { parentPort } from 'node:worker_threads';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoicePdf } from './InvoicePdf';
import { PaymentCertificatePdf } from './PaymentCertificatePdf';
import { SiteDiaryReportPdf } from './SiteDiaryReportPdf';
import { ProjectSummaryPdf } from './ProjectSummaryPdf';
import { SnagRegisterPdf } from './SnagRegisterPdf';
import { IndependentInspectionReportPdf } from './IndependentInspectionReportPdf';

/**
 * PDF render worker: @react-pdf/renderer layout is synchronous CPU work —
 * running it on the main thread stalls every request. This worker receives
 * { id, name, props }, rebuilds the element and posts the buffer back.
 */
const REGISTRY: Record<string, React.ComponentType<any>> = {
  InvoicePdf,
  PaymentCertificatePdf,
  SiteDiaryReportPdf,
  ProjectSummaryPdf,
  SnagRegisterPdf,
  IndependentInspectionReportPdf,
};

async function streamToBuffer(result: any): Promise<Buffer> {
  if (Buffer.isBuffer(result)) return result;
  if (typeof result?.on === 'function') {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      result.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      result.on('end', () => resolve(Buffer.concat(chunks)));
      result.on('error', reject);
    });
  }
  return Buffer.from(result);
}

parentPort!.on('message', async (msg: { id: number; name: string; props: any }) => {
  const { id, name, props } = msg;
  try {
    const Component = REGISTRY[name];
    if (!Component) throw new Error(`Unknown PDF component: ${name}`);
    const buffer = await streamToBuffer(await pdf(React.createElement(Component, props) as any).toBuffer());
    parentPort!.postMessage({ id, ok: true, buffer });
  } catch (err: any) {
    parentPort!.postMessage({ id, ok: false, error: err?.message ?? String(err) });
  }
});
