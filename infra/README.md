# infra/ — staging environment (Terraform, ADR-012 Option A)

Region: `af-south-1` (Cape Town). Environment: `staging`.
Domain: `<product-domain>` — supplied by owner before apply.

## Bootstrap (one-time)

1. AWS account: root MFA on. Apply the state backend first:
   ```bash
   cd infra/bootstrap && terraform init && terraform apply
   ```
   This creates `<product>-tfstate` (versioned, encrypted, private) and
   `<product>-tf-locks` (DynamoDB). Then uncomment the `backend "s3"`
   block in `main.tf`, paste the `backend_config` output, and run
   `terraform init -migrate-state` in `infra/`.
2. Route 53 hosted zone for `<product-domain>` must exist; note its ID.
3. Set secrets (values never in repo):
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id sitesafi-staging/app-env \
     --secret-string '{"DATABASE_URL":"...","JWT_SECRET":"...", ...}'
   ```
   The RDS master secret is created automatically
   (`sitesafi-staging-pg` in Secrets Manager).
4. `terraform init && terraform plan -var product_domain=<domain> -var hosted_zone_id=<zone> -var alert_email=<you>`
   Review the plan, then `terraform apply`.
5. DB roles: run `scripts/bootstrap-db.sh` as the master user — it creates
   `db_migrator` and `db_app`, both explicitly `NOSUPERUSER NOBYPASSRLS`
   (db_app additionally gets no CREATEDB/CREATEROLE; db_migrator gets
   `CREATE ON DATABASE` for DDL only). Then `prisma migrate deploy` as
   `db_migrator` and `psql -f packages/db/prisma/rls.sql`.
6. CI: GitHub Actions assumes `github_deploy_role_arn` via OIDC — no AWS
   keys in the repo. The trust policy only accepts tokens from
   `repo:<owner>/<repo>:ref:refs/heads/main` or
   `repo:<owner>/<repo>:environment:staging`.

## GitHub environment gate (required reviewers)

The deploy role trusts the `staging` environment claim, so protection
rules live in GitHub, not Terraform:

1. Repo → Settings → Environments → New environment `staging`.
2. Enable **Required reviewers** (the owner/auditor).
3. The deploy workflow must declare `environment: staging` on the deploy
   job — jobs without it can only assume the role from `main` pushes.

## SES setup checklist (transactional email)

`no-reply@<product-domain>` will NOT send until all of these are done:

1. **Verify the domain identity**: SES console → Verified identities →
   Create → Domain `<product-domain>` → add the DKIM CNAMEs Route 53
   provides (or `aws sesv2 create-email-identity --email-identity
   <domain>` then publish the DKIM tokens).
2. **Request production access**: SES is in sandbox by default — sandbox
   only sends to verified addresses. Request production access (console →
   Account dashboard → Request production access) with a use-case
   description; approval is usually 24–48h.
3. **MAIL FROM domain** (recommended): configure
   `bounce.<domain>` MAIL FROM + SPF/DKIM so bounce handling and DMARC
   alignment work; otherwise set a custom MAIL FROM or accept the
   amazonses.com default.
4. **DMARC**: publish `_dmarc.<domain>` TXT (`v=DMARC1; p=none; rua=...`
   to start) — Kenyan corporate mail filters increasingly check it.
5. **IAM**: the task role already allows `ses:SendEmail`/`SendRawEmail`
   conditioned on `*@<product-domain>` — verify the condition matches the
   verified identity.
6. **Smoke test**: trigger a password-reset email on staging and confirm
   delivery + a clean bounce path before pilot users rely on invites.

## Guardrails now in the stack

- `aws_budgets_budget` — monthly USD budget (`monthly_budget_usd`,
  default 100) with 80%/100% ACTUAL alerts to `alert_email`.
- `aws_cloudtrail` — multi-region trail, log-file validation, global
  service events → private versioned S3 bucket (365-day expiry).
- `aws_guardduty_detector` — regional threat detection enabled.
- GitHub deploy OIDC restricted to `main` + `staging` environment.

## Rotate / reset

See `docs/RUNBOOK.md`.
