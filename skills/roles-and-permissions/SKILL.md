# Skill: roles-and-permissions

## When to use
Deriving or reviewing any role/permission model — ours or a studied product's.

## Procedure
1. Enumerate every role visible in the product (invite screens, role pickers, "viewing as" switchers, settings).
2. Build a matrix: rows = roles, columns = module × action (view/create/edit/approve/delete/export).
3. For each cell record evidence: observed allowed/denied, or `[INFERRED]` from UI hints. Never guess a permission you could not observe — mark "Not reachable".
4. Check separation of duties: can one role both create AND approve the same financial record? Flag violations.
5. Check approval chains: multi-step vs single-step, delegation, escalation.
6. Check invitation flow: who can invite, what role options exist, token expiry, acceptance.

## Checklist
- [ ] Every role has a default landing view / dashboard documented
- [ ] Matrix cells all have evidence tags
- [ ] SoD conflicts listed explicitly
- [ ] Custom-role capability noted if present
- [ ] Client/external roles separated from staff roles

## Output template
`02_roles_permissions.md`: role catalogue table, permission matrix (Markdown table), SoD findings, invite flow description, per-role navigation map.

## Common mistakes
- Assuming roles symmetric across modules.
- Missing implicit permissions granted by "admin" wildcards.
- Forgetting portal/external-token access which bypasses normal login.
