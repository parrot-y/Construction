# ADR-010: Change-order / variation upgrade — triggers, assignees, approval limits

**Status:** proposed · **Date:** 2026-11-06 · **Deciders:** owner + CTO

## Context
Buildsasa change orders carry: trigger taxonomy (design clarification, owner request, unforeseen condition, code compliance, structural review, weather/delays, other), linked RFI, cost+schedule impact, assignees, and a 3-stage approval (Drafted→PM Review→Owner Approval) with per-role approval limits. Our VariationOrder has SUBMITTED→QS_EVALUATED→APPROVED→REJECTED and net_amount/time_extension but no trigger/assignee/limit fields.

## Options
- **A. Extend VariationOrder** with trigger, linked_rfi_id (RFI model exists), cost_impact/schedule_impact, assignees (ProjectMember links), status chain extended to include OWNER_REVIEW, and `approval_limit_minor` on Membership/role config.
- **B. New ChangeOrder model parallel to variations** — rejected: duplicate concept, migration pain.
- **C. Keep as-is** — rejected: misses the approval-limit control that makes COs trustworthy.

## Decision
Option A — VariationOrder IS our change-order engine.
- Add fields: `trigger_type`, `linked_rfi_id`, `cost_impact`, `schedule_impact_days` (exists as time_extension_days — reuse), `requested_by`, assignees via join table.
- Statuses extended: `DRAFT → PM_REVIEW → OWNER_REVIEW → APPROVED | REJECTED | VOID` mapped onto existing SUBMITTED/QS_EVALUATED/APPROVED/REJECTED (migration maps old values).
- `approval_limit_minor` (integer minor units, KES) on role/membership config; enforcement server-side in transition endpoint.
- All transitions audit-logged (existing AuditLog).

## Consequences
- Client portal shows COs awaiting owner approval (matches M9 pending-variations UI).
- PM/QS role gets approval limit config — new company setting.
- Existing variation tests need updates for new statuses.
