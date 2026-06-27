# External Inputs Required

以下项目需要真实外部输入或运行环境，不能用 Demo Provider、mock、CI 跳过结果替代验收。

| 输入/环境 | 当前状态 | 用途 | 验收方式 |
|---|---|---|---|
| Meta App ID / App Secret | 未提供 | OAuth、Graph API 调用、权限校验 | 在 Secret Manager / GitHub Environments 注入后执行真实 OAuth 回调和只读 API smoke test |
| Meta App 审核状态与权限 | 未完成 | `ads_read`、`ads_management`、业务管理相关权限 | 在 Meta for Developers 后台确认审核通过，并记录审核范围 |
| Meta 测试用户、Business、Ad Account | 未提供 | 只读同步、分页、Insights、错误映射、写入守卫验收 | 使用测试账户跑 contract/e2e，不提交真实 token 或业务数据 |
| 合法 OAuth Redirect URI | 未确认 | 线上 OAuth 回调 | 与 Meta App 后台配置逐字匹配后验证 code exchange |
| 生产/预发服务器 URL | 未提供 | 真实服务器验收、OAuth、webhook/回调路径 | 部署后执行 smoke test、Network/token 泄漏检查和错误页验证 |
| PostgreSQL / Redis / Worker 环境 | 未提供 | 真实同步、异步报表、CSV worker、checkpoint | 使用隔离测试环境执行集成测试和重启恢复测试 |
| Token 加密密钥 | 未提供 | Meta token 加密存储 | 注入 `TOKEN_ENCRYPTION_KEY` 后验证 encrypt/decrypt、密钥缺失拒绝启动 |
| Docker runtime 配置与镜像运行环境 | 待部署模块确认 | Docker build/config CI 验证和真实容器运行验收 | GitHub Actions 会对仓库内 Dockerfile/compose 执行 build/config；真实运行还需提供目标主机、域名、secrets 和持久化策略 |

## 当前未完成验收

- 真实 Meta OAuth、权限审核、Graph API 分页、Insights、错误码映射尚未验收。
- 真实服务器、数据库、Redis、Worker、加密 token 存储尚未验收。
- Docker build/config 可由 CI 覆盖，但真实镜像运行、域名、TLS、secrets、数据卷和回滚仍需目标服务器输入。
- 当前新增测试为受控 mock / 本地契约测试，只证明 Demo Provider、本地 env 解析和写入守卫的预期行为。
