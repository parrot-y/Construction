# Skill: build-in-vertical-slices

## When to use
Planning and executing each build milestone (Gate 4+). Adapted from disciplined-vibe-coding `plan`/`execute` skills.

## Definition of a slice
Thin end-to-end: a user can DO something real through UI → API → DB → (audit/jobs) and see the result. No horizontal "build all APIs then all UI" milestones.

## Per-slice deliverables
1. User stories + Given/When/Then acceptance criteria.
2. Tasks with path + expected output + observable pass/fail check.
3. Test plan (which test types from test-strategy apply).
4. Definition of done: tests green, typecheck clean, lint clean, docs updated, PROJECT_STATUS + REMEDIATION_PLAN updated, demo-able.
5. Risks + rollback note for destructive steps.

## Hard rules (from disciplined-vibe-coding, adopted)
- **Payments rule**: provider-hosted checkout only; never store/process raw card data.
- **Autonomy rule**: anything running unsupervised gets codified decision policy + kill-switch BEFORE code.
- **Rerun-safe**: pipeline tasks must survive running twice (idempotency named explicitly).
- **Budget line**: any task >2 min wall-time gets expected duration + completion signal.
- **Reuse first**: list what existing code/packages the slice reuses before writing new code.
- Small commits; CI green; never merge failing tests; no secrets in repo.

## Review chain per slice
Backend/Frontend implement → QA tests → Security checks → Critic reviews → Tech Writer updates docs → CTO demos to owner with screenshots → owner approves → next slice.

## Common mistakes
- Slice too big to demo (split it).
- "Done" without the demo — owner approval requires seeing it work.
- Building the portal/slice without its audit-log entries.
