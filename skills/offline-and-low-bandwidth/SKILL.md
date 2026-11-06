# Skill: offline-and-low-bandwidth

## When to use
Any site-facing feature (diary, photos, attendance, progress) that must work on Kenyan site networks: intermittent 3G, dead zones, shared devices.

## Procedure
1. Classify actions: **offline-safe** (create diary entry, log headcount, capture photo, mark progress %) vs **online-only** (approvals, payments, anything financial or security-sensitive). Default: financial/approval actions are NEVER offline-queued.
2. Offline store: IndexedDB queue with idempotency keys; photos compressed client-side (canvas, ~1280px, JPEG q≈0.7) before queueing.
3. Sync: FIFO with retry/backoff; conflicts resolved by server-authoritative last-write or explicit merge — never silent overwrite of approved/financial records.
4. UX: visible sync status (pending count, last sync time), retry affordance, never lose user input on refresh.
5. Low-bandwidth: lazy-load lists, paginate, avoid heavy bundles on field routes, image thumbnails, text-first fallbacks (SMS) for critical alerts.

## Checklist
- [ ] Offline-safe vs online-only lists written down per feature
- [ ] Idempotency-Key on every queued mutation; server dedupes
- [ ] Client-side photo compression before upload
- [ ] Conflict behaviour specified and tested
- [ ] Sync status visible to the user
- [ ] Graceful degradation when GPS/camera unavailable

## Common mistakes (see ADR-004)
- Queueing approvals/payments offline — a queued "approve" is a fraud vector.
- Uploading raw multi-MB photos on 3G.
- Assuming connectivity during sync — retries must be infinite-but-bounded with user visibility.
