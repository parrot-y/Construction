# Skill: adr-writing

## When to use
Any decision that is expensive to reverse: stack choice, tenancy model, money handling, auth approach, integration pattern, offline sync design. Also when the critic finds a disputed tradeoff.

## Procedure
1. Check `docs/adr/` for existing ADRs; number the next one (ADR-00N).
2. Write: **Context** (forces at play), **Options** (≥2 real options with honest tradeoffs), **Decision**, **Consequences** (good and bad), **Status** (proposed/accepted/superseded).
3. Reference evidence: test names, benchmarks, owner decisions.
4. An ADR is required BEFORE implementing the decision, not after.

## Checklist
- [ ] Options are genuinely different, not strawmen
- [ ] Reversal cost stated
- [ ] Linked from PROJECT_STATUS decisions log
- [ ] Superseded ADRs get a pointer, never deleted

## Template
```
# ADR-NNN: <title>
Status: proposed | Date: | Deciders:
## Context
## Options
### Option A ... ### Option B ...
## Decision
## Consequences
```

## Common mistakes
- ADRs that just restate the decision without alternatives.
- Writing ADRs for trivial choices (wastes review time).
- Never revisiting — status must be updated when reality diverges.
