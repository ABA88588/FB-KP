# Package manifest

## Give these files to Codex first

1. `CODEX_MASTER_PROMPT.md` — paste this into Codex as the top-level task.
2. `AGENTS.md` — repository-wide implementation rules.
3. `START_HERE.md` — reading order and execution instructions.
4. `CODEX_HANDOFF_PROMPT.md` — phase-scoped copy/paste prompts.
5. `OWNER_INPUTS.template.md` — non-secret owner decisions and project inputs.
6. `PRE_FLIGHT_CHECKLIST.md` — repository, Codex, and Meta preflight checks.

## Product and engineering specifications

- `docs/01-product-spec.md`
- `docs/02-ui-ux-spec.md`
- `docs/03-architecture.md`
- `docs/04-meta-api-contract.md`
- `docs/05-security-compliance.md`
- `docs/06-testing-acceptance.md`
- `docs/07-delivery-plan.md`
- `docs/08-official-references.md`
- `docs/09-meta-app-setup-template.md`

## Machine-readable contracts

- `api/openapi.yaml`
- `db/schema.prisma`
- `db/prisma.config.example.ts`
- `design/tokens.json`
- `.env.example`

## UI/UX assets

- `prototype/index.html` — interactive static prototype.
- `prototype/styles.css`
- `prototype/app.js`
- `screenshots/` — key page references.
- `design/component-inventory.md`
- `design/user-flows.mmd`

## Codex operating aids

- `.agents/skills/meta-ads-implementation/SKILL.md`
- `docs/DECISIONS.template.md`
- `docs/IMPLEMENTATION_REPORT.template.md`

## Source of truth order

When documents conflict, use this precedence:

1. `AGENTS.md`
2. `docs/05-security-compliance.md`
3. `docs/04-meta-api-contract.md`
4. `api/openapi.yaml`
5. `docs/01-product-spec.md`
6. `docs/02-ui-ux-spec.md`
7. Prototype visuals
