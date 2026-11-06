# ADR-009: Client visibility controls & ProjectClient entity

**Status:** proposed · **Date:** 2026-11-06 · **Deciders:** owner + CTO

## Context
Buildsasa's best UX detail: per-photo "Show to client in portal" toggle — internal issues (accidents, supplier problems) stay private; written diary notes are NEVER client-visible. Our SitePhoto lacks a visibility flag and we have no structured per-project Client entity (portal access is token links only).

## Options
- **A. `project_clients` entity + `site_photos.client_visible` boolean + diary-notes exclusion rule.**
- **B. Token-only access (status quo)** — insufficient: no client identity, no per-client scoping, no approval attribution.
- **C. Share everything** — rejected: privacy/KDPA risk, kills contractor trust.

## Decision
Option A.
- `project_clients`: project_id, name, email/phone, role hint (owner/agent), portal link(s), status.
- `site_photos.client_visible Boolean @default(false)` — default OFF (opt-in sharing, safer).
- Rule: client portal exposes ONLY `client_visible=true` photos + explicitly shared documents/updates; diary text notes never exposed; variations/certificates shown when status reaches client-visible stage.
- KDPA 2019: photos may contain identifiable persons — consent note in privacy policy; retention limits per Data Protection Act.

## Consequences
- Client portal (M9) gains real identity + granular media sharing.
- Existing M9 portal queries must filter `client_visible` — migration + test updates required.
- Aligns with our Data Protection Act obligations (R-009).
