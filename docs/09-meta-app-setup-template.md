# 09｜Meta App 配置模板

本文件是配置清单，不代表应用已经通过 Meta 审核。

## 1. 创建应用

在 Meta for Developers 创建适合商业/广告管理用途的应用，记录：

```text
META_APP_ID=<由 Meta 提供>
META_APP_SECRET=<只放入 Secret Manager>
```

不得把 App Secret 提交到 Git。

## 2. 添加产品和回调

- 添加 Marketing API 所需产品/能力。
- 配置 OAuth redirect URI：

```text
开发：http://localhost:3000/api/meta/oauth/callback
生产：https://<your-domain>/api/meta/oauth/callback
```

- 生产域名、隐私政策、服务条款和数据删除入口必须真实可访问。

## 3. 权限策略

只读版本先申请/使用：

```text
ads_read
```

启用真实写入后才请求：

```text
ads_management
```

只有资产发现流程确有需要时：

```text
business_management
```

涉及 Page / Instagram 广告身份时，按官方文档增加对应权限。不要一次申请与产品无关的所有权限。

## 4. 测试与审核

- 使用开发者/测试者账号和测试广告账户完成开发。
- 录制清楚的审核视频，展示每项权限在界面中的用途。
- 提供测试账号或 Meta 要求的审核路径。
- 外部客户使用前确认权限已取得所需访问级别。
- 在 `docs/IMPLEMENTATION_REPORT.md` 记录：

```text
App mode: Development / Live
ads_read: 未申请 / 审核中 / 已批准
ads_management: 未申请 / 审核中 / 已批准
business_management: 未申请 / 审核中 / 已批准
真实测试账户验证日期：YYYY-MM-DD / 未验证
```

不得把“代码中已请求 scope”描述为“审核已通过”。

## 5. 安全配置

- 开启/使用 App Secret Proof。
- 设置有效域名和回调 allowlist。
- 开启开发者账号 MFA。
- App Secret 轮换有记录。
- Token 和 App Secret 只在服务端。
- 为生产设置告警：Token 到期、错误率、限流、同步延迟。
