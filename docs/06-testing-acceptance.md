# 06｜测试与验收标准

## 1. 质量门禁

每个 PR 和最终交付必须通过：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

建议 CI 另加：

```bash
pnpm audit --prod
pnpm test:contracts
pnpm test:a11y
pnpm prisma migrate diff
```

不能通过以下方式“让测试通过”：

- 删除失败测试。
- 大量 `skip`。
- 降低 TypeScript strict。
- 将错误吞掉并返回假成功。
- 用 `any` 绕过外部响应验证。
- 把 Live Provider 替换成 Demo Provider 而不显示。

## 2. 单元测试

### 指标

- spend、CTR、CPC、CPM、CPA、ROAS。
- 零除、缺失值、负值/异常值。
- 多币种不能直接汇总。
- actions/action_values 主转化提取。

### 日期和时区

- 账户时区跨日。
- 夏令时边界。
- 自定义日期包含起止日语义。
- UI 日期转换不改变 Meta 报表日期。

### 权限

- 每个角色对应 action。
- Viewer/Analyst 不能写。
- 最后一位 Owner 不能删除或降级。
- 资源 organization 不匹配时拒绝。

### Meta client

- URL 版本集中构造。
- appsecret_proof 正确生成。
- token 和 proof 不出现在日志快照。
- Graph error 正确映射。
- cursor 解析和 checkpoint。
- rate-limit header 容错解析。
- retry 只针对 transient。
- 创建超时进入 UNKNOWN_OUTCOME，不直接重试。

### 加密

- AES-GCM encrypt/decrypt round trip。
- 篡改 ciphertext/tag 后失败。
- key version 轮换。
- 日志序列化不含明文。

## 3. Contract tests

使用录制后脱敏的 fixture 或 Mock Service Worker/Nock，不把真实 token 提交仓库。

必须覆盖：

- `/me/adaccounts` 分页。
- Campaign / Ad Set / Ad 字段映射。
- Insights actions/action_values。
- 异步报表从启动到分页获取。
- token expired。
- permission denied。
- rate limit + transient error。
- Meta 返回新/未知字段时忽略且保留 rawJson。
- 必需字段缺失时安全失败。

Demo Provider 必须通过与 Live Provider 相同的公共 contract suite。

## 4. 集成测试

使用测试 PostgreSQL 和 Redis：

- Auth、organization、membership。
- Meta connection 加密存取。
- 初次账户同步 upsert。
- 重复同步幂等。
- 两次完整同步后标记源端删除。
- Insights 不同 breakdown 不互相覆盖。
- Worker checkpoint 后重启继续。
- Job 部分失败状态。
- 导出文件过期清理。
- AuditLog 记录 before/after 摘要。

## 5. E2E 场景

### E2E-01 演示 onboarding

1. 登录演示管理员。
2. 选择“使用演示账户”。
3. 勾选一个广告账户。
4. 看到同步进度并进入 Overview。
5. 页面持续显示“演示数据”。

验收：无真实 Meta 配置也能完成；数据库产生 Demo connection，不产生 token。

### E2E-02 Overview

1. 选择近 7 天。
2. KPI、趋势、Top Campaign 显示。
3. 切换账户。
4. 多币种时不展示错误总和。

### E2E-03 Campaign 表格

1. 搜索名称。
2. 添加状态与 ROAS 筛选。
3. 排序 spend。
4. 隐藏一列并保存视图。
5. 刷新后视图保留。
6. 点击行打开详情抽屉。

### E2E-04 批量暂停

1. 选择 3 个 Campaign。
2. 点击暂停。
3. 确认 Dialog 显示数量和账户。
4. Demo 模式模拟部分成功。
5. UI 显示成功 2、失败 1，并可查看失败原因。

### E2E-05 创建草稿

1. 完成 Campaign Step。
2. 离开页面。
3. 返回后恢复草稿。
4. 缺少必填字段时不能进入发布。
5. 写入开关关闭时可保存草稿，但“发布到 Meta”禁用并说明原因。

### E2E-06 报表

1. 选择 level=ad、近 30 天、日粒度。
2. 选择 spend、impressions、purchase_roas。
3. 添加 publisher_platform breakdown。
4. 运行异步报表。
5. 看到任务阶段直至完成。
6. 下载 CSV；CSV 无公式注入风险。

### E2E-07 Token 失效

1. Demo 错误模式设置 token expired。
2. 页面保留缓存数据。
3. 顶部显示授权失效。
4. 所有写按钮禁用。
5. 连接页给出重新授权入口。

### E2E-08 越权

1. 用户 A 属于组织 A。
2. 手工请求组织 B 的 account/campaign ID。
3. API 返回 404 或 403，且无资源存在性泄漏。
4. 记录安全事件，不记录敏感内容。

## 6. 可访问性

Playwright + axe 检查：

- Login。
- Overview。
- Campaign 表格。
- 创建向导。
- Reports。

验收：

- 无 critical/serious 自动化问题。
- 键盘可完成账户选择、筛选、行选择、打开/关闭抽屉和保存草稿。
- Dialog 焦点锁定并正确返回触发元素。
- 图表有文本摘要。

## 7. 性能验收

使用 Demo 数据集：10,000 Campaign、30,000 Ad Set、100,000 Ad（通过分页，不一次性装入浏览器）。

- Overview P75 可交互 < 2.5s（典型开发机/部署基线，记录环境）。
- Campaign 首屏 API P95 < 800ms（数据库已有索引和缓存数据）。
- 100 行表格滚动无明显卡顿。
- 搜索输入使用 250–400ms debounce，并可取消旧请求。
- Worker 处理分页不导致内存持续增长。
- CSV 大导出在 Worker 完成，不阻塞 Web。

## 8. 安全验收

- 在构建输出、浏览器 Network、localStorage、sessionStorage、日志中搜索 token 样式，无结果。
- OAuth state 重放被拒绝。
- CSRF mutation 被拒绝。
- `ENABLE_META_WRITES=false` 时直接调用内部 mutation API 也被拒绝。
- scope 不足、角色不足和账户只读分别被拒绝。
- Preview HTML 无法顶层导航或访问父页面。
- 上传伪造 MIME 被拒绝。
- 导出 URL 过期后不可访问。

## 9. UI 视觉验收

以 `screenshots/` 为视觉参考，不要求像素级一致，但必须满足：

- 侧栏、顶栏、页面标题和数据区层级一致。
- 表格密度、sticky 列、批量操作栏和详情抽屉完整。
- 创建向导有明确步骤、草稿状态和审核页。
- Loading、empty、stale、error、permission-denied 状态均有 Story/测试页面或可触发 fixture。
- 1440×900 无横向页面溢出；表格内部可滚动。

## 10. 最终验收清单

| 编号 | 条件 | 必须 |
|---|---|---|
| A01 | 无凭证可用 Demo 模式完整运行 | 是 |
| A02 | 真实 Token 从不进入浏览器 | 是 |
| A03 | 只读同步与 Insights 可运行 | 是 |
| A04 | 写操作有四层守卫 | 是 |
| A05 | 三级广告表格和详情抽屉 | 是 |
| A06 | 创建向导可保存草稿 | 是 |
| A07 | 报表支持异步与 CSV | 是 |
| A08 | 同步、错误、审计可查看 | 是 |
| A09 | 单元、集成、E2E 通过 | 是 |
| A10 | README、环境变量、部署文档齐全 | 是 |
| A11 | Meta App 已获得线上审核 | 否；属于运营前置条件，不能伪造 |
| A12 | 自动规则真实执行 | 否；MVP 禁止高风险自动执行 |
