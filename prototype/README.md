# UI 原型

这是无依赖的静态交互原型，用于视觉和 UX 参考，不包含真实 Meta API。

## 打开

直接打开 `index.html`，或在本目录启动静态服务器：

```bash
python -m http.server 4173
```

访问：

```text
http://localhost:4173/#overview
http://localhost:4173/#campaigns
http://localhost:4173/#reports
http://localhost:4173/#sync
http://localhost:4173/?wizard=4#campaigns
```

## 已实现的原型交互

- 侧栏页面切换。
- Campaign / Ad Set / Ad 层级切换。
- 搜索、全选、批量操作反馈。
- 行点击打开详情抽屉。
- 四步广告创建向导、草稿状态和模拟发布。
- 异步报表进度演示。
- 手动刷新和同步反馈。

## Codex 实施说明

- 原型是布局和交互参考，不是最终组件源码。
- 真实实现使用 Next.js、shadcn/ui 和设计 token。
- 不复制原型中的硬编码数据；使用 Demo Provider 和 API。
- 所有 Meta 写操作继续受 `ENABLE_META_WRITES`、scope、角色和账户状态保护。

## 重建参考截图

环境安装 Python Playwright 和 Chromium 后，在包根目录运行：

```bash
python design/render_screenshots.py
```

脚本会固定以 1440×900 输出到 `screenshots/`，便于视觉回归。
