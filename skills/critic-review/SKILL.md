# Skill: critic-review

## When to use
Every gate and every milestone, by a reviewer who did NOT build the deliverable. The critic's findings must be resolved or explicitly accepted by the owner before a gate passes.

## Attack surface (check each)
1. **Will it break?** Edge cases: empty states, concurrent users, retries, timezones (EAT), currencies, huge BOQs, offline-then-online sequences.
2. **What's over-engineered?** Anything a solo founder can't operate, debug, or pay for. Flag with simpler alternative.
3. **What's missing?** Error paths, permissions, audit, mobile, low-bandwidth, the "second time someone uses this" flow.
4. **What's unjustified?** Every `[ASSUMPTION]` and `[INFERRED]` claim that downstream work depends on.
5. **What's fabricated?** Numbers, testimonials, competitor claims, "verified" labels without evidence (see R-026, R-016).

## Severity scale
- **Critical**: data leak, money wrong, security hole, data loss → blocks gate.
- **High**: broken core flow, scope/buyer risk → fix before milestone done.
- **Medium**: quality/test gaps → fix within next milestone.
- **Low**: polish → batch.

## Output template — `CRITIC_REVIEW_<thing>.md`
```
# Critic review: <deliverable>
Reviewer: | Date: | Verdict: PASS / PASS-WITH-CONDITIONS / FAIL
## Findings (table: ID | severity | finding | required resolution)
## Explicit answers (for design gate: each checklist item YES/NO + why)
## Conditions for approval
```

## Rules
- The critic never fixes what it finds — it reports; the owner role fixes.
- "Looks fine" without checking the attack list is an invalid review.
- Findings the owner accepts-as-risk must be recorded in REMEDIATION_PLAN.md with reason.
