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
