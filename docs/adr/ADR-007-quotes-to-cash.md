# ADR-007: Quotes-to-cash chain (Quote → Project → Invoice)

**Status:** proposed · **Date:** 2026-11-06 · **Deciders:** owner + CTO

## Context
Buildsasa research shows the winning contractor flow starts at the **quote**: template line items → WhatsApp share → client accepts on phone → convert to project → deposit invoice auto-drafted. Our schema has no Quote or client-AR Invoice entities; ETimsInvoice covers tax invoices, not AR.

## Options
- **A. New Quote/QuoteLine/Invoice/InvoiceLine models** mirroring Buildsasa fields (client name/phone/email, site+GPS, line items w/ units, discount, VAT %, deposit %, terms, status draft/sent/accepted/declined/expired; invoice #, bill/ship-to, payment terms Net 7–60, PO number, qty/rate/amount, tax/discount/shipping, amount paid, balance).
- **B. Extend CostEntry** — rejected: cost entries are internal spend, not client-facing AR with statuses/terms.
- **C. External tool** — rejected: breaks the evidence chain.

## Decision
Option A. New tenant-scoped tables: `quotes`, `quote_lines`, `invoices`, `invoice_lines` (+ statuses as enums/strings per codebase convention). Quote→project conversion creates Project + optional deposit Invoice (status `sent`). All money via `packages/money` Decimal; all tables RLS FORCE + isolation tests; audit-logged.

## Consequences
- WhatsApp share = tokenized public link (reuse PortalAccessLink pattern or new `quote_share_token`).
- Invoice statuses draft/sent/paid/overdue + mark-paid; payment reconciliation via M-Pesa reference when live.
- eTIMS fields on invoice (tin, item classification) stubbed until real VSCU integration — no fake signatures (C2 lesson).
- Scope: API + minimal React UI slice; templates library deferred to SHOULD.
