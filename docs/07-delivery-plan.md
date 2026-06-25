# 07｜实施顺序与交付计划

Codex 必须按阶段推进。每阶段都保持仓库可运行并更新 `docs/IMPLEMENTATION_REPORT.md`。

## Phase 0｜仓库审计与脚手架

交付：

- 检查现有仓库并记录兼容性。
- 初始化 pnpm workspace / Turborepo（空仓库时）。
- 建立 apps/packages/infra 目录。
- TypeScript strict、ESLint、格式化、环境变量校验。
- Docker Compose：PostgreSQL、Redis。
- CI 基础命令。

完成定义：`pnpm lint/typecheck/test/build` 可执行，哪怕测试数量很少。

## Phase 1｜设计系统与 Demo 垂直切片

交付：

- 设计 token、App Shell、侧栏、顶栏。
- Demo Provider 和固定 fixtures。
- Overview、Campaign 表格、详情抽屉的可交互版本。
- 页面 Loading/Empty/Error fixture 切换。
- 基础 Playwright screenshot。

完成定义：无 Meta、数据库可使用 seed 或本地 DB，用户能从登录进入总览并操作表格。

## Phase 2｜数据库、Auth、组织和权限

交付：

- Prisma schema、migration、seed。
- Better Auth 数据库 Session。
- Organization、Membership、Role/Permission。
- TenantContext 和服务端授权守卫。
- Saved View、Draft、AuditLog 基础。

完成定义：跨组织测试和角色测试通过。

## Phase 3｜Meta 连接与只读同步

交付：

- OAuth start/callback/state。
- Token 加密、appsecret_proof。
- 账户发现与选择。
- Live Provider 只读资源。
- Worker：账户、Campaign、Ad Set、Ad 同步。
- Insights 最近 30 天同步。
- 限流和错误标准化。

完成定义：使用测试账户可读取真实数据；无测试账户时 contract tests 全通过，不能虚报线上验证。

## Phase 4｜广告管理

交付：

- 服务端分页、筛选、排序。
- Campaign/Ad Set/Ad 三层表格。
- Saved View、列管理。
- 详情抽屉。
- 单个/批量状态 mutation pipeline。
- 四层写入守卫和 partial result。

完成定义：Demo E2E 完整；真实写操作仅在明确启用且测试账户验证后标记完成。

## Phase 5｜创建向导、素材和预览

交付：

- Draft schema 和自动保存。
- 四步向导和跨步骤验证。
- 图片/视频上传流程。
- 单图/视频 Creative。
- Meta/local preview 标识。
- 发布状态机与 UNKNOWN_OUTCOME 对账。

完成定义：Demo 发布全流程；真实测试账户创建 PAUSED 对象并清理/记录测试对象。

## Phase 6｜报表、导出和运维界面

交付：

- 自定义 Insights query builder。
- Breakdown compatibility。
- 同步/异步查询路由。
- CSV Worker、短期下载 URL。
- Sync Center、错误详情、数据新鲜度、Audit Log。

完成定义：近 30 天 ad-level 报表和 CSV E2E 通过。

## Phase 7｜安全、性能、可访问性与部署

交付：

- 安全 header、CSRF、rate limiting、secret scanning。
- axe、键盘和 visual regression。
- 大数据分页/内存测试。
- Docker/部署说明、health/readiness。
- META_APP_SETUP 和最终 IMPLEMENTATION_REPORT。

完成定义：全部质量门禁通过，所有未验证项准确列出。

## Codex 每阶段报告模板

```md
## Phase N

### 已完成
- ...

### 验证
- `pnpm ...`: PASS/FAIL
- 手工验证：...

### 变更文件
- ...

### 偏差与原因
- 无 / ...

### 未解决风险
- ...
```

## 优先级冲突规则

1. Token、安全和租户隔离。
2. 数据正确性和明确的演示标记。
3. 可运行与可测试。
4. 核心运营流程。
5. 视觉细节。
6. 次要便利功能。
