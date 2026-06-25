# 05｜安全与合规规格

## 1. 威胁模型摘要

重点保护：

- Meta Access Token、App Secret、appsecret_proof。
- 组织和广告账户数据。
- 预算、投放配置、报表和审计记录。
- 潜在受众和转化数据。

主要风险：

- Token 泄漏到浏览器、日志、监控或错误追踪。
- 跨组织越权（IDOR）。
- 低权限用户触发 Meta 写操作。
- OAuth state 被伪造或重放。
- 创建请求超时后重复创建对象。
- CSV 导出泄漏或长期公开。
- Demo 和真实数据混淆。
- 恶意素材文件或不受控 HTML preview。

## 2. Token 管理

### 存储

- Token 不允许明文入库。
- 本地/基础部署：AES-256-GCM。
- 推荐生产：云 KMS 信封加密。
- 每条密文存储：ciphertext、iv/nonce、auth tag、key version。
- `TOKEN_ENCRYPTION_KEY_BASE64` 必须是 32 字节随机值，仅用于非 KMS 部署。
- 主密钥不得与数据库备份放在同一位置。

### 使用

- 仅 Worker 或服务器 Route Handler 在调用前解密。
- Token 不返回给浏览器。
- Token 不进入 job payload；job 只保存 connectionId。
- 不记录 Graph 完整 URL，因为 query 可能包含 token。
- HTTP client 日志必须主动 redact：`access_token`, `Authorization`, `appsecret_proof`。
- 调用结束后不缓存解密 token 到 Redis。

### 轮换和撤销

- 保存 token 创建时间、到期时间、scopes、最近验证和撤销原因。
- 重新授权时使用数据库事务切换到新密文。
- 断开连接后立即阻止新任务，清理排队任务，并按配置销毁 token 密文。

## 3. OAuth 安全

- `state` 至少 128 bit 随机熵。
- state 与 userId、organizationId、redirect intent、创建时间绑定。
- state 5–10 分钟过期且只能消费一次。
- 回调拒绝缺失、过期、已用或组织不一致的 state。
- 回调成功后重定向到固定 allowlist 路径，禁止开放重定向。
- 错误页面不回显 code 或 token。
- 若当前 Meta 登录流程支持并推荐 PKCE，则启用；否则至少严格 state 校验和服务端 code 交换。

## 4. 应用会话与账户

- Session Cookie：HttpOnly、Secure、SameSite=Lax。
- 生产只允许 HTTPS。
- 密码若由应用管理：Argon2id，适当成本参数；不自行实现加密算法。
- 登录、密码重置、邀请接受和敏感设置需要速率限制。
- Owner/Admin 可启用 MFA；生产建议强制 Owner MFA。
- 修改连接、角色和启用写入时要求近期认证。

## 5. 授权与租户隔离

每个受保护请求必须同时验证：

```text
session
→ organization membership
→ role permission
→ resource.organizationId
→ adAccount belongs to organization
→ Meta connection belongs to organization
→ feature flag / write gate
```

禁止：

- 只凭前端传来的 organizationId。
- 只通过隐藏按钮做权限控制。
- 用全局数据库查询后在内存中过滤租户。

推荐在 repository/service 层强制接受 `TenantContext`：

```ts
type TenantContext = {
  organizationId: string;
  userId: string;
  permissions: Permission[];
};
```

## 6. Meta 写操作四层守卫

真实 mutation 只有同时满足以下条件才执行：

1. `ENABLE_META_WRITES=true`。
2. Meta connection 有所需 scope。
3. 当前用户有 `ads:write`。
4. 广告账户未被标记只读且连接健康。

另外：

- 默认创建状态为 `PAUSED`。
- 预算和状态变更需要明确确认。
- 所有 mutation 写入 AuditLog 和 MutationRequest。
- 单次批量操作设置对象上限，例如 100；超过拆分为后台批次。

## 7. 输入、输出与文件安全

- 所有 Route Handler 使用 Zod 验证 body/query/params。
- 限制名称、文案、URL、UTM 参数长度。
- URL 只允许 `http`/`https`，禁止 `javascript:` 等 scheme。
- 文件上传使用 MIME、扩展名、magic bytes 三重验证。
- 限制文件大小、数量和频率。
- 上传先进入隔离存储，可选恶意软件扫描后再传 Meta。
- 文件名不直接作为对象存储 key。
- Meta preview HTML 放入 sandboxed iframe；禁止 `allow-top-navigation`，按最小权限设置 sandbox。
- 对日志、CSV 和 UI 的外部文本进行适当转义，防止公式注入和 XSS。

### CSV 公式注入

导出单元格以 `=`, `+`, `-`, `@` 开头时，按安全策略加前缀或转义，并在导出文档中说明。

## 8. CSRF、CORS 与请求保护

- Cookie 会话的 mutation 需要 CSRF 防护或框架等效机制。
- CORS 默认同源；不要使用 `*` 搭配凭证。
- 检查 `Origin`/`Host`，防止跨站写操作。
- 高风险操作使用一次性确认 token 或 server-side action nonce。
- 设置 CSP、HSTS、X-Content-Type-Options、Referrer-Policy 和合理 Permissions-Policy。

## 9. 日志与审计

### AuditLog 必须记录

- actorUserId。
- organizationId。
- action。
- resourceType / resourceId / metaId。
- before/after 的安全摘要或 diff。
- requestId / jobId。
- result。
- 时间、IP 摘要和 user agent 摘要（按隐私政策）。

### 不得记录

- Access Token、App Secret、appsecret_proof。
- 完整 Authorization header。
- 密码、Session Cookie。
- Lead 表单个人信息。
- Custom Audience 成员数据。
- 完整 targeting raw payload（除非确有业务需求并加密/限权）。

## 10. 数据保留与删除

默认建议：

| 数据 | 保留 |
|---|---|
| AuditLog | 180 天，可配置 |
| SyncJob / ApiRequestLog | 90 天 |
| 导出文件 | 24 小时后自动删除 |
| Insights | 按客户合同/业务需要 |
| 已断开连接的 token | 立即销毁 |
| Demo 数据 | 可随时重置 |

删除组织数据必须异步、可审计，并清理数据库、对象存储、缓存和排队任务。保留依法必须保留的数据时要记录依据。

## 11. 错误与隐私

- 用户错误信息可操作但不暴露内部 secret。
- 开发栈信息仅开发环境显示。
- Sentry/错误追踪在发送前 redact 敏感字段。
- `fbtrace_id` 可保存用于 Meta 支持，但不应与 token 一同记录。
- 报表 URL、导出 URL 使用短期签名并绑定权限；禁止永久公开链接。

## 12. 依赖和供应链

- 提交 lockfile。
- CI 运行依赖审计和 secret scanning。
- 禁止安装来源不明的 Meta SDK 包；优先官方 SDK或受控 HTTP client。
- Docker 使用最小基础镜像，非 root 用户运行。
- 固定主版本并通过自动化 PR 更新。
- 对高危 CVE 设置阻断门禁。

## 13. 上线前检查

- [ ] 生产环境关闭 Demo 登录快捷入口。
- [ ] `ENABLE_META_WRITES` 默认 false。
- [ ] 浏览器 devtools 和 source map 中无 token。
- [ ] 日志抽样无 token/secret。
- [ ] OAuth state 重放测试通过。
- [ ] 跨组织 IDOR 测试通过。
- [ ] 写权限守卫测试通过。
- [ ] CSV 公式注入测试通过。
- [ ] Preview iframe sandbox 测试通过。
- [ ] 数据备份加密和恢复演练完成。
- [ ] Meta App 权限、隐私政策和数据删除流程已真实配置；不得在代码中伪造审核状态。
