# 项目方资料表（复制为 OWNER_INPUTS.md 后填写）

> 本文件只放非敏感配置和业务决定。**不要填写 App Secret、Access Token、生产数据库密码、Cookie、用户个人信息。**

填写规则：暂时不确定的项目可保留“默认”。Codex 应使用默认值继续 Demo 阶段，并把待定项记录在 `docs/DECISIONS.md`。

## 1. 项目基本信息

```yaml
product_name: AdFlow Console                # 默认
company_or_team_name: 待填写
ui_language: zh-CN                          # 默认
secondary_language: none                    # none / en-US / 其他
product_positioning: 第三方 Meta 广告运营管理工具
logo_asset_path: none                       # 例如 assets/logo.svg；不要使用 Meta Logo
brand_color_override: none                  # none 表示沿用 design/tokens.json
launch_mode: demo-first-read-only           # 默认
```

## 2. 用户和权限

```yaml
target_users:
  - 广告优化师
  - 运营主管
  - 只读分析人员
roles:
  owner: 全部组织与连接配置权限
  admin: 账户管理、报表和广告操作
  operator: 广告与报表操作，不管理成员
  analyst: 只读报表
multi_organization_required: true           # 默认
external_customer_login_required: false     # MVP 默认
```

## 3. 报表与业务口径

```yaml
default_date_range: last_7_days              # last_7_days / last_30_days
primary_conversion_event: purchase           # purchase / lead / complete_registration / 自定义
default_attribution_window: Meta账户默认口径  # 未确认时不要写死
show_purchase_value: true
default_currency_source: ad_account           # 必须来自广告账户
report_timezone_source: ad_account             # 必须来自广告账户
primary_kpis:
  - spend
  - purchases
  - purchase_value
  - roas
  - cpa
  - ctr
  - cpc
  - cpm
csv_encoding: utf-8-bom                       # 便于中文 Excel 打开
```

## 4. Meta 测试环境（只填标识和状态，不填 secret）

```yaml
meta_app_id: 待填写                           # App ID 可填；App Secret 不可填
meta_business_id: 待填写或none
meta_test_ad_account_id: 待填写或none          # 例如 act_xxx；仅测试账户
meta_test_page_id: 待填写或none
meta_test_instagram_account_id: 待填写或none
oauth_redirect_dev: http://localhost:3000/api/meta/oauth/callback
oauth_redirect_prod: 待定
app_mode: development                         # development / live
permission_status:
  ads_read: 未申请                            # 未申请 / 审核中 / 已批准
  ads_management: 未申请
  business_management: 未申请
real_read_test_allowed: false                 # 准备好测试账户后改 true
real_write_test_allowed: false                # 默认 false；不要使用生产账户
```

敏感值只在受控运行环境中配置：

```text
META_APP_SECRET
Meta Access Token
AUTH_SECRET
TOKEN_ENCRYPTION_KEY_BASE64
生产 DATABASE_URL / REDIS_URL
```

## 5. 发布和基础设施

```yaml
deployment_target: local-only                 # local-only / Vercel+托管Worker / AWS / GCP / 其他
production_domain: 待定
postgres_provider: local-docker                # 默认
redis_provider: local-docker                   # 默认
object_storage_provider: none                  # 素材上传需要时选择 S3/R2 等
error_monitoring: none                         # 例如 Sentry；未定则 none
analytics: none                                # 默认不接第三方埋点
email_provider: none                           # MVP 若无邀请邮件可暂不接
```

## 6. 写入与风险策略

```yaml
meta_writes_enabled_at_launch: false           # 强烈建议保持 false
new_meta_objects_default_status: PAUSED         # 固定
bulk_action_max_items: 100                     # 默认
high_risk_automation_rules_enabled: false       # MVP 固定 false
production_ad_accounts_allowlist: []            # 未批准前必须为空
require_second_confirmation_for_publish: true
```

## 7. 法务与支持页面

```yaml
privacy_policy_url: 待定
terms_url: 待定
data_deletion_url: 待定
support_email: 待定
company_legal_name: 待定
```

Meta App 切到 Live 或提交权限审核前，这些地址必须替换成真实可访问内容。

## 8. MVP 明确不做的功能

默认排除：

- 自动加预算、自动关停等无人值守高风险规则执行
- 竞争对手精确花费、订单、ROAS
- Ads Manager 私有接口、Cookie 抓取或浏览器自动化绕过
- Lead 个人信息处理（除非另立安全与合规规格）
- 移动端完整广告创建
- 复杂动态商品广告与全部 Advantage+ 变体

新增范围：

```text
无 / 在此填写
```

## 9. 项目方最终验收重点

请选出最重要的 3 项：

```yaml
acceptance_priorities:
  - UI清晰、数据密度合理
  - 报表数字正确并显示时区/币种/同步时间
  - Demo和真实数据绝不混淆
```
