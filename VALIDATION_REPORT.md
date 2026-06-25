# Validation report

规格包在交付前完成了以下检查：

- `design/tokens.json`：JSON 解析通过。
- `api/openapi.yaml`：YAML 解析通过。
- `prototype/app.js`：Node.js 语法检查通过。
- `prototype/index.html`：关键页面、详情抽屉和创建向导节点检查通过。
- UI 原型：通过无服务器的 Playwright 内联加载执行，关键交互可用。
- 视觉参考：总览、广告管理、详情抽屉、创建审核、报表、同步错误共 6 张 1440×900 截图已生成。
- `AGENTS.md`：大小低于 Codex 默认项目指令上限。
- 敏感信息：包内仅包含占位符和确定性演示数据，不包含真实 Token 或 App Secret。

## 仍需 Codex 在真实项目中验证

- 根据实际安装的 Prisma 7 与 Better Auth 版本生成/调整 Auth 表并运行 migration。
- 根据创建时的 Meta Graph API 版本重新核对字段、权限和支持的 Breakdown 组合。
- 使用真实 Meta 测试账户完成 OAuth、只读同步与沙盒写入验收。
- 在目标部署平台运行完整 lint、typecheck、unit、integration、E2E、build 和 secret scan。

- Codex 仓库级 Skill 已按当前目录约定放置于 `.agents/skills/`。
- 已新增逐阶段交接指令、项目方输入模板和开工前检查清单。
