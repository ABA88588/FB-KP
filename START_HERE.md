# Meta 广告管理工具：Codex 实施包

版本：1.1  
规格日期：2026-06-25  
工作名称：**AdFlow Console**（可替换）

本包用于让 Codex 在一个空仓库或现有仓库中，按统一规格实现一个清晰、可维护的 Meta 广告管理工具。目标不是像素级复制 Meta Ads Manager，而是在合法授权范围内实现常用广告管理能力，并提供更清楚的中文界面。

## 给 Codex 的最稳用法

1. 将本压缩包完整解压到代码仓库根目录。
2. 不要拆散目录，不要只发送截图。
3. 先复制 `OWNER_INPUTS.template.md` 为 `OWNER_INPUTS.md`，填写非敏感业务参数。
4. 在 Codex 中发送下面这句话：

```text
请先完整阅读仓库根目录的 AGENTS.md、CODEX_MASTER_PROMPT.md、docs/、api/openapi.yaml、db/schema.prisma、design/ 和 prototype/。严格按 CODEX_MASTER_PROMPT.md 执行，不要自行改变技术栈、范围、数据模型或 UI。先检查当前仓库，再从 Phase 0 开始持续实施；每完成一个阶段都运行规定的质量检查并更新 docs/IMPLEMENTATION_REPORT.md。不要用假的 Meta 实现冒充线上实现；没有真实凭证时使用明确标记的 Demo Provider。
```

5. 更稳妥的做法是打开 `CODEX_HANDOFF_PROMPT.md`，先只执行 Phase 0，再逐阶段继续。
6. 若使用 Codex `/goal`，必须设置明确阶段、验收命令和停止条件。
7. 若仓库已经有代码，Codex 必须先做兼容性检查；不能直接覆盖已有业务。

## 包内文件

| 文件 | 用途 |
|---|---|
| `CODEX_MASTER_PROMPT.md` | 总实施约束与最终目标 |
| `CODEX_HANDOFF_PROMPT.md` | 可逐段复制给 Codex 的开工、阶段与审查指令 |
| `OWNER_INPUTS.template.md` | 项目方非敏感业务参数模板 |
| `PRE_FLIGHT_CHECKLIST.md` | 本地/Cloud/真实 Meta 接入前检查单 |
| `AGENTS.md` | Codex 在仓库内持续遵守的工程约束 |
| `docs/01-product-spec.md` | 产品范围、角色、用户流程 |
| `docs/02-ui-ux-spec.md` | 页面、组件、交互、视觉和无障碍规范 |
| `docs/03-architecture.md` | 技术架构、目录结构、数据流、任务队列 |
| `docs/04-meta-api-contract.md` | Meta API 映射、字段、分页、错误和限流策略 |
| `docs/05-security-compliance.md` | Token、安全、权限、日志和合规要求 |
| `docs/06-testing-acceptance.md` | 测试矩阵与可核验验收标准 |
| `docs/07-delivery-plan.md` | 分阶段实施顺序和完成定义 |
| `docs/08-official-references.md` | 官方资料入口和版本说明 |
| `design/tokens.json` | 设计变量，可映射到 Tailwind/CSS Variables |
| `design/component-inventory.md` | 组件清单和状态规范 |
| `design/user-flows.mmd` | Mermaid 用户流程图 |
| `prototype/` | 无依赖、可直接打开的交互原型 |
| `screenshots/` | 关键界面视觉参考 |
| `api/openapi.yaml` | 本系统内部 API 契约 |
| `db/schema.prisma` | 建议数据库模型 |
| `.agents/skills/meta-ads-implementation/SKILL.md` | Codex 仓库级可复用实施流程 |

## 重要边界

- 默认先实现只读能力；只有 `ENABLE_META_WRITES=true` 且权限检查通过时，才允许真实创建或修改广告。
- 所有 Meta Access Token 只能在服务端使用，必须加密保存，禁止进入浏览器、日志、截图、错误提示或分析系统。
- 无 Meta 凭证时，页面必须运行在清楚标注的 **演示模式**，不得把模拟数据描述为真实广告数据。
- API 版本从环境变量读取；当前规格基线为 `v25.0`，不得散落硬编码。
- 产品名称、图标与视觉不得让用户误以为这是 Meta 官方产品。
