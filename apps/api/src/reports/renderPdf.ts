import React from 'react';
import { pdf } from '@react-pdf/renderer';

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
// Concurrency limit + timeout (Stage-7): PDF rendering is CPU-bound; cap
// in-flight renders at 2 per process and fail fast after 30s so a burst of
// report requests queues instead of starving the event loop.
// ---------------------------------------------------------------------------
const PDF_MAX_CONCURRENT = 2;
const PDF_TIMEOUT_MS = 30_000;
let pdfInFlight = 0;
const pdfWaiters: Array<() => void> = [];

async function acquirePdfSlot(): Promise<() => void> {
  if (pdfInFlight < PDF_MAX_CONCURRENT) {
    pdfInFlight += 1;
    return () => {
      pdfInFlight -= 1;
      pdfWaiters.shift()?.();
    };
  }
  await new Promise<void>((resolve) => pdfWaiters.push(resolve));
  pdfInFlight += 1;
  return () => {
    pdfInFlight -= 1;
    pdfWaiters.shift()?.();
  };
}

export async function renderPdfToBufferLimited(document: React.ReactElement): Promise<Buffer> {
  const release = await acquirePdfSlot();
  try {
    return await Promise.race([
      renderPdfToBuffer(document),
      new Promise<Buffer>((_, reject) =>
        setTimeout(() => reject(new Error('PDF render timed out after 30s')), PDF_TIMEOUT_MS),
      ),
    ]);
  } finally {
    release();
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
