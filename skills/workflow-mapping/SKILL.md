# Skill: workflow-mapping

## When to use
Documenting any module's screens, fields, statuses and transitions — in our product or a studied one.

## Procedure
1. For each screen: name, route/path, purpose, actor(s) who can see it.
2. For each form: every field with name, type (text/number/date/select/file/etc.), required?, validation rules observed, dropdown options.
3. For each entity: lifecycle statuses and every allowed transition, who can trigger it, what approval/audit it creates.
4. Note triggers/automations (notifications, number sequences like `CO-2026-0001`, calculated fields).
5. Note empty states, error states, bulk actions, import/export.
6. Draw state transitions as Mermaid `stateDiagram-v2`; draw flows as Mermaid `flowchart` or sequence diagrams.

## Checklist
- [ ] Every status has at least one inbound and (unless terminal) one outbound transition documented
- [ ] Approval chains name the role, not just "manager"
- [ ] Numbering sequences and auto-calculations recorded
- [ ] Cross-module data flow noted (e.g. variation → budget → certificate)
- [ ] Anything not reachable is listed under "Not reachable" — never invented

## Output template (per module file)
```
# <Module>
Purpose / Users / Screens (table) / Fields (table) / Statuses & transitions (Mermaid) / Approvers / Automations / Numbering / Cross-module flow / Empty & error states / Bulk & import-export / Not reachable
```

## Common mistakes
- Documenting what the UI *suggests* rather than what was observed — mark `[INFERRED]`.
- Missing reversal/cancel paths (void, reject, revert).
- Ignoring permission differences between roles on the same screen.
