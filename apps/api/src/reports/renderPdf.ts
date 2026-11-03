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
