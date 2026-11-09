# Skill: data-modelling

## When to use
Inferring or reviewing the data model — studied product or ours.

## Procedure
1. List entities observed (tables implied by list screens, detail pages, exports, API payloads).
2. For each: key fields, types, required?, enumerations/statuses, soft-delete or archive behaviour.
3. Relationships + cardinality (project 1—* BOQ lines; variation *—1 project).
4. Produce Mermaid `erDiagram`.
5. Check invariants: multi-tenancy key on every entity? audit fields (created_by/at, updated_by/at)? money fields?
6. Money rule: integer minor units or Decimal — never float. Record currency per record/tenant.

## Checklist
- [ ] Every entity has tenant/company scoping identified (or flagged as global)
- [ ] Status enums complete with transitions cross-referenced to workflow-mapping output
- [ ] Money, quantity, rate precision rules stated
- [ ] Soft-delete vs hard-delete behaviour noted per entity
- [ ] Audit-trail fields identified

## Output template
`05_data_model.md`: entity catalogue (table), Mermaid ERD, invariants list, open questions.

## Common mistakes
- Missing join/link entities (project_members, portal links).
- Treating UI-only concepts (dashboard widgets) as entities.
- Forgetting numbering sequences and versioning (BOQ V1/V2 superseded).
