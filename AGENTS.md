# AGENTS.md

## Mission

Build and maintain the Meta ads management application defined by `CODEX_MASTER_PROMPT.md` and `docs/`. Treat these files as product contracts, not suggestions.

## Required reading order

1. `CODEX_MASTER_PROMPT.md`
2. `docs/01-product-spec.md`
3. `docs/02-ui-ux-spec.md`
4. `docs/03-architecture.md`
5. `docs/04-meta-api-contract.md`
6. `docs/05-security-compliance.md`
7. `api/openapi.yaml`
8. `db/schema.prisma`
9. `docs/06-testing-acceptance.md`
10. `docs/07-delivery-plan.md`

## Engineering rules

- TypeScript strict mode is mandatory.
- Prefer small, typed modules with explicit boundaries.
- Do not use `any` except at a validated external JSON boundary; narrow immediately with Zod.
- All external input, environment variables and Meta responses must be validated.
- All money values use Decimal or integer minor units.
- All dates are explicit ISO strings and account-timezone aware.
- All user-facing text is centralized for future localization.
- Never log access tokens, app secrets, authorization headers, PII or full targeting payloads.
- Never expose Meta tokens to browser code.
- No Graph endpoint construction outside `packages/meta-client`.
- No direct database calls from React client components.
- No unbounded Meta pagination or unbounded worker retries.
- No placeholder buttons or fake success messages.

## Commands

Use workspace scripts so CI and local behavior match:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

## Change discipline

- Before a cross-cutting change, record the decision in `docs/DECISIONS.md`.
- Update OpenAPI and Zod schemas together.
- Update database migrations and generated client together.
- Add or update tests with every behavior change.
- Keep demo fixtures deterministic.
- Keep the application runnable after each phase.

## Permanent production rules

- `screenshots/` is an immutable design baseline. Actual generated screenshots belong under `test-results/ui/`.
- Browser code must never call Meta Graph or Marketing API directly; all Meta requests go through this server.
- Meta App Secret, Access Token, database passwords, SSH private keys and all other secrets must never enter frontend code, Git, logs, test screenshots, error responses or copied command arguments.
- `DemoProvider` and `LiveMetaProvider` must stay fully separated. Production Live mode must never mix simulated data into live views.
- Real Meta writes require server-side permission checks, ad-account allowlist checks, explicit user confirmation, audit logging and a stable `operationId`.
- New Campaign, Ad Set and Ad objects must default to `PAUSED`.
- Never report local success, generated demo IDs or queued internal tasks as completed Meta success.
- Do not make builds pass by deleting tests, lowering TypeScript strictness, adding broad `any`, skipping quality gates or relaxing visual thresholds.
- Database changes must use reversible migrations or document a precise rollback/fix-forward path.
- Remote server write operations are performed by exactly one deployment agent/process at a time.
- All validation commands must be run for real before reporting PASS. If a command was not run, report it as not run.
- Real Meta mutation retries must be bounded and must not silently retry non-idempotent creates after unknown outcomes.
- Frontend disabled states must explain which guard blocked the action: mode, role, scope, allowlist, readonly account or global emergency readonly switch.

## UI discipline

- Match the supplied prototype and design tokens.
- Desktop-first, dense operational UI; no landing-page styling.
- Preserve keyboard navigation, visible focus, labels and contrast.
- Show loading, empty, stale, partial and error states.
- Display account currency, timezone and data freshness.

## Meta safety

- Default to read-only.
- Gate every mutation with environment, scope, role and account checks.
- Add `appsecret_proof` to server Graph requests.
- Respect cursor pagination, rate-limit headers and transient error semantics.
- Do not blindly retry object creation.
- Never use unofficial Ads Manager endpoints or session cookies.

## Definition of done

A task is done only when code, tests, documentation and UI state handling are complete and the relevant commands pass. Report unresolved issues accurately in `docs/IMPLEMENTATION_REPORT.md`.
