# ADR-012: Staging/production hosting for the Kenya-first SaaS

**Status:** accepted (with amendments) · **Amended:** 2026-11-13 · **Date:** 2026-11-13 · **Deciders:** owner + CTO

## Context

Stage 6 needs a real URL a Kenyan contractor can use: HTTPS on a real domain,
API + web, managed PostgreSQL with point-in-time recovery, separate DB roles
(`db_migrator` vs `db_app` so RLS is enforced), secrets in a platform secret
store, and near-zero ops for a solo founder. Pilot scale: a handful of tenants,
low hundreds of requests/day — cost sensitivity is real but reliability and
Kenya latency matter more than shaving a few dollars.

Constraints specific to this product:

- Users are in Kenya; M-Pesa callbacks and field teams on mobile data need
  low latency. Nairobi → Cape Town ≈ 45–60 ms; Nairobi → EU ≈ 140–180 ms.
- Money data must never lose committed transactions → managed Postgres with
  PITR, not a VPS disk snapshot.
- RLS depends on `db_app` being a non-owner role → the platform must let us
  create roles and run `prisma migrate deploy` as `db_migrator` then
  `psql -f rls.sql` as a privileged role.
- Simulated M-Pesa/SMS/eTIMS stay labelled "simulated" — no provider contracts
  needed yet.

## Options considered

### Option A — AWS `af-south-1` (Cape Town)

- **Latency:** best realistic option (~50 ms to Nairobi).
- **Postgres:** RDS PostgreSQL, automated backups + PITR (35-day window),
  creates custom roles fine.
- **Secrets:** Secrets Manager / SSM; env injection via task definition or
  user-data — nothing in the repo.
- **Deploy:** ECR + ECS Fargate (or EC2 + systemd). More moving parts than a
  PaaS but all managed; deploy = `docker build` + `aws ecs update-service`.
- **Cost (pilot, USD→KES ≈ 129):**
  - RDS `db.t3.micro` single-AZ Postgres: ~$15/mo
  - Fargate 0.5 vCPU / 1 GB × 2 services (api+web can share one task behind
    ALB, or two small tasks): ~$15–25/mo
  - ALB + Route 53 + data transfer: ~$20/mo
  - **Total ≈ $50–65/mo ≈ KES 6,500–8,400/mo**
- **Ops burden:** medium — IAM, security groups, ALB target groups, deploy
  script. One-time ~half day; afterwards routine.
- **Risks:** AWS complexity for a solo founder; need to be careful with
  security-group/IAM sprawl.

### Option B — Hetzner Cloud (Falkenstein, EU) + Aiven/Crunchy managed Postgres

- **Latency:** ~150–170 ms to Nairobi — acceptable for a web app, noticeable
  on chatty field flows.
- **Postgres:** Aiven or Crunchy Bridge managed PG attached to the VPS —
  real PITR, custom roles supported.
- **Secrets:** platform env / Aiven console; nothing in repo.
- **Deploy:** Docker Compose (api + caddy + web) on a CX22 (~€4.5/mo) or
  CX32; Caddy gives automatic HTTPS on the domain.
- **Cost:**
  - CX22 VPS: ~€4.5/mo
  - Aiven/Crunchy smallest PG: ~$15–25/mo (or self-managed PG on the VPS with
    WAL archiving to object storage for ~€0 extra but weaker PITR story)
  - Domain + backups: ~€1/mo
  - **Total ≈ €20–30/mo ≈ KES 2,800–4,200/mo**
- **Ops burden:** medium-low day-to-day, but *you* own patching, firewall,
  Docker updates, and the backup pipeline — the "solo founder tax" is real.
- **Risks:** single EU region; if Hetzner has an outage, Kenya users feel it.
  Self-managed PG on the VPS is cheaper but PITR becomes DIY.

### Option C — Railway (or Render)

- **Latency:** US/EU regions only (~150–250 ms to Nairobi) — worst of the
  three for field use.
- **Postgres:** Railway Postgres add-on — managed, but PITR is limited
  (backups yes, granular point-in-time no on the cheapest tier); custom roles
  fine.
- **Secrets:** native env-var/secret UI — best-in-class ergonomics.
- **Deploy:** push-to-deploy from GitHub — fastest possible path to a URL.
- **Cost:**
  - API + web services: ~$10–20/mo
  - Postgres add-on: ~$5–15/mo
  - **Total ≈ $15–35/mo ≈ KES 2,000–4,500/mo**
- **Ops burden:** lowest — zero servers to patch.
- **Risks:** weakest durability story (PITR), no African region, pricing
  creeps as usage grows; vendor lock-in on deploy config.

## Decision (recommended)

**Option A — AWS `af-south-1` (Cape Town).**

Rationale: this is a *money* product for Kenyan contractors. ~50 ms latency,
RDS PITR, Secrets Manager, CloudWatch alarms → SNS/email+SMS alerting, and a
clean upgrade path (same architecture scales to prod). The extra ~$30/mo
over Hetzner buys managed everything a solo founder shouldn't hand-roll.

**Fallback if AWS setup stalls:** Option C (Railway) to get a working URL
this week, migrate to AWS before real contractor data lands. Option B is the
budget pick but the ops burden doesn't fit "no new features, just a URL"
phase.

## Consequences

- **Infrastructure as code**: all AWS resources are defined in `infra/`
  (Terraform, AWS provider ~> 5.x). No click-ops. Root account gets MFA;
  day-to-day work uses a non-root deploy role/user with least-privilege IAM
  (ECR push, ECS update, Secrets Manager read on the app secret only).
  No secrets are stored in the repo — Terraform reads them from the platform
  secret store or `TF_VAR_*` at plan/apply time.
- One-time infra work: VPC-lite (default VPC ok for pilot), RDS instance,
  ECR repos, ECS Fargate services behind an ALB, ACM cert on
  `<product-domain>`, Route 53 records, Secrets Manager entries,
  CloudWatch alarm → SNS topic (email/SMS alerting).
- CI: GitHub Actions deploy job runs `prisma migrate deploy` as
  `db_migrator`, then `psql -f rls.sql`, then rolls the service.
- Domain: `<product-domain>` placeholder — owner supplies the real domain before
  provisioning; no example brand names are committed.
- Monthly run cost ≈ KES 6,500–8,400 at pilot scale.

## Data protection (Kenya Data Protection Act 2019)

Personal data will be hosted in `af-south-1` (South Africa) — **outside
Kenya**. Under the DPA 2019 this is a cross-border transfer; the Act permits
it where the destination has an adequate protection regime or via consent /
contractual safeguards. South Africa is not currently listed as an adequate
jurisdiction by ODPC, so we rely on processor agreements and transparency.

Personal data held by the platform:

- User accounts: name, email, phone (Kenyan MSISDN), password hash (bcrypt),
  role, tenant membership.
- Project/business data entered by tenants: client names, site addresses,
  contacts, contract values, invoices — includes third-party personal data
  (clients, subcontractors, suppliers).
- Site photos/diary attachments uploaded by field staff (may incidentally
  capture identifiable people).
- Audit logs: actor ids, IP addresses, user agents, timestamps.

**Open item — owner to obtain legal advice and confirm ODPC registration
obligations** before onboarding real paying tenants. Privacy notice wording
in the product should reflect the af-south-1 hosting location.

## Recovery targets (pilot)

| Metric | Pilot target | Mechanism |
|---|---|---|
| RPO | ≤ 5 minutes | RDS automated backups + transaction logs (PITR, 7-day retention on pilot tier) |
| RTO | ≤ 4 hours | Snapshot restore to a new instance + redeploy last image; runbook-documented drill |

**Single-AZ RDS is a conscious pilot trade-off**: Multi-AZ doubles the
largest line item (~+$15/mo). We accept a brief outage window during AZ
failure in exchange for pilot cost; Multi-AZ is the documented first prod
upgrade. Deletion protection is ON even on staging to prevent accidents.

## Staging vs production

This ADR covers **staging only** for now (`<product-domain>` staging
environment). Production differences to revisit later: Multi-AZ RDS,
longer PITR retention (35 days), separate AWS account or at minimum separate
VPC/subnets + roles, WAF on the ALB, budget alerts at a lower threshold,
formal on-call rota, and the ODPC/legal sign-off above.

## Rollout gates (owner-confirmed before `terraform apply`)

1. `<product-domain>` confirmed and Route 53 hosted zone created.
2. AWS account ready: root MFA enabled, deploy role created, billing alarm set.
3. `terraform plan` output reviewed and approved.
4. Latency from a Kenyan network measured once staging is live and logged in
   `docs/evidence/staging-*.md`.

