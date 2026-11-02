# ADR-005: Money Handling, Arithmetic Precision & Rounding Rules

- **Status:** Draft (Awaiting verification in Milestone M1)
- **Date:** 2026-11-02
- **Deciders:** Engineering Lead (Gemini), Project Owner, Independent Reviewer (Claude)
- **Relevant Issues:** Remediation Plan R-005, R-018, Milestone M1 Scope

---

## 1. Context & Problem Statement

Construction accounting in Kenya deals with multi-million shilling contract sums (e.g., KES 50,000,000.00), fractional material quantities (e.g., $14.375\text{ m}^3$ of readymix concrete or $2.450\text{ tonnes}$ of reinforcement steel), and unit rates with fractional shillings (e.g., KES 145.5050 per linear meter).

Using JavaScript floating-point numbers (`number` IEEE 754) leads to catastrophic financial discrepancies:
- `0.1 + 0.2 = 0.30000000000000004`
- Rounding intermediate products accumulates tens of thousands of shillings in cumulative rounding error across a 2,000-line BOQ.
- Storing currency amounts as integer cents causes precision loss on fractional unit rates.

---

## 2. Decision

We mandate a **single source of money math in `packages/money`**, strict PostgreSQL `numeric` column definitions, and unambiguous rounding rules.

### 2.1 Database Precision Standards

| Metric Type | PostgreSQL Type | Prisma Type | Maximum Value | Precision / Scale | Example |
|---|---|---|---|---|---|
| **Currency Amount** (Line Totals, Budgets, Actual Spend, IPC Values) | `numeric(15,2)` | `Decimal` | 9,999,999,999,999.99 | 2 decimal places (KES cents) | `KES 12,850,000.50` |
| **Unit Rate** (BOQ Unit Price, Labor Daily Rate) | `numeric(15,4)` | `Decimal` | 9,999,999,999.9999 | 4 decimal places | `KES 1,450.2550` |
| **Measured Quantity** (BOQ Qty, Work Completed, Material Units) | `numeric(12,4)` | `Decimal` | 99,999,999.9999 | 4 decimal places | `12.3750 m3` |
| **Progress & Percentage** (Physical Progress %, Retention %) | `numeric(5,4)` | `Decimal` | 1.0000 (100.00%) | 4 decimal places | `0.1000` (10%) |

---

### 2.2 Application-Layer Rules (`packages/money`)

1. **No JavaScript `number` arithmetic on money:**
   - Performing `+`, `-`, `*`, or `/` on financial variables using JavaScript native numbers is strictly prohibited.
   - Enforced via an ESLint rule and CI static analysis.
2. **`decimal.js` Single Source of Truth:**
   - All arithmetic must use helper methods exported from `packages/money`:
   ```typescript
   import { Decimal } from 'decimal.js';

   export function multiplyQuantityByRate(quantity: string | Decimal, rate: string | Decimal): Decimal {
     return new Decimal(quantity).times(new Decimal(rate));
   }

   export function calculateBudgetConsumption(actualCost: Decimal, currentBudget: Decimal): Decimal {
     if (currentBudget.isZero()) return new Decimal(0);
     return actualCost.dividedBy(currentBudget);
   }
   ```
3. **Rounding Policy: `ROUND_HALF_UP` on Currency Totals Only:**
   - In intermediate calculations (e.g. rate breakdown or subtotal accumulation), maintain full precision (up to 4 decimal places).
   - Rounding to 2 decimal places (`ROUND_HALF_UP`) is applied **only once at the document/certificate total level**:
   ```typescript
   export function toCurrency(amount: Decimal): string {
     return amount.toFixed(2, Decimal.ROUND_HALF_UP);
   }
   ```

---

### 2.3 Financial Invariants & Server-Side Enforcement

1. **Current Approved Budget Formula:**
   $$\text{Current Approved Budget} = \text{Original BOQ Budget} + \sum \text{Approved Variations}$$
   - Variations that are pending or rejected must never alter the budget baseline.
2. **Cost Consumption Formula:**
   $$\text{Cost Consumption \%} = \frac{\text{Actual Approved Cost}}{\text{Current Approved Budget}}$$
3. **Physical Progress vs. Cost Variance Flag:**
   - Physical progress % is derived strictly from verified site progress measurements, never inferred from expenditure.
   - If $\text{Cost Consumption \%} - \text{Physical Progress \%} \ge 15\%$, the system displays the neutral notice:
     > *"Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records."*
   - Strictly neutral, non-inflammatory language (never using "theft", "fraud", or "overbilled").

---

## 3. Consequences

### Positive
- Prevents rounding drift and eliminates IEEE-754 floating-point errors.
- Unit rates can safely store fractional shilling calculations (e.g., fuel or cement per kilogram).
- Financial math is fully unit-tested with cent-level test vectors in `packages/money`.

### Negative / Trade-offs
- Slight serialization overhead converting Prisma `Decimal` instances to strings for JSON API payloads.
- Frontend must treat money values as formatted strings and delegate all math to the server API.
