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

## 8. Client-portal certificate visibility (resolved — flagged for owner awareness)

Payment certificates have no `APPROVED` status; the lifecycle is
DRAFT → SUBMITTED → UNDER_REVIEW → CERTIFIED → PAID (+ REJECTED).
**Decision taken (F1 audit fix):** the client token portal and the
authenticated client console expose only `CERTIFIED` and `PAID`
certificates — i.e. documents the contractor has actually issued.
`SUBMITTED`/`UNDER_REVIEW` are internal review stages, `DRAFT`/`REJECTED`
are never client-visible. Invoices show `SENT`/`PART_PAID`/`PAID`
(`OVERDUE` is derived downstream); `DRAFT`/`VOID` stay internal.
If the owner wants clients to see certificates at `UNDER_REVIEW`
(pre-issue visibility), that is a product decision to revisit.

## 9. Client acknowledgement of practical completion — binding or record-only? (Stage 6)

The client portal now lets the client acknowledge practical completion with a
typed name; it is recorded once per project (`practical_completion_acknowledgements`),
audit-logged, and shown to the contractor team.

- **Option A (implemented):** record-only acknowledgement — evidence the client
  saw the certificate, no contractual effect. DLP clocks and retention release
  continue on the certificate dates regardless.
- **Option B:** binding acceptance — acknowledgement (or silence past a deadline)
  becomes the contractual trigger for the defects liability period and first
  retention moiety.
- **Recommendation:** A for the pilot — JBC 1999 practical-completion
  certificates are issued by the consultant; client acknowledgement is useful
  evidence but should not silently start contractual clocks without owner/legal
  sign-off. Revisit if the pilot contractor's contracts require it.

## 10. Consultant snag rejection status (Stage 6)

A consultant portal rejection sets the snag to `REJECTED` with a mandatory
reason (>=15 chars) and photo evidence, and records a snag comment. Previously
`REJECTED` was a dead end in the internal transition map — it now allows
`IN_PROGRESS`/`READY_FOR_REVIEW` so the contractor can send it back for rework.

- **Option A (implemented):** `REJECTED` is a visible "sent back" state the
  contractor must actively move to `IN_PROGRESS`.
- **Option B:** rejection returns the snag directly to `IN_PROGRESS` — simpler
  but loses the "was rejected by the consultant" signal in status reports.
- **Recommendation:** A — the audit trail and snag comments already carry the
  rejection detail; keeping a distinct status makes closeout reporting honest
  (a rejected snag still blocks CLOSED until re-verified).
