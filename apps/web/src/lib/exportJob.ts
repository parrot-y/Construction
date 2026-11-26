import { api } from './api';

/**
 * P5.10 — queued report exports. The console requests an export job, polls
 * until the pg-boss worker marks it READY, then triggers the download.
 * Keeps heavy workbook generation off the API request path.
 */

export type ExportKind = 'financials' | 'cost';

interface ExportJobStatus {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';
  filename: string | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 90_000;

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadQueuedExport(kind: ExportKind, projectId: string): Promise<void> {
  const created = await api.post<{ data: { jobId: string } }>(
    `/api/v1/projects/${projectId}/reports/${kind}/export`,
    {},
  );
  const jobId = created.data.jobId;

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await api.get<{ data: ExportJobStatus }>(`/api/v1/export-jobs/${jobId}`);
    const job = res.data;
    if (job.status === 'READY') {
      triggerDownload(`/api/v1/export-jobs/${jobId}/download`, job.filename || `${kind}-report.xlsx`);
      return;
    }
    if (job.status === 'FAILED') {
      throw new Error(job.error || 'Export failed');
    }
    if (Date.now() > deadline) {
      throw new Error('Export is taking too long — try again shortly.');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}
