# infra/ — staging environment (Terraform, ADR-012 Option A)

Region: `af-south-1` (Cape Town). Environment: `staging`.
Domain: `<product-domain>` — supplied by owner before apply.

## Bootstrap (one-time)

1. AWS account: root MFA on; create the S3 state bucket
   `<product>-tfstate` + DynamoDB lock table `<product>-tf-locks`
   (or uncomment the `backend "s3"` block in `main.tf`).
2. Route 53 hosted zone for `<product-domain>` must exist; note its ID.
3. Set secrets (values never in repo):
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id siteforge-staging/app-env \
     --secret-string '{"DATABASE_URL":"...","JWT_SECRET":"...", ...}'
   ```
   The RDS master secret is created automatically
   (`siteforge-staging-pg` in Secrets Manager).
4. `terraform init && terraform plan -var product_domain=<domain> -var hosted_zone_id=<zone> -var alert_email=<you>`
   Review the plan, then `terraform apply`.
5. DB roles: run `scripts/bootstrap-db.sh` as the master user to create
   `db_migrator` (CREATEDB) and `db_app` (NOSUPERUSER, used by the app so RLS
   applies), then `prisma migrate deploy` as `db_migrator` and
   `psql -f packages/db/prisma/rls.sql`.
6. CI: GitHub Actions assumes `github_deploy_role_arn` via OIDC — no AWS keys
   in the repo. Build/push both images, `aws ecs update-service`, run the DB
   bootstrap + migrate step.

## Rotate / reset

See `docs/RUNBOOK.md`.
