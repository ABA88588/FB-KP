# 给 Codex 的交接与开工指令

版本：1.1  
原则：**按阶段交付，不要一句话要求一次性做完整个系统。** 每次只给一个明确阶段，并要求运行验收命令、记录结果和停在边界处。

## 一、首次使用前

1. 将本包完整解压到目标代码仓库根目录；不要只上传截图或单独复制 `CODEX_MASTER_PROMPT.md`。
2. 创建 Git 初始检查点，确保可以回滚；不要让 Codex 在未审阅时直接推送主分支。
3. 不要把 Meta App Secret、Access Token、数据库生产密码粘贴到聊天、文档或 Git。
4. 尚无真实 Meta 测试凭证时，保持：

```env
META_DEMO_MODE=true
ENABLE_META_WRITES=false
```

5. 推荐先完成 Phase 0，再单独完成 Phase 1；二者通过后再接真实 Meta API。

---

## 二、第一次发给 Codex：只做 Phase 0

复制下面整段：

```text
你现在负责这个仓库中的 AdFlow Console 项目。

先不要直接写业务功能。请依次完整阅读：
1. AGENTS.md
2. CODEX_MASTER_PROMPT.md
3. CODEX_HANDOFF_PROMPT.md
4. OWNER_INPUTS.md（如果不存在则读取 OWNER_INPUTS.template.md，并采用其中标记的默认值）
5. docs/01-product-spec.md 到 docs/09-meta-app-setup-template.md
6. api/openapi.yaml
7. db/schema.prisma
8. design/
9. prototype/
10. .agents/skills/meta-ads-implementation/SKILL.md

本次任务边界：只执行 docs/07-delivery-plan.md 的 Phase 0，不得开始 Phase 1，不得接入真实 Meta 写操作。

执行要求：
- 先检查当前 Git 状态、目录、已有代码、包管理器、Node/pnpm 版本和可用基础设施。
- 如果仓库已有代码，先写兼容性与迁移说明，禁止直接覆盖可用实现。
- 从模板创建 docs/DECISIONS.md 和 docs/IMPLEMENTATION_REPORT.md。
- 按固定技术栈完成 Phase 0 脚手架、环境变量校验、PostgreSQL/Redis Docker Compose 和基础 CI 命令。
- 不得把真实 secret 写入仓库；不得降低 TypeScript strict；不得用 any、跳过测试或删除检查来制造通过。
- 完成后必须实际运行并记录：pnpm lint、pnpm typecheck、pnpm test、pnpm build。若环境不允许某命令，记录准确原因、输出摘要和后续复现命令，不得声称通过。
- 只在会造成数据丢失、安全风险或需求文档直接冲突时提问；其余缺失项采用文档默认值并记录到 docs/DECISIONS.md。
- 不要推送远程仓库，不要 force reset，不要修改仓库外文件。

停止条件：Phase 0 的完成定义满足后立即停止，不要自行进入 Phase 1。

最终回复必须包含：
1. 已完成内容
2. 变更文件
3. 执行过的命令及 PASS/FAIL
4. 偏差与未解决风险
5. 下一阶段建议，但不要开始下一阶段
```

---

## 三、Phase 0 验收后：只做 Phase 1

复制下面整段：

```text
继续当前 AdFlow Console 仓库。先读取 AGENTS.md、CODEX_MASTER_PROMPT.md、docs/07-delivery-plan.md、docs/IMPLEMENTATION_REPORT.md、docs/DECISIONS.md、docs/02-ui-ux-spec.md、design/、prototype/ 和 screenshots/。

本次任务边界：只执行 Phase 1“设计系统与 Demo 垂直切片”，不得开始数据库/Auth/真实 Meta OAuth，不得启用真实写入。

必须交付：
- 设计 token、App Shell、侧栏、顶部账户与日期栏。
- 确定性的 Demo Provider 与 fixtures。
- 可操作的 Overview、Campaign/Ad Set/Ad 表格、详情抽屉。
- loading、empty、error、stale、permission-denied 等状态。
- 与参考截图一致的桌面端 1440px 主布局；不得做成营销落地页。
- Playwright 覆盖登录演示流程、总览、层级切换、筛选、详情抽屉，并生成对比截图。

硬性要求：
- 页面必须持续显示“演示数据”；按钮要么有真实 Demo 行为，要么给出明确禁用原因。
- 保持 META_DEMO_MODE=true、ENABLE_META_WRITES=false。
- 不得伪造真实 Meta 连接成功。
- 更新 docs/IMPLEMENTATION_REPORT.md，并实际运行 pnpm lint、pnpm typecheck、pnpm test、pnpm build、pnpm e2e。

停止条件：Phase 1 完成定义满足后立即停止，不得进入 Phase 2。

最终回复列出已完成、截图路径、测试结果、与原型的差异、剩余风险。
```

---

## 四、后续每个阶段的通用指令

将 `N` 和阶段名称替换为对应内容：

```text
继续当前仓库。先读取 AGENTS.md、CODEX_MASTER_PROMPT.md、docs/07-delivery-plan.md、docs/IMPLEMENTATION_REPORT.md、docs/DECISIONS.md，以及与 Phase N 直接相关的规格文件。

本次只执行 Phase N：[阶段名称]。不得提前实施 Phase N+1。

开始前：
- 核对上一阶段质量门禁和未解决风险。
- 给出不超过 10 条的实施检查点，然后直接实施。

实施中：
- 严格遵守 API、数据库、UI 和安全契约。
- 每个行为变化同时更新测试和文档。
- 不得用占位按钮、假成功、假真实数据或跳过检查。

完成后：
- 运行该阶段规定的全部质量命令。
- 更新 docs/IMPLEMENTATION_REPORT.md 和必要的 docs/DECISIONS.md。
- 停在本阶段边界。

最终只报告实际验证过的内容，并列出 PASS/FAIL、变更文件、偏差、风险和下一阶段入口条件。
```

---

## 五、真实 Meta 接入前的专用指令

仅在 Phase 0、1、2 已通过，而且你已准备**测试 App 与测试广告账户**时发送：

```text
执行 Phase 3，只接入 Meta OAuth、账户发现、只读对象同步和 Insights。继续保持 ENABLE_META_WRITES=false。

真实凭证只能从服务端环境变量或 Secret Manager 读取，不得读取、打印、复制、记录或提交 secret；不得把 token 发送给浏览器。使用测试广告账户验证，禁止触碰生产广告账户。

先依据 Meta 官方文档核对当前 Graph API 版本、字段、权限和错误语义；把版本差异写入 docs/DECISIONS.md。实现 Live Provider 时保持与 Demo Provider 相同的 contract tests。

验收必须区分：
- 代码与 mock/contract tests 已验证
- 测试账户真实只读验证
- 因权限或审核尚未验证

没有真实测试凭证时继续完成可测试代码并明确标记 blocked，不得伪造线上验证。
```

---

## 六、最终代码审查指令

全部阶段结束后另开一个 Codex 线程，发送：

```text
对当前 AdFlow Console 仓库做只读优先的最终审查。先不要改代码。

按严重程度检查：
1. Token/secret 泄漏、浏览器暴露、日志泄漏
2. 租户越权、角色绕过、Meta 写入守卫绕过
3. API 与 Prisma/OpenAPI 契约不一致
4. 金额、时区、归因、分页、重试和 UNKNOWN_OUTCOME 错误
5. Demo 与真实数据混淆
6. 缺失测试、无效测试、被跳过检查
7. UI loading/empty/error/stale/permission 状态和无障碍问题

输出可复现证据、文件与行号、风险级别、建议修复，不要泛泛总结。完成审查后停止，等待我批准具体修复项。
```

批准修复时，再按问题编号逐批让 Codex 修改，避免一次性大改。

## 七、不要对 Codex 说这些话

- “全部直接做完，细节你自己决定。”
- “先不要测试，能跑起来就行。”
- “权限不够就模拟成成功。”
- “把 token 写到前端方便调试。”
- “照着 Meta 官方界面一比一复制。”
- “构建失败就把检查关掉。”

这些描述会让范围、质量或安全边界失控。
