# Terraform plan evidence — 2026-11-14 (tree @ e52405a)

Phase E step 1. **No apply performed.** Awaiting owner "approved".

## Commands run

```
cd infra
terraform init -backend=false -input=false
terraform validate
terraform plan -input=false \
  -var product_domain=sitesafi.example.co.ke \
  -var hosted_zone_id=Z0000000000000000000 \
  -var alert_email=ops@example.co.ke \
  -var alert_phone=+254700000000
```

## Observed results

- `terraform init` — OK (local backend; S3 backend block remains
  commented pending bootstrap, see infra/README.md).
- `terraform validate` — **Success! The configuration is valid.**
- `terraform plan` — **NOT REACHED.** Provider auth failed before any
  resource planning:

  ```
  Error: No valid credential sources found
    with provider["registry.terraform.io/hashicorp/aws"], on main.tf line 25
  Error: failed to refresh cached credentials, no EC2 IMDS role found
  ```

  No AWS credentials exist on this machine (`~/.aws` has no config;
  no env vars). A real plan requires the owner to supply an AWS
  account + credentials — recorded as open decision #7 in
  `docs/decisions-needed.md`.

  The plan output did show the two computed outputs before failing:
  `api_url = "https://api.sitesafi.example.co.ke"`,
  `app_url = "https://app.sitesafi.example.co.ke"`.

## Resource inventory (from infra/main.tf — what apply WOULD create)

| # | Resource | Count | Purpose |
|---|----------|-------|---------|
| 1 | `aws_security_group` alb / app / db | 3 | ALB public 80/443; tasks from ALB only; Postgres from tasks only |
| 2 | `aws_db_subnet_group` + `aws_db_instance` | 2 | RDS Postgres 16, db.t3.micro, 20 GB gp3, single-AZ, encrypted, 7-day PITR, deletion protection |
| 3 | `aws_secretsmanager_secret` app_env (+ RDS-managed master secret) | 2 | Runtime env + DB master creds — populated out-of-band |
| 4 | `aws_s3_bucket` uploads + public-access-block + SSE + versioning + lifecycle | 5 | Private uploads bucket, AES256, versioned, abort stale multipart |
| 5 | `aws_ecr_repository` api / web | 2 | Immutable tags, scan-on-push |
| 6 | `aws_ecs_cluster` + task definitions api/web + services api/web | 5 | Fargate: api 0.5 vCPU/1 GB, web 0.25 vCPU/512 MB, 1 task each |
| 7 | `aws_iam_role` task-execution + task + `aws_iam_role_policy*` | 6 | Exec role (ECR/logs/secrets), task role (S3 objects, SES send scoped to @domain) |
| 8 | `aws_lb` + 2 target groups + https listener + http redirect + api path rule | 6 | ALB, TLS1.3 policy, /api/* → api, rest → web |
| 9 | `aws_acm_certificate` + validation + `aws_route53_record` cert/app/api | ~5 | Wildcard+apex cert, DNS-validated, app./api. aliases |
| 10 | `aws_cloudwatch_log_group` api/web + 2 metric alarms | 4 | 30-day logs, ALB 5xx + unhealthy-host alarms |
| 11 | `aws_sns_topic` + email sub + optional SMS sub | 2–3 | Alarm delivery to owner email/phone |
| 12 | `aws_iam_role` github_deploy + policy | 2 | OIDC deploy role — ECR push + ECS update, no long-lived keys |

~38 resources total. Data sources: default VPC, public subnets,
AZs, GitHub OIDC provider.

## Estimated monthly cost — af-south-1 (ESTIMATED, not billed)

Exchange rate ~KES 129/USD. Figures are planning estimates; confirm
against the AWS Pricing Calculator once the account exists.

| Resource | ~USD/mo | ~KES/mo |
|----------|---------|---------|
| ALB (base + LCU) | 22 | 2,800 |
| Fargate api (0.5 vCPU / 1 GB) | 21 | 2,700 |
| Fargate web (0.25 vCPU / 512 MB) | 10 | 1,300 |
| RDS db.t3.micro 20 GB gp3 single-AZ | 18 | 2,300 |
| Secrets Manager ×2 | 1 | 130 |
| S3 uploads (low GB) | 1 | 130 |
| CloudWatch logs + alarms | 3 | 390 |
| Route 53 hosted zone | 0.5 | 65 |
| ECR storage | 0.5 | 65 |
| SNS (email free; SMS per-msg) | ~0 | ~0 |
| Data transfer (pilot volume) | 5–15 | 650–1,900 |
| **Total** | **~$82–92** | **~KES 10,600–11,800/mo** |

## Biggest risks

1. **Plan never executed — zero AWS-side verification.** Default-VPC
   assumptions, resource name collisions, service quotas, and the
   ACM→Route53→ALB dependency chain are all unproven. First real plan
   may surface conflicts (e.g. default VPC subnets in <2 AZs, existing
   `sitesafi-*` names). Blocker: AWS account + credentials.
2. **Email deliverability on staging.** `SES_FROM=no-reply@<domain>`
   requires a verified SES domain identity AND SES production access
   (out of sandbox) — otherwise invite/reset emails silently fail.
   DNS verification is another dependency on decision #1.
3. **Pilot-grade availability trade-offs are deliberate but real:**
   single-AZ RDS (ADR-012), Fargate tasks with public IPs and no NAT
   gateway (egress cost vs. exposure), 7-day PITR vs. 35-day prod
   target, secrets populated manually post-apply. Staging must not be
   treated as production-hardened.

## State / backend note

Backend is local (`infra/terraform.tfstate`, gitignored). Before any
real apply, bootstrap the S3 state bucket + DynamoDB lock table
(infra/README.md) — otherwise state lives on one laptop.

**STOP — no apply until owner replies "approved" in the PR.**
