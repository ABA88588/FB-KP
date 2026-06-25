# 04｜Meta Marketing API 接入契约

## 1. 版本与原则

- 当前规格基线：Graph / Marketing API `v25.0`。
- 版本必须由 `META_GRAPH_API_VERSION` 注入；禁止在业务文件中散落 `/v25.0/`。
- 每次升级版本必须运行 contract tests、Meta sandbox/test account 验证并记录在 `docs/DECISIONS.md`。
- 只使用 Meta 官方公开 Graph / Marketing API，不调用 Ads Manager 私有接口，不携带浏览器 Cookie。
- 本文列出 MVP 字段集合，不代表 Meta 全部字段。

基础 URL：

```text
https://graph.facebook.com/{version}/{node-or-edge}
```

服务端调用统一附带：

```text
access_token=<server-side token>
appsecret_proof=<HMAC-SHA256(app_secret, access_token)>
```

## 2. 权限策略

| 能力 | 最小权限 | 说明 |
|---|---|---|
| 读取广告账户、对象和报表 | `ads_read` | 只读 MVP 首选 |
| 创建、编辑、启停广告 | `ads_management` | 只有启用写入功能时申请 |
| 发现/管理企业资产 | `business_management` | 仅确实需要时申请，不作为默认 |
| Page/Instagram 身份 | 对应 Page / Instagram 权限 | 取决于广告身份和具体流程 |

应用本身必须另外检查组织角色。Meta scope 存在不等于当前应用用户可写。

## 3. OAuth 与连接

### 发起 OAuth

内部端点：

```text
GET /api/meta/oauth/start
```

服务端生成：

- 强随机 `state`，与当前 session 和 organization 绑定，短期有效且只用一次。
- 请求的 scope 由功能开关决定。
- 回调 URI 必须与 Meta App 配置完全一致。

### 回调

```text
GET /api/meta/oauth/callback?code=...&state=...
```

处理顺序：

1. 校验并消费 state。
2. 用 code 交换 token。
3. 获取 token 元信息/校验有效性。
4. 保存 Meta 用户标识、scopes、到期时间。
5. 加密 token 后入库。
6. 调用 `GET /me/adaccounts` 发现可访问账户。
7. 不把 token 放入 URL、浏览器 storage 或前端响应。

### Token 生命周期

- 定时验证连接。
- 到期前 14 天显示警告；具体阈值可配置。
- 失效时停止新同步和写操作，保留缓存数据只读。
- 重新授权创建新 token 后原子替换密文，并记录审计日志。

## 4. 账户发现

### 列出广告账户

```http
GET /me/adaccounts
```

建议字段 allowlist：

```text
id,
account_id,
name,
account_status,
currency,
timezone_name,
timezone_offset_hours_utc,
amount_spent,
balance,
spend_cap,
business,
disable_reason
```

内部映射：

```ts
type AdAccountDto = {
  metaId: string;              // act_<id>
  accountId: string;           // numeric string
  name: string;
  status: number | string;
  currency: string;
  timezoneName: string;
  timezoneOffsetHoursUtc?: number;
  amountSpentMinor?: string;
  balanceMinor?: string;
  spendCapMinor?: string;
  businessMetaId?: string;
  disableReason?: number | string;
};
```

金额字段必须根据 Meta 返回的单位和币种文档验证后转换，不可凭字段名猜测。

## 5. 广告对象读取

所有列表使用 cursor pagination：

```json
{
  "data": [],
  "paging": {
    "cursors": { "before": "...", "after": "..." },
    "next": "..."
  }
}
```

只保存 cursor，不信任或持久化含 token 的完整 `next` URL。

### Campaign

```http
GET /act_{ad_account_id}/campaigns
GET /{campaign_id}
```

字段集合：

```text
id,
account_id,
name,
objective,
buying_type,
status,
effective_status,
daily_budget,
lifetime_budget,
budget_remaining,
start_time,
stop_time,
created_time,
updated_time,
special_ad_categories,
issues_info
```

### Ad Set

```http
GET /act_{ad_account_id}/adsets
GET /{adset_id}
```

字段集合：

```text
id,
account_id,
campaign_id,
name,
status,
effective_status,
optimization_goal,
billing_event,
bid_strategy,
bid_amount,
daily_budget,
lifetime_budget,
budget_remaining,
start_time,
end_time,
targeting,
promoted_object,
attribution_spec,
destination_type,
created_time,
updated_time,
issues_info
```

`targeting` 可能包含敏感或复杂配置：数据库可加密/限制日志，UI 只显示必要摘要。

### Ad

```http
GET /act_{ad_account_id}/ads
GET /{ad_id}
```

字段集合：

```text
id,
account_id,
campaign_id,
adset_id,
name,
status,
effective_status,
creative,
tracking_specs,
conversion_specs,
created_time,
updated_time,
issues_info
```

读取 creative 时使用明确 nested fields，避免请求所有字段：

```text
creative{id,name,title,body,image_hash,image_url,thumbnail_url,
object_story_spec,asset_feed_spec,call_to_action_type,
effective_object_story_id,url_tags,status}
```

### Creative / Assets

```http
GET  /act_{ad_account_id}/adcreatives
POST /act_{ad_account_id}/adcreatives
GET  /act_{ad_account_id}/adimages
POST /act_{ad_account_id}/adimages
GET  /act_{ad_account_id}/advideos
POST /act_{ad_account_id}/advideos
```

上传文件先进入服务端/受控对象存储；浏览器不得获得 Meta token。视频需处理 processing status，不能上传完成后立即假设可用。

## 6. Insights

### 同步查询

```http
GET /act_{ad_account_id}/insights
GET /{campaign_id}/insights
GET /{adset_id}/insights
GET /{ad_id}/insights
```

核心参数：

```text
level=account|campaign|adset|ad
fields=...
time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
time_increment=1|7|monthly|all_days
breakdowns=...
action_breakdowns=...
filtering=...
limit=...
action_attribution_windows=...
use_account_attribution_setting=true|false
```

内部 `InsightsQuery`：

```ts
type InsightsQuery = {
  organizationId: string;
  adAccountId: string;
  level: "account" | "campaign" | "adset" | "ad";
  since: string;
  until: string;
  timeIncrement: 1 | 7 | "monthly" | "all_days";
  fields: InsightField[];
  breakdowns: Breakdown[];
  actionBreakdowns?: ActionBreakdown[];
  filters?: InsightFilter[];
  attributionWindows?: string[];
  useAccountAttributionSetting?: boolean;
};
```

### 默认字段

身份/日期：

```text
account_id,account_name,
campaign_id,campaign_name,
adset_id,adset_name,
ad_id,ad_name,
date_start,date_stop
```

基础指标：

```text
spend,
impressions,
reach,
frequency,
clicks,
unique_clicks,
inline_link_clicks,
outbound_clicks,
ctr,
cpc,
cpm,
cpp
```

转化和价值：

```text
actions,
action_values,
cost_per_action_type,
conversions,
conversion_values,
purchase_roas
```

视频（按需）：

```text
video_play_actions,
video_thruplay_watched_actions,
video_p25_watched_actions,
video_p50_watched_actions,
video_p75_watched_actions,
video_p95_watched_actions,
video_p100_watched_actions
```

质量（仅支持对象/条件下）：

```text
quality_ranking,
engagement_rate_ranking,
conversion_rate_ranking
```

字段可用性随目标、层级和 API 版本变化。Provider 必须把“不支持”区分为字段不可用，而不是默认为 0。

### Breakdown allowlist

MVP 可选：

```text
age
gender
country
region
publisher_platform
platform_position
device_platform
impression_device
product_id
```

Action breakdown：

```text
action_type
action_device
conversion_destination
```

不是所有组合都兼容。实现 `breakdown-compatibility.ts` allowlist；发送前校验。若版本更新，基于官方文档和 contract tests 更新，不允许用户任意拼接。

### 异步报表

大查询：

```http
POST /act_{ad_account_id}/insights
GET  /{report_run_id}
GET  /{report_run_id}/insights
```

状态机：

```text
QUEUED → STARTED → META_RUNNING → META_COMPLETED → INGESTING → SUCCEEDED
                                              └→ FAILED
```

轮询规则：

- 首次 2 秒，之后指数增加，最大间隔 30 秒。
- 总等待上限由配置定义，例如 30 分钟。
- 页面不直接轮询 Meta，只轮询内部 job 状态。
- Meta 完成后仍按 cursor 分页下载结果。

## 7. 创建和修改

### Campaign

```http
POST /act_{ad_account_id}/campaigns
POST /{campaign_id}
```

MVP 创建字段：

```text
name
objective
status=PAUSED
special_ad_categories
buying_type（仅支持时）
daily_budget 或 lifetime_budget（仅在对应预算模式）
```

### Ad Set

```http
POST /act_{ad_account_id}/adsets
POST /{adset_id}
```

MVP 字段：

```text
name
campaign_id
status=PAUSED
billing_event
optimization_goal
promoted_object
targeting
start_time
end_time
daily_budget 或 lifetime_budget
bid_strategy / bid_amount（支持时）
attribution_spec（支持时）
```

### Creative

```http
POST /act_{ad_account_id}/adcreatives
```

MVP 优先支持：

- 单图 link ad。
- 单视频 link ad。
- 复用已有 creative。

字段根据身份和格式构建 `object_story_spec`；不得让 UI 直接编辑任意 JSON。

### Ad

```http
POST /act_{ad_account_id}/ads
POST /{ad_id}
```

MVP 字段：

```text
name
adset_id
creative
status=PAUSED
tracking_specs / url_tags（按需）
```

### 状态修改

```http
POST /{campaign_id}  status=ACTIVE|PAUSED
POST /{adset_id}     status=ACTIVE|PAUSED
POST /{ad_id}        status=ACTIVE|PAUSED
```

UI 默认创建为 PAUSED。启用前显示 Meta 可能仍因审核、父对象、付款或账户状态导致 effective status 不为 ACTIVE。

### 删除/归档

MVP 不提供常规硬删除按钮。若未来接入删除，必须：

- 单独高风险权限。
- 明确 Meta 语义（删除、归档或不可逆）。
- 二次确认和审计。

## 8. 广告预览

Provider 应封装 Meta 支持的 preview 节点，例如按 ad 或 creative 获取指定格式预览。UI 不自行伪造“真实版位预览”。

内部输入：

```ts
type PreviewInput = {
  adId?: string;
  creativeId?: string;
  draft?: DraftCreativeInput;
  adFormat: string;
};
```

返回：

```ts
type PreviewResult = {
  source: "META" | "LOCAL_APPROXIMATION";
  html?: string;
  iframeUrl?: string;
  warnings: string[];
};
```

若使用 Meta 返回 HTML，必须在 sandboxed iframe 中展示并限制脚本/导航。若只能本地近似预览，显著标注“布局示意，以 Meta 实际展示为准”。

## 9. 分页、限流与请求控制

### 分页

- 每页默认 100 或经端点验证的安全值。
- Worker 通过 cursor checkpoint 恢复。
- 最大页数和最大对象数可配置，超出后转后台任务。

### 限流

解析并存储可用响应头，例如：

```text
X-App-Usage
X-Ad-Account-Usage
X-Business-Use-Case-Usage
```

策略：

- < 70%：正常。
- 70–85%：降低并发。
- 85–95%：只运行高优先级任务。
- > 95%：暂停非紧急任务并延迟重试。

具体头结构和阈值以当前官方文档与实际响应为准；未知头解析失败不能使主请求失败。

### 超时

- 普通 GET：15 秒。
- mutation：30 秒。
- 上传：按文件大小设置更高上限。
- 使用 AbortController。

## 10. 错误标准化

Graph 错误常见结构：

```json
{
  "error": {
    "message": "...",
    "type": "...",
    "code": 0,
    "error_subcode": 0,
    "is_transient": false,
    "error_user_title": "...",
    "error_user_msg": "...",
    "fbtrace_id": "..."
  }
}
```

内部错误码至少包括：

| 内部码 | 处理 |
|---|---|
| `META_TOKEN_EXPIRED` | 停止调用，要求重新授权 |
| `META_PERMISSION_DENIED` | 不重试，显示缺失权限 |
| `META_RATE_LIMITED` | Worker 退避，UI 显示延迟 |
| `META_INVALID_PARAMETER` | 不重试，定位字段 |
| `META_OBJECT_NOT_FOUND` | 标记对象缺失并对账 |
| `META_ACCOUNT_DISABLED` | 账户只读并提示账户状态 |
| `META_TRANSIENT_ERROR` | 有上限指数退避 |
| `META_ASYNC_REPORT_FAILED` | 可根据错误决定重新发起 |
| `META_UNKNOWN_ERROR` | 保留 fbtrace_id，有限重试或人工处理 |

UI 不显示 access token、完整请求体或 Meta 内部原始堆栈。

## 11. Mutation 去重与对账

Meta 创建接口不应被假定具有通用幂等键。内部实现：

1. 在提交前创建 `MutationRequest`，保存规范化 payload hash。
2. 状态 `PENDING` 后仅允许一个 Worker 执行。
3. 若明确收到成功，保存 Meta ID。
4. 若明确参数失败，标记 FAILED。
5. 若网络超时或连接中断，标记 `UNKNOWN_OUTCOME`。
6. 对 `UNKNOWN_OUTCOME` 先根据本地关联、Meta 对象列表、创建时间和唯一草稿标识进行对账。
7. 只有确认未创建后才允许人工或受控重试。

批量操作逐项保存结果，不能用一个成功响应覆盖部分失败。

## 12. 字段与版本注册表

`packages/meta-client/src/schemas/version-registry.ts` 应集中维护：

```ts
export const metaVersionRegistry = {
  "v25.0": {
    campaignFields: [...],
    adSetFields: [...],
    adFields: [...],
    insightFields: [...],
    breakdownCompatibility: {...},
    objectives: [...],
    optimizationGoals: [...]
  }
} as const;
```

UI 选项来自注册表和账户能力，不使用散落常量。版本升级时差异可审计。
