# Codex 总实施指令：AdFlow Console

你正在实现一个面向广告运营人员的 Meta 广告管理 Web 应用。必须完整读取并遵守本仓库的 `AGENTS.md`、`docs/`、`design/`、`api/openapi.yaml`、`db/schema.prisma` 和 `prototype/`。这些文件共同构成唯一需求来源。

## 1. 最终目标

交付一个可本地启动、可测试、可部署的生产级 MVP，具备：

1. 用户登录、组织与角色权限。
2. Meta OAuth 连接和广告账户选择。
3. 广告总览：花费、曝光、点击、CTR、CPC、CPM、转化、CPA、购买金额和 ROAS。
4. Campaign / Ad Set / Ad 三级管理表格。
5. 搜索、筛选、排序、分页、列管理、保存视图和批量启停。
6. 广告创建向导：Campaign → Ad Set → Creative/Ad → 审核发布。
7. 素材库和广告预览。
8. 自定义报表、日期范围、维度拆分、异步拉取和 CSV 导出。
9. 同步任务、错误中心、数据新鲜度、审计日志。
10. 无真实 Meta 凭证时可完整演示的 Demo Provider。

界面以桌面端为主，中文优先，信息密度高但层次清楚。参考 `prototype/` 的布局和交互，不要照抄 Meta 官方视觉。

## 2. 固定技术决策

除非现有仓库存在无法兼容的明确原因，否则不得擅自更换：

- Monorepo：`pnpm` workspace + Turborepo。
- Runtime：Node.js 24 LTS。
- Web：Next.js 16.2+ App Router、React、TypeScript strict。
- UI：Tailwind CSS、shadcn/ui，使用紧凑型后台风格；图标使用 Lucide。
- 表格：TanStack Table；大数据量启用虚拟滚动或服务端分页。
- 表单：React Hook Form + Zod。
- 图表：Recharts。
- 数据：PostgreSQL + Prisma ORM 7。
- 任务：Redis + BullMQ，独立 Worker。
- 应用身份：Better Auth，数据库 Session，组织和角色模型。
- 测试：Vitest、Testing Library、Playwright。
- API：Next.js Route Handlers，按照 `api/openapi.yaml`。
- 观测：结构化日志，错误与请求关联 ID；不得记录敏感字段。

如必须偏离，先在 `docs/DECISIONS.md` 写明：问题、证据、替代方案、影响、回滚方式。不能因为个人偏好改栈。

## 3. 目标目录

```text
apps/
  web/                    # Next.js UI 与内部 API
  worker/                 # BullMQ 同步和异步报表任务
packages/
  db/                     # Prisma schema、client、seed
  meta-client/            # Meta Provider 接口、Live 与 Demo 实现
  shared/                 # Zod schema、类型、常量、格式化
  ui/                     # 可复用业务组件
  config/                 # ESLint、TSConfig、环境变量校验
infra/
  docker-compose.yml      # PostgreSQL、Redis
  README.md
fixtures/
  meta/                   # 确定性演示数据与错误样例
docs/
```

## 4. 实施规则

### 4.1 先检查，再修改

- 检查当前仓库、package manager、已有架构和测试。
- 如果仓库为空，按目标目录初始化。
- 如果已有代码，保留可用代码；先写迁移计划，不得无理由重写。
- 每次修改保持小而可验证，避免一次性生成无法运行的大量代码。

### 4.2 Provider 隔离

必须定义统一接口，例如：

```ts
interface MetaAdsProvider {
  listAdAccounts(input: ListAdAccountsInput): Promise<Page<AdAccount>>;
  listCampaigns(input: ListCampaignsInput): Promise<Page<Campaign>>;
  listAdSets(input: ListAdSetsInput): Promise<Page<AdSet>>;
  listAds(input: ListAdsInput): Promise<Page<Ad>>;
  queryInsights(input: InsightsQuery): Promise<InsightsResult>;
  createCampaign(input: CreateCampaignInput): Promise<MutationResult>;
  updateCampaign(input: UpdateCampaignInput): Promise<MutationResult>;
  createAdSet(input: CreateAdSetInput): Promise<MutationResult>;
  updateAdSet(input: UpdateAdSetInput): Promise<MutationResult>;
  createCreative(input: CreateCreativeInput): Promise<MutationResult>;
  createAd(input: CreateAdInput): Promise<MutationResult>;
  updateAd(input: UpdateAdInput): Promise<MutationResult>;
  getAdPreview(input: PreviewInput): Promise<PreviewResult>;
}
```

实现：

- `LiveMetaAdsProvider`：真实 Graph/Marketing API，仅服务端调用。
- `DemoMetaAdsProvider`：从 `fixtures/meta` 返回确定性数据，页面顶部显示“演示数据”。
- 业务层不得直接拼 Graph URL。
- API 版本只从 `META_GRAPH_API_VERSION` 读取，默认基线 `v25.0`。

### 4.3 读写安全开关

- `ENABLE_META_WRITES=false` 为默认值。
- 写操作同时要求：环境开关开启、连接具备 `ads_management`、当前角色有 `ads:write`、账户未标记为只读。
- 未满足时按钮禁用，并给出可操作原因。
- Demo Provider 可模拟发布，但必须显示“未发送到 Meta”。
- 禁止在未确认结果时自动重试 Meta 创建类 POST，防止重复对象。

### 4.4 数据同步

- 首次连接：同步账户基本信息与最近 30 天日粒度 Insights。
- 增量同步：账户对象每 15 分钟；当天 Insights 每小时；历史修正窗口回看 7 天。
- 手动刷新通过队列触发，不在 HTTP 请求中长时间阻塞。
- 大报表使用 Meta 异步 Insights 流程；Worker 轮询并保存状态。
- 所有游标分页必须保存 checkpoint，可中断恢复。
- 解析并记录限流使用率响应头，在接近阈值时主动降速。

### 4.5 UI 不得自行发挥

严格实现 `docs/02-ui-ux-spec.md` 和 `prototype/`：

- 侧边导航、顶部账户/日期栏、KPI、图表、三级广告表格、右侧详情抽屉、创建向导、报表页、同步与错误页、设置页。
- 保留设计 token、间距、字号、组件密度、空状态和错误状态。
- 不得用巨大渐变、营销落地页卡片、玻璃拟态或无意义动画。
- 不得只做静态页面；关键控件必须可操作。
- 所有按钮必须有真实行为或明确禁用说明，禁止“点了没反应”。

## 5. Meta 接入硬性要求

- OAuth 使用 state + PKCE（若当前 Meta 流程支持客户端类型）或至少强随机 state；回调必须校验 state。
- Access Token 仅在服务端；数据库中使用 AES-256-GCM 或云 KMS 信封加密。
- 每次服务端 Graph 调用附加 `appsecret_proof`。
- 请求权限最小化：只读使用 `ads_read`；写入才申请 `ads_management`；仅确有需要时申请 `business_management`。
- 保存 scopes、token 到期时间、最近校验时间和连接状态。
- Graph 错误映射为稳定的内部错误码；UI 不直接展示原始敏感响应。
- 日志可保留 `fbtrace_id`，但不得保留 token、完整受众、Lead 个人信息或请求签名。
- 使用 cursor pagination；禁止用固定 sleep 循环或无限递归。
- 处理账户时区和币种；报表日期按广告账户时区解释。

## 6. 数据与指标规则

- 金额数据库使用 Decimal 或最小货币单位，禁止浮点累积。
- CTR、CPC、CPM、CPA、ROAS 的派生公式集中在 `packages/shared`。
- UI 上区分：Meta 返回值、系统派生值、缺失值。
- `actions` 和 `action_values` 保留原始数组，同时抽取配置的主转化事件。
- 默认主转化事件可配置，不能写死为唯一 `purchase`。
- Breakdown 组合先通过 allowlist 校验；不支持的组合在发送前阻止。
- 所有数据展示“最后同步时间”和账户时区。

## 7. 必须实现的页面

1. `/login`
2. `/onboarding/meta`
3. `/overview`
4. `/campaigns?level=campaign|adset|ad`
5. `/creatives`
6. `/reports`
7. `/sync-center`
8. `/settings/connections`
9. `/settings/members`

创建向导可使用 `/campaigns/new` 或全屏 Dialog，但必须支持草稿恢复。

## 8. 测试与质量门禁

每个阶段完成后运行：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

必要测试：

- Provider contract tests：Live mock 与 Demo 行为一致。
- OAuth state、token 加密、权限守卫。
- Graph cursor、瞬时错误重试、非瞬时错误不重试。
- 创建请求超时后的去重/对账。
- 指标计算与零除。
- Campaign 表格筛选、批量选择、状态修改。
- 创建向导校验、草稿和只读模式。
- 报表查询、异步任务和 CSV 导出。
- Playwright 覆盖登录、连接演示账户、看板、表格、创建草稿、导出报表。
- 无障碍：关键页面无严重 axe 错误。

不得通过删除测试、降低 TypeScript 严格度、加入宽泛 `any` 或跳过校验来“修复”构建。

## 9. 阶段顺序

必须按 `docs/07-delivery-plan.md`：

- Phase 0：仓库审计与脚手架。
- Phase 1：Demo Provider + 设计系统 + 基础页面。
- Phase 2：数据库、Auth、组织与权限。
- Phase 3：Meta OAuth、连接、只读同步和 Insights。
- Phase 4：Campaign 管理、批量操作和详情抽屉。
- Phase 5：创建向导、素材和预览；默认仍受写入开关保护。
- Phase 6：报表、异步任务、导出、错误中心。
- Phase 7：安全加固、E2E、可访问性、部署文档。

不能跳过 Phase 1 直接写线上 API，也不能在没有 Demo Provider 的情况下把开发卡在凭证上。

## 10. 完成时必须产出

- 可运行代码和锁文件。
- `.env.example`，不能包含真实 secret。
- `infra/docker-compose.yml`。
- 数据库 migration 和 seed。
- `README.md`：本地启动、Meta App 配置、回调 URL、权限、演示模式、部署。
- `docs/IMPLEMENTATION_REPORT.md`，逐项列出：已完成、未完成、偏差、测试结果、已知风险。
- `docs/META_APP_SETUP.md`，用占位符说明 Meta 控制台配置，不伪造审核通过。
- Playwright 截图，便于和 `screenshots/` 对比。

## 11. 禁止事项

- 禁止把 Token 放进 `NEXT_PUBLIC_*`、localStorage、浏览器请求或客户端 bundle。
- 禁止绕过 Meta 权限、应用审核、账户授权或限流。
- 禁止抓取 Ads Manager 私有接口或模拟浏览器 Cookie。
- 禁止声称可读取竞争对手精确花费、订单或 ROAS。
- 禁止把演示数据和真实数据混在同一视图而不标记。
- 禁止像素级复制 Meta 商标、Logo 或官方界面。
- 禁止提交真实凭证、个人数据或生产数据库快照。
- 禁止在 MVP 中实现自动增预算等高风险规则执行；可展示只读规则或后续接口占位，但必须明确未启用。

## 12. Codex 工作方式

- 先阅读，不要立即生成代码。
- 给出简短实施计划后直接动手，不为文档已明确的选择反复提问。
- 遇到不确定的 Meta 字段或版本差异，查官方 Meta 文档并将结论写入 `docs/DECISIONS.md`；不得凭记忆创造字段。
- 每个阶段保持应用可运行。
- 发现需求冲突时，以安全 > 数据正确性 > 本文 > 其他文档 > 原型视觉为优先级。
- 最终只声明实际运行验证过的功能。
