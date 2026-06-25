# 03｜技术架构

## 1. 总体架构

```text
Browser
  │ HTTPS / secure session
  ▼
Next.js Web (apps/web)
  ├─ Server Components / UI
  ├─ Route Handlers / BFF
  ├─ Auth & RBAC
  ├─ Query orchestration
  └─ Enqueue background jobs
          │
          ├──────────────► PostgreSQL
          │                 users, connections, mirrors,
          │                 insights, drafts, audit logs
          │
          └──────────────► Redis / BullMQ
                              │
                              ▼
                        Worker (apps/worker)
                          ├─ object sync
                          ├─ async insights
                          ├─ exports
                          ├─ mutation batches
                          └─ token validation
                              │
                              ▼
                     packages/meta-client
                       LiveMetaAdsProvider
                       DemoMetaAdsProvider
                              │
                              ▼
                     Meta Graph / Marketing API
```

Web 和 Worker 共享：

- `packages/db`
- `packages/meta-client`
- `packages/shared`
- `packages/config`

只有服务端模块可以导入 `LiveMetaAdsProvider` 和 token 解密模块。通过 package exports 和 ESLint boundary rule 阻止客户端导入。

## 2. 推荐目录

```text
apps/
  web/
    app/
      (auth)/login/
      (workspace)/overview/
      (workspace)/campaigns/
      (workspace)/campaigns/new/
      (workspace)/creatives/
      (workspace)/reports/
      (workspace)/sync-center/
      (workspace)/settings/
      api/
    components/
    features/
      accounts/
      campaigns/
      creatives/
      insights/
      reports/
      sync/
    lib/
  worker/
    src/
      queues/
      processors/
      schedulers/
      telemetry/
packages/
  config/
  db/
    prisma/
    src/
  meta-client/
    src/
      provider.ts
      live/
      demo/
      schemas/
      errors/
      rate-limit/
  shared/
    src/
      authz/
      money/
      dates/
      metrics/
      contracts/
      env/
  ui/
    src/
      primitives/
      data-table/
      status/
      charts/
fixtures/meta/
infra/
```

## 3. 应用边界

### Web

负责：

- 页面渲染和交互。
- 身份、组织和权限判断。
- 参数校验。
- 数据库查询。
- 短小的只读请求。
- 后台任务入队与任务状态查询。

不得：

- 在普通 HTTP 请求内跑完整账户同步。
- 在客户端直接访问 Meta。
- 长时间轮询 Meta 大报表。
- 存储明文 token。

### Worker

负责：

- 对象和 Insights 同步。
- Meta 异步报表轮询。
- CSV 生成。
- 批量写操作。
- 定期 token 健康检查。
- 重试、退避、checkpoint。

每个 processor 必须：

- 先验证 job schema。
- 使用 organizationId 进行租户隔离。
- 获取连接并在内存中短暂解密 token。
- 记录结构化进度。
- 在 finally 中清除敏感内存引用（尽力而为）。
- 写入稳定终态：SUCCEEDED / PARTIAL / FAILED / CANCELLED。

## 4. Provider 模式

### 公共接口

Provider 返回内部领域对象，不把 Meta 原始 JSON 直接传播到 UI。

```ts
export interface MetaAdsProvider {
  readonly mode: "live" | "demo";
  validateConnection(input: ValidateConnectionInput): Promise<ConnectionHealth>;
  listAdAccounts(input: ListAdAccountsInput): Promise<CursorPage<AdAccountDto>>;
  listCampaigns(input: ListEntitiesInput): Promise<CursorPage<CampaignDto>>;
  listAdSets(input: ListEntitiesInput): Promise<CursorPage<AdSetDto>>;
  listAds(input: ListEntitiesInput): Promise<CursorPage<AdDto>>;
  listCreatives(input: ListEntitiesInput): Promise<CursorPage<CreativeDto>>;
  queryInsights(input: InsightsQuery): Promise<InsightsResponse>;
  startAsyncInsights(input: InsightsQuery): Promise<AsyncReportRef>;
  getAsyncReport(input: AsyncReportRef): Promise<AsyncReportStatus>;
  getAsyncReportRows(input: AsyncReportRef): Promise<CursorPage<InsightRow>>;
  mutate(input: MetaMutation): Promise<MetaMutationResult>;
  getPreview(input: PreviewInput): Promise<PreviewResult>;
}
```

### Live Provider

内部层次：

```text
MetaHttpClient
  ├─ URL/version construction
  ├─ appsecret_proof
  ├─ timeout & abort
  ├─ response validation
  ├─ cursor parsing
  ├─ rate-limit header parsing
  └─ Graph error normalization
        ↓
Resource clients
  ├─ accounts
  ├─ campaigns
  ├─ adsets
  ├─ ads
  ├─ creatives
  ├─ insights
  └─ previews
        ↓
LiveMetaAdsProvider
```

### Demo Provider

- 使用固定 seed，测试结果稳定。
- 支持常见错误注入：token expired、rate limited、partial batch failure、async report running。
- 写操作修改仅存在于演示数据库或 fixture overlay，不触发真实网络。
- 所有响应带 `dataSource: "DEMO"`。

## 5. 请求与缓存策略

### 页面查询

- UI 从本地数据库读取已同步数据，不把每次页面访问变成 Graph API 调用。
- React Query/SWR 可用于客户端缓存，但服务端数据库是主要读源。
- 顶部手动刷新只创建任务，并以任务进度更新页面。

### 对象同步

- Campaign / Ad Set / Ad 按 `updated_time` 和分页同步；Meta 不支持稳定增量字段时使用短窗口全量对账。
- Upsert 唯一键：`organizationId + adAccountId + metaId`。
- 缺失对象不能立即删除；连续两个完整同步周期均不存在后标记 `isDeletedAtSource=true`。
- 保留 `rawJson` 便于对账，但 UI 只使用已验证字段。

### Insights 同步

默认事实粒度：

```text
organization + account + level + entity + date + breakdownHash + attributionWindow
```

- 最近 7 天每次回拉，处理延迟归因。
- 8–30 天可每日回拉一次。
- 更早历史只按需或低频更新。
- 不同 breakdown 不覆盖彼此。
- 原始 actions/action_values 保存 JSON，并抽取常用事件列。

### 应用缓存

- Redis 可缓存账户配置、字段目录和短期查询。
- 缓存 key 必须含 organizationId、adAccountId、dateRange、level、breakdownHash。
- 权限相关数据不使用跨用户公共缓存。

## 6. 队列设计

建议队列：

| Queue | Job |
|---|---|
| `meta-sync` | `sync-account-assets`, `sync-entities`, `sync-insights` |
| `meta-reports` | `start-report`, `poll-report`, `ingest-report` |
| `meta-mutations` | `apply-single`, `apply-batch`, `reconcile-timeout` |
| `exports` | `build-csv`, `expire-export` |
| `maintenance` | `validate-tokens`, `cleanup-jobs`, `refresh-materialized-metrics` |

Job 规范：

```ts
{
  jobVersion: 1,
  organizationId: string,
  actorUserId?: string,
  connectionId: string,
  adAccountId: string,
  requestId: string,
  idempotencyKey: string,
  payload: unknown
}
```

重试：

- 网络超时、429、Meta 标记 transient、5xx：指数退避 + jitter。
- 权限、参数、对象不存在：不自动重试。
- 创建类 mutation 超时：先进入 `RECONCILING`，不得直接重发。
- 默认最大尝试 5 次；异步报表 polling 不算失败重试，但有总时限和最大次数。

## 7. 内部 API

以 `api/openapi.yaml` 为准。约定：

- 所有 API 返回 `requestId`。
- 成功响应统一 envelope：

```json
{
  "data": {},
  "meta": { "requestId": "..." }
}
```

- 错误响应：

```json
{
  "error": {
    "code": "META_TOKEN_EXPIRED",
    "message": "Meta 授权已失效，请重新连接。",
    "retryable": false,
    "details": {}
  },
  "meta": { "requestId": "..." }
}
```

- API 不向浏览器返回 Meta Access Token、appsecret_proof 或原始 Authorization header。

## 8. 认证与授权

### 应用认证

- Better Auth 数据库 Session。
- Cookie：HttpOnly、Secure、SameSite=Lax；生产强制 HTTPS。
- 敏感操作要求近期会话，可选二次确认。

### 组织授权

每个 handler 依次：

1. 验证 session。
2. 解析当前 organization。
3. 检查 membership。
4. 检查 action permission。
5. 校验请求中的资源属于该 organization。
6. 执行业务。

不要仅在前端隐藏按钮，服务端必须重复校验。

## 9. 环境变量

`.env.example` 至少包含：

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adflow
REDIS_URL=redis://localhost:6379
APP_BASE_URL=http://localhost:3000
AUTH_SECRET=replace_me
TOKEN_ENCRYPTION_KEY_BASE64=replace_with_32_byte_key
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v25.0
META_OAUTH_REDIRECT_URI=http://localhost:3000/api/meta/oauth/callback
META_DEMO_MODE=true
ENABLE_META_WRITES=false
LOG_LEVEL=info
```

启动时使用 Zod 校验。生产环境如果缺少关键 secret，应用必须拒绝启动；演示模式可不要求 Meta secret。

## 10. 部署

最低生产拓扑：

- Web 容器 × 2。
- Worker 容器 × 1（可扩展）。
- Managed PostgreSQL。
- Managed Redis。
- 对象存储用于 CSV 导出；使用短期签名 URL。
- Secret Manager / KMS。

必须提供：

- `/api/health/live`
- `/api/health/ready`
- 数据库和 Redis readiness。
- Worker heartbeat。
- graceful shutdown：停止接新 job，等待当前 job checkpoint。

## 11. 观测

日志字段：

```text
timestamp, level, service, environment, requestId, jobId,
organizationId, adAccountId, operation, durationMs, outcome,
metaErrorCode, metaErrorSubcode, fbtraceId
```

必须脱敏：

- access_token
- app_secret
- authorization
- appsecret_proof
- email/phone 等 PII
- 完整 targeting/custom audience payload

指标：

- Graph 调用数、延迟、错误率。
- 限流使用率。
- 同步延迟和数据新鲜度。
- 队列深度和 job 失败率。
- API P95。
- 登录/权限拒绝计数。
