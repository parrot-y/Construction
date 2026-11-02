# ADR-002: Server-Side PDF Report Generation Engine

- **Status:** Draft (Awaiting verification benchmark in Milestone M10)
- **Date:** 2026-11-02
- **Deciders:** Engineering Lead (Gemini), Project Owner, Independent Reviewer (Claude)
- **Relevant Issues:** Remediation Plan R-010, Milestone M10 Scope

---

## 1. Context & Problem Statement

The platform must generate print-ready, professional PDF documents:
1. Interim Payment Certificates (IPCs) and valuation summaries.
2. Daily Site Diary summaries with photo grids.
3. Budget vs. Actual cost breakdown reports for clients.

Hosting is on Railway. Starter containers provide 512MB RAM. Traditional Node.js PDF generation tools rely on headless browser automation (Puppeteer, Playwright, or `wkhtmltopdf`). Running a Chromium process requires 300MB+ of disk dependencies and consumes 200MB–400MB of resident memory during rendering, posing a severe risk of Out-Of-Memory (OOM) process termination on small cloud containers.

---

## 2. Decision

We choose **`@react-pdf/renderer`** as the primary PDF generation engine for the Fastify API.

### Technical Architecture
- Pure JavaScript/Node.js pipeline using the Yoga flexbox layout engine.
- Zero Chromium or browser binary dependencies.
- Generates binary PDF streams directly in memory for Fastify:
  ```typescript
  import { renderToStream } from '@react-pdf/renderer';
  import { PaymentCertificateDocument } from './templates/PaymentCertificate';

  export async function generateCertificatePdf(data: CertificateData): Promise<NodeJS.ReadableStream> {
    return await renderToStream(<PaymentCertificateDocument data={data} />);
  }
  ```
- Component templates written in JSX/React, sharing stylistic conventions with the web frontend.

---

## 3. Consequences

### Positive
- **Low Memory Footprint:** Executes entirely within the Node.js V8 process without spawning external browser processes, eliminating container OOM crashes.
- **Fast Startup:** Zero browser launch latency (cold starts are eliminated).
- **Small Docker Image:** Container image size remains under 200MB instead of 1GB+ with browser binaries.
- **Declarative Layout:** Reuses React component paradigms for page layouts, headers, and tables.

### Negative / Trade-offs
- `@react-pdf/renderer` uses a custom subset of CSS/Flexbox implemented via Yoga, rather than full browser CSS (e.g. no arbitrary CSS grid or complex SVG filters).
- Custom fonts (e.g. Inter or Roboto) must be explicitly registered via `Font.register()`.

### Verification Criteria (Milestone M10)
- A memory and latency benchmark will run on a real Railway staging instance under load (generating a 10-page report with tables and 10 compressed photos) asserting that memory consumption does not exceed 100MB above baseline and rendering finishes in < 2.5 seconds.
