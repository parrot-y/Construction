# Decisions needed from the owner

Phase E (staging) is blocked on these. Each has two options and a
recommendation; nothing below has been decided or implemented unilaterally.

## 1. Domain name

- **Option A:** Register a new `.co.ke` domain for SiteSafi (e.g. `sitesafi.co.ke`). Clean brand, full DNS control in Route 53.
- **Option B:** Use a subdomain of an existing company domain.
- **Recommendation:** A — the product name is the brand; a dedicated domain avoids coupling to any single contractor or agency. Needed before ACM certificate validation and Route 53 records can be created.

## 2. Trademark clearance

- **Option A:** Commission a search via KIPI (Kenya) before launch marketing.
- **Option B:** Proceed and file later.
- **Recommendation:** A — cheap relative to a rebrand; "SiteSafi" should be checked against existing construction/proptech marks in classes 9, 35, 42.

## 3. Legal text for Terms / Privacy

- **Option A:** Owner supplies approved text (lawyer-reviewed).
- **Option B:** SiteSafi drafts placeholder text clearly marked for review.
- **Recommendation:** A for production; B is acceptable for the staging pilot as long as the pages are labelled draft. Current `/terms` and `/privacy` routes exist but the text is not legally reviewed.

## 4. Pilot contractor

- **Option A:** A single friendly contractor runs real projects on staging/pilot.
- **Option B:** Internal/demo tenant only until a contractor commits.
- **Recommendation:** A — the pilot's value is real usage data (F2 adoption metrics). Needs a named company, a real project, and a rollback plan.

## 5. Real M-Pesa / SMS / WhatsApp / eTIMS / Paystack go-live

- **Option A:** Keep all integrations SIMULATED through the pilot; activate real providers only after the pilot proves the workflows.
- **Option B:** Activate M-Pesa (Daraja) and/or Paystack for the pilot tenant only.
- **Recommendation:** A — every payment/messaging surface is honestly labelled SIMULATED today; flipping real money movement on before the audit trail is proven in anger is the biggest avoidable risk. Requires owner sign-off per provider, plus provider credentials and callback URLs.

## 6. Production data residency

- **Option A:** af-south-1 (Cape Town) — current Terraform default per ADR-012; Kenya-facing latency is workable, data stays in-region-ish (South Africa, not Kenya — AWS has no Kenya region).
- **Option B:** eu-west-1 or another region with better Kenya latency but weaker data-residency story.
- **Recommendation:** A — ADR-012 already chose af-south-1; confirm the owner accepts South-Africa residency for Kenyan customer data, or pick a region explicitly.

## 7. AWS account + credentials (added at Phase E step 1)

- `terraform plan` could not run: no AWS credentials exist on the build machine and no account/OU structure has been provided.
- **Needed:** AWS account ID, an IAM principal or SSO profile for Terraform, confirmation of the default-VPC assumption, and the hosted zone ID once the domain (decision 1) exists.
