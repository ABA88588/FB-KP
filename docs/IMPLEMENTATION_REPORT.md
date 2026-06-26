## Phase 1 UI / Demo implementation

### 已完成
- 初始化 pnpm workspace、Turborepo、Next.js App Router、TypeScript strict 基础结构。
- 完成 AppShell、Sidebar、Topbar、DemoModeBanner、KPI、图表、表格、筛选、列管理、批量操作、详情抽屉、确认框、创建向导、报表、同步错误、素材中心和设置页。
- 实现 Demo Provider，所有写操作仅修改本地演示数据，不请求真实 Meta。
- 实现 Loading、Empty、Error、Permission denied、Token expired 等状态入口，可通过 `?state=` 触发。
- 增加 Vitest 单测和 Playwright 1440x900 截图测试。

### 尚未实现
- 真实 Auth、数据库、Better Auth、Prisma migration、Worker、Redis、Meta OAuth、LiveMetaAdsProvider。
- 真实服务端分页、真实 Meta 同步、真实写操作守卫落库、真实 CSV Worker。
- shadcn/ui 组件生成未接入，当前为本地紧凑型业务组件。

### 验证
- `pnpm.cmd lint`：通过。
- `pnpm.cmd typecheck`：通过。
- `pnpm.cmd test`：通过，6 个单测通过。
- `pnpm.cmd build`：通过。
- `pnpm.cmd e2e`：通过，使用 `expect(page).toHaveScreenshot()` 对比 `screenshots/` 参考图，并输出 6 张实际截图到 `test-results/ui/`。

## 2026-06-26 QA / CI update

### CI 覆盖
- GitHub Actions 主质量门禁安装依赖使用 `pnpm install --frozen-lockfile`。
- CI 覆盖 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm e2e`。
- CI 上传 `playwright-report`、`test-results/playwright` 和 `test-results/ui` artifacts。
- 新增 Docker build/config validation job：发现 Dockerfile 时执行 `docker build`，发现 compose 文件时执行 `docker compose config`；没有对应文件时记录跳过。真实容器运行仍需目标服务器、域名、secrets 和数据卷输入。

### 新增受控测试
- `apps/web/tests/demo-provider.test.ts` 增加 Demo Provider 模拟写操作不触发 `fetch` 的网络隔离测试。
- `packages/shared/src/env.test.ts` 覆盖 env boolean/allowlist 解析、Meta Graph API version 校验和外部输入 readiness 标记。
- `packages/shared/src/authz.test.ts` 覆盖角色权限和 Meta 写入守卫的允许/拒绝原因。

### 仍需外部输入验收
- 真实 Meta OAuth、Meta App 审核权限、真实测试广告账户、Graph API/Insights/分页/错误映射尚未验收。
- 真实服务器、PostgreSQL、Redis、Worker、token 加密和部署 URL 尚未验收。
- Docker 镜像运行、域名/TLS、secrets、数据卷和回滚需要目标服务器输入后才能完成真实验收。

### 本次本地验证
- `pnpm.cmd --filter @adflow/shared test`：通过，2 个测试文件、6 个用例。
- `pnpm.cmd --filter @adflow/web test`：通过，1 个测试文件、8 个用例。
- `pnpm.cmd test`：通过，3 个 package test task 成功。
- `pnpm.cmd build`：通过。
- `pnpm.cmd e2e`：通过，25 个 Playwright 用例通过。
- 定向 ESLint：`packages/shared/src/*.test.ts` 和 `apps/web/tests/demo-provider.test.ts` 通过。
- `pnpm.cmd --filter @adflow/web typecheck`：通过。
- `pnpm.cmd lint`：未通过，阻塞来自本任务范围外的 `packages/shared/src/crypto.ts`、`packages/shared/src/env.ts` typed ESLint 错误。
- `pnpm.cmd typecheck`：未通过，阻塞来自本任务范围外的 `packages/shared/src/authz.ts`、`packages/shared/src/crypto.ts`、`packages/shared/src/env.ts` TypeScript 错误。

## 2026-06-26 Productionization update

### Completed in this branch
- Added permanent production rules to `AGENTS.md`: immutable `screenshots/`, server-only Meta Graph access, no frontend secrets, Demo provider and Live provider separation, guarded real writes, PAUSED default object creation, audit requirements, and no fake success states.
- Added deployment assets: production Dockerfiles, `docker-compose.prod.yml`, Caddy reverse proxy config, `.env.production.example`, server bootstrap/deploy/backup/restore/rollback/healthcheck scripts, and self-hosting/runbook docs.
- Added server auth/environment/security foundations, health and readiness API routes, token encryption helpers, role/write guards, and readiness metadata.
- Added `LiveMetaProvider` foundations under `packages/meta-client`, including Graph API version registry, appsecret proof, cursor pagination helpers, read/write boundaries, write guard integration, and tests.
- Added a separate `@adflow/worker` workspace package with BullMQ queue runtime, Redis connection, bounded retry helpers, health/heartbeat endpoints, graceful shutdown, and tests.
- Added frontend login/onboarding/settings/connectivity paths and Live/Demo adapter boundaries so unconfigured live mode does not silently fall back to demo fixtures.
- Added GitHub Actions for install, lint, typecheck, test, build, e2e, Playwright artifacts, UI screenshot artifacts, and Docker config/build validation.
- Kept `pnpm-workspace.yaml` constrained to `allowBuilds: { "sharp@0.34.5": true }`; no `dangerouslyAllowAllBuilds`, no strict dependency build disablement, and no committed `--no-optional` usage.

### Current local validation evidence
- PASS: `packages/shared` direct `tsc --noEmit`.
- PASS: `packages/shared` direct ESLint.
- PASS: `packages/meta-client` direct `tsc --noEmit`.
- PASS: `packages/meta-client` direct ESLint.
- PASS: `apps/web` direct `tsc --noEmit`.
- PASS: `apps/web` direct ESLint.
- PASS: `apps/worker` direct `tsc --noEmit`.
- PASS: `apps/worker` direct ESLint.
- PASS: `apps/worker` direct Vitest, 1 file / 4 tests.
- PASS: `git diff --check`.
- PASS: `screenshots/` has no working-tree changes.

### Current local blockers
- `pnpm install --frozen-lockfile` on this Windows workstation reached dependency linking, then failed once with `EPERM` while renaming the local `sharp@0.34.5` package directory. A clean retry without `--no-optional` hung in the same local linking phase with no further output for several minutes.
- Because the local `node_modules` install could not complete after the clean reinstall attempt, root-level `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm e2e` could not be rerun in this workstation state.
- Docker build/config validation was not run locally because Docker is not available in this workspace. The CI job now injects CI-only compose variables before `docker compose config`.

### External inputs still required
- SSH/root access or an already provisioned deploy user for `89.208.252.84`.
- Production domain and DNS target for Caddy/TLS.
- Real `.env.production` secrets: database password, Redis password, auth secret, token encryption key, Meta App ID, Meta App secret, OAuth redirect URI, and allowed Meta ad account IDs.
- Meta App review/write permission approval and a real test ad account before enabling real writes.
