import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { InvoicePdf } from './InvoicePdf';
import { PaymentCertificatePdf } from './PaymentCertificatePdf';
import { SiteDiaryReportPdf } from './SiteDiaryReportPdf';
import { ProjectSummaryPdf } from './ProjectSummaryPdf';
import { SnagRegisterPdf } from './SnagRegisterPdf';
import { IndependentInspectionReportPdf } from './IndependentInspectionReportPdf';

/**
 * Renders a React PDF document tree to a Node.js Buffer using @react-pdf/renderer.
 * Satisfies ADR-002: in-process lightweight PDF generation without spawning Chromium/Puppeteer.
 */
export async function renderPdfToBuffer(document: React.ReactElement): Promise<Buffer> {
  const result: any = await pdf(document as any).toBuffer();

  if (Buffer.isBuffer(result)) {
    return result;
  }

  // In @react-pdf/renderer v4, pdf().toBuffer() returns a readable NodeJS stream
  if (typeof result?.on === 'function') {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      result.on('data', (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      result.on('end', () => resolve(Buffer.concat(chunks)));
      result.on('error', (err: Error) => reject(err));
    });
  }

  return Buffer.from(result);
}

// ---------------------------------------------------------------------------
// Worker-pool PDF rendering (Stage-A3): @react-pdf/renderer layout is
// synchronous CPU work. Rendering on the main thread stalls the event loop
// for ~100ms+ per document, so production renders run in a pool of 2 worker
// threads — one per concurrency slot. Queue depth is capped at 20; beyond
// that callers get PdfQueueFullError → 503 + Retry-After. Each render has a
// 15s timeout.
// ---------------------------------------------------------------------------
const PDF_MAX_CONCURRENT = 2;
const PDF_MAX_QUEUE = 20;
const PDF_TIMEOUT_MS = 15_000;
const PDF_RETRY_AFTER_SECONDS = 2;

/** Queue saturated: callers map this to 503 + Retry-After. */
export class PdfQueueFullError extends Error {
  status = 503;
  retryAfterSeconds = PDF_RETRY_AFTER_SECONDS;
  constructor() {
    super('PDF generation is busy — too many concurrent report requests');
    this.name = 'PdfQueueFullError';
  }
}

const PDF_COMPONENTS: Record<string, React.ComponentType<any>> = {
  InvoicePdf,
  PaymentCertificatePdf,
  SiteDiaryReportPdf,
  ProjectSummaryPdf,
  SnagRegisterPdf,
  IndependentInspectionReportPdf,
};

const require2 = createRequire(import.meta.url);
let tsxLoaderUrl: string | null = null;
function workerExecArgv(): string[] {
  if (!tsxLoaderUrl) {
    const pkgJson = require2.resolve('tsx/package.json');
    tsxLoaderUrl = pathToFileURL(join(dirname(pkgJson), 'dist', 'loader.mjs')).href;
  }
  return ['--import', tsxLoaderUrl];
}

interface PdfWorkerSlot {
  worker: Worker;
  busy: boolean;
}
const slots: PdfWorkerSlot[] = [];
const pdfWaiters: Array<() => void> = [];
let nextJobId = 1;

function getSlot(index: number): PdfWorkerSlot {
  if (!slots[index]) {
    const worker = new Worker(new URL('./pdfWorker.ts', import.meta.url), {
      execArgv: workerExecArgv(),
      // Workers must not keep the process alive on their own.
      stdout: false,
      stderr: false,
    });
    worker.unref();
    slots[index] = { worker, busy: false };
    worker.on('error', () => {
      // A crashed worker is replaced on next acquire; in-flight jobs time out.
      slots[index] = { worker: new Worker(new URL('./pdfWorker.ts', import.meta.url), { execArgv: workerExecArgv(), stdout: false, stderr: false }), busy: false };
      slots[index].worker.unref();
    });
  }
  return slots[index];
}

export async function acquirePdfSlot(): Promise<number> {
  for (let i = 0; i < PDF_MAX_CONCURRENT; i++) {
    if (!slots[i]?.busy) {
      const slot = getSlot(i);
      slot.busy = true;
      return i;
    }
  }
  if (pdfWaiters.length >= PDF_MAX_QUEUE) {
    throw new PdfQueueFullError();
  }
  await new Promise<void>((resolve) => pdfWaiters.push(resolve));
  return acquirePdfSlot();
}

export function releasePdfSlot(index: number): void {
  const slot = slots[index];
  if (slot) slot.busy = false;
  pdfWaiters.shift()?.();
}

function renderOnWorker(slotIndex: number, name: string, props: any, jobId: number): Promise<Buffer> {
  const slot = slots[slotIndex]!;
  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('PDF render timed out after 15s'));
    }, PDF_TIMEOUT_MS);
    const onMessage = (msg: any) => {
      if (msg?.id !== jobId) return;
      cleanup();
      if (msg.ok) resolve(Buffer.from(msg.buffer));
      else reject(new Error(msg.error || 'PDF render failed in worker'));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      clearTimeout(timer);
      slot.worker.off('message', onMessage);
      slot.worker.off('error', onError);
    };
    slot.worker.on('message', onMessage);
    slot.worker.on('error', onError);
    slot.worker.postMessage({ id: jobId, name, props });
  });
}

export async function renderPdfToBufferLimited(document: React.ReactElement): Promise<Buffer> {
  const name = Object.keys(PDF_COMPONENTS).find(
    (n) => PDF_COMPONENTS[n] === (document as any).type,
  );
  if (!name) {
    throw new Error(`renderPdfToBufferLimited: unregistered PDF component ${(document as any)?.type?.name ?? 'unknown'}`);
  }
  const slotIndex = await acquirePdfSlot();
  const jobId = nextJobId++;
  try {
    return await renderOnWorker(slotIndex, name, (document as any).props ?? {}, jobId);
  } finally {
    releasePdfSlot(slotIndex);
  }
}

export interface PdfBenchmarkResult {
  buffer: Buffer;
  durationMs: number;
  memoryDeltaMb: number;
  meetsAdr002Thresholds: boolean; // duration < 2500ms, memory < 100MB
}

/**
 * Executes a PDF render and measures execution time and RAM delta to verify ADR-002 constraints.
 */
export async function benchmarkPdfRender(
  renderFn: () => Promise<Buffer>,
): Promise<PdfBenchmarkResult> {
  if (global.gc) {
    try {
      global.gc();
    } catch {
      // ignore if gc exposed flag not set
    }
  }

  const memBefore = process.memoryUsage().heapUsed;
  const t0 = performance.now();

  const buffer = await renderFn();

  const t1 = performance.now();
  const memAfter = process.memoryUsage().heapUsed;

  const durationMs = t1 - t0;
  const memoryDeltaMb = Math.max(0, (memAfter - memBefore) / (1024 * 1024));
  const meetsAdr002Thresholds = durationMs < 2500 && memoryDeltaMb < 100;

  return {
    buffer,
    durationMs,
    memoryDeltaMb,
    meetsAdr002Thresholds,
  };
}
