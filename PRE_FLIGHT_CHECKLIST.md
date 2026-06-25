# Codex 开工前检查清单

## A. 推荐方式：本地 Codex / IDE

- [ ] 新建或选定一个独立仓库目录。
- [ ] 将本实施包完整解压到仓库根目录。
- [ ] 将 `OWNER_INPUTS.template.md` 复制为 `OWNER_INPUTS.md`，至少填写产品名称、部署目标和主转化事件；不确定项保留默认。
- [ ] 确认 `.gitignore` 会排除 `.env`、`.env.local`、日志、数据库导出和临时凭证文件。
- [ ] 创建第一次 Git 检查点。
- [ ] 本机已安装 Git、Node.js、pnpm、Docker；具体版本让 Phase 0 核对。
- [ ] 在 Codex 中选择仓库根目录，而不是只上传 ZIP 或截图。
- [ ] 首次只发送 `CODEX_HANDOFF_PROMPT.md` 中的“Phase 0”指令。

## B. 使用 Codex Cloud

- [ ] 将完整仓库推送到 GitHub 的独立分支或新仓库。
- [ ] 在 Codex 中为该仓库创建环境并固定所需 Node/pnpm 版本。
- [ ] 第一次任务仍只执行 Phase 0。
- [ ] 云端阶段优先使用 Demo Provider；真实 Meta 凭证和写操作不要作为初始任务的一部分。
- [ ] 审阅 diff 和测试输出后再创建或合并 PR。

## C. 真实 Meta API 前

- [ ] Phase 0、1、2 已通过。
- [ ] 已有 Meta 开发 App，而不是生产 App 的随意 Token。
- [ ] 已有专用测试广告账户和测试用户。
- [ ] OAuth 回调地址已配置。
- [ ] `ads_read` 状态已确认。
- [ ] App Secret 与 Token 只放服务端 secret/环境变量，未写入仓库或聊天。
- [ ] 仍保持 `ENABLE_META_WRITES=false`。
- [ ] 真实写入测试另行批准，只允许创建 `PAUSED` 对象。

## D. 每个阶段后人工检查

- [ ] Codex 是否真的运行了规定命令，而不是只说“应该通过”。
- [ ] `docs/IMPLEMENTATION_REPORT.md` 是否记录 PASS/FAIL 和未验证项。
- [ ] 页面是否存在 loading、empty、error、stale、permission-denied 状态。
- [ ] Demo 数据是否一直有明显标识。
- [ ] 浏览器网络请求、bundle、日志和截图中是否没有 Token/Secret。
- [ ] 是否停在本阶段，没有偷偷扩大范围。
- [ ] 创建 Git 检查点后再进入下一阶段。
