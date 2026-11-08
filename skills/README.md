# Skills pack — Platform program playbook

Index of working procedures. Each skill lists when to use it, the procedure, a checklist, an output template, and common mistakes. Follow these for every phase; a deliverable is not accepted until its skill's checklist passes and the reviewer role signs off.

| # | Skill | Use when |
|---|---|---|
| 1 | [competitor-audit-and-crawl](competitor-audit-and-crawl/SKILL.md) | Studying any external product/site we do not own |
| 2 | [workflow-mapping](workflow-mapping/SKILL.md) | Capturing screens, fields, statuses, state machines |
| 3 | [roles-and-permissions](roles-and-permissions/SKILL.md) | Deriving role × module × action matrices |
| 4 | [data-modelling](data-modelling/SKILL.md) | Inferring entities, ERDs, money/tenancy rules |
| 5 | [system-design-review](system-design-review/SKILL.md) | C4 diagrams, NFRs, pass/fail design gate |
| 6 | [adr-writing](adr-writing/SKILL.md) | Any decision that is expensive to reverse |
| 7 | [kenya-integrations](kenya-integrations/SKILL.md) | M-Pesa, SMS/WhatsApp, KRA eTIMS, local accounting |
| 8 | [security-and-compliance](security-and-compliance/SKILL.md) | Tenant isolation, RBAC, KDPA 2019, OWASP, secrets |
| 9 | [offline-and-low-bandwidth](offline-and-low-bandwidth/SKILL.md) | Site/PWA work on bad networks |
| 10 | [test-strategy](test-strategy/SKILL.md) | Test pyramid, tenant-isolation tests, acceptance criteria |
| 11 | [build-in-vertical-slices](build-in-vertical-slices/SKILL.md) | Delivering thin end-to-end slices |
| 12 | [critic-review](critic-review/SKILL.md) | Red-team review of any deliverable |

## Team rules (apply to every skill)

- Every deliverable has an **owner role** and a **reviewer role**. The owner never marks their own work done.
- Tag claims `[OBSERVED]` (seen directly), `[INFERRED]` (deduced), `[ASSUMPTION]` (unverified guess). Assumptions live in `docs/ASSUMPTIONS.md`.
- Living files: `docs/PROJECT_STATUS.md` and `docs/REMEDIATION_PLAN.md` are updated after every unit of work.
- Prefer boring, proven technology. Optimise for one founder + AI agents.
- If ambiguous or risky: STOP and ask the owner.

## Adopted external skills (owner-requested, vetted 2026-11-06)

From https://skill-issue.in/ and https://github.com/bmtrnavsky/disciplined-vibe-coding (read before adoption per R-011):

- **disciplined-vibe-coding** stage skills (intake → brainstorm → research → plan → execute → verify → test-first → debug → write-docs → version): adopted in spirit — our gates already map to them; see `skills/build-in-vertical-slices` and `skills/test-strategy`. No hooks installed.
- **Relevant skill-issue.in entries** (install candidates when we touch those layers): `agent-browser` (web automation), `web-design-guidelines`, `frontend-design`/`design-taste-frontend` (UI quality), `tailwind-design-system`, `react-best-practices`, `accessibility-compliance`, `api-design-principles`, `auth-implementation-patterns`. Evaluate each SKILL.md source before installing; do not run unread install commands.
