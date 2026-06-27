# Decisions

## 2026-06-26 QA / CI gate

- GitHub Actions 使用 `pnpm install --frozen-lockfile`，保留 optional dependency 安装，以保证 Next.js、Turbo、Playwright 等平台相关依赖的正常安装路径。
- CI 不降低 SSH host key 校验，当前 workflow 也不需要 SSH 连接。
- 主质量门禁继续运行在 `windows-latest`，覆盖当前 lockfile 中 Windows native dependency 组合：`lint`、`typecheck`、`test`、`build`、`e2e`。
- Playwright artifact 从仓库根目录上传：`playwright-report`、`test-results/playwright`、`test-results/ui`。这些路径与 `apps/web/playwright.config.ts` 中的 `../../` 输出路径一致。
- Docker validation 独立运行在 `ubuntu-latest`。CI 会在仓库前三层目录内发现 Dockerfile 并用仓库根目录作为 build context 执行 `docker build`；也会发现 `docker-compose*.yml/.yaml` 和 `compose*.yml/.yaml` 并执行 `docker compose ... config`。没有对应文件时，CI 明确记录跳过。
- 本次新增测试限定为受控 mock / 本地契约测试：Demo Provider 不触发 `fetch`，env 解析记录外部输入缺口，Meta 写入守卫必须同时满足开关、角色、scope、账户 allowlist、只读状态和连接健康。

## Pending real acceptance

- 真实 Meta OAuth、Graph API、Insights、分页、错误映射和写操作防护仍需要外部 Meta App、测试账户和服务器环境。
- 真实 Docker 运行验收需要目标服务器、域名、secrets、数据卷和回滚策略。
- Mock 测试通过不能替代 Meta 审核、真实 token、真实服务器或真实数据同步验收。
