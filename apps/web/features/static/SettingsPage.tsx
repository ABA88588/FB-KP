"use client";

import { useState } from "react";
import type { ToastKind } from "@/lib/app-types";
import { Button, ConnectionStateNotice, MissingMetaList, PageHeader } from "@/components/ui";
import { useAppRuntime } from "@/lib/app-runtime";
import { useDemoContext } from "@/lib/demo-context";

const settingsTabs = ["Meta 连接", "广告账户", "成员与角色", "指标设置", "安全与审计"] as const;

export function SettingsPage({ showToast: providedShowToast }: { showToast?: (text: string, kind?: ToastKind) => void } = {}) {
  const runtime = useAppRuntime();
  const showToast = providedShowToast ?? runtime.showToast;
  const { connection, mode, setMode } = useDemoContext();
  const [tab, setTab] = useState<(typeof settingsTabs)[number]>("Meta 连接");
  const [, setStatus] = useState<"健康" | "已断开">("健康");
  const [lastChecked, setLastChecked] = useState("刚刚");

  const resetDemo = () => {
    const checked = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    setStatus("健康");
    setLastChecked(checked);
    showToast("演示连接状态和本地配置已重置", "success");
  };

  const disconnect = () => {
    setStatus("已断开");
    setLastChecked("需要重新检查");
    showToast("演示连接已标记为断开，不会影响真实 Meta", "warning");
  };

  const switchMode = () => {
    const nextMode = mode === "demo" ? "live" : "demo";
    setMode(nextMode);
    showToast(nextMode === "live" ? "已切换到 Live 数据源" : "已切换到 Demo 数据源", "success");
  };

  return (
    <>
      <PageHeader eyebrow="组织 / 云帆电商" title="设置" description="管理连接、账户、成员和安全策略" />
      <div className="settings-layout">
        <aside className="settings-nav">
          {settingsTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} type="button" onClick={() => setTab(item)}>{item}</button>)}
        </aside>
        <section className="settings-content">
          <ConnectionStateNotice connection={connection} />
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">M</div>
              <div><h2>{tab}</h2><p>{connection.stateDetail}</p></div>
              <span className={connection.state === "unconfigured" ? "badge warning" : connection.canWrite ? "badge success" : "badge warning"}>{connection.stateLabel}</span>
            </div>
            <div className="detail-grid">
              <div><span>连接类型</span><strong>{connection.sourceLabel}</strong></div>
              <div><span>数据模式</span><strong>{mode === "demo" ? "Demo" : "Live"}</strong></div>
              <div><span>权限</span><strong>{connection.canRead ? "read enabled" : "read blocked"}</strong></div>
              <div><span>最近验证</span><strong>{lastChecked}</strong></div>
              <div><span>写操作</span><strong className="warning-text">{connection.canWrite ? "enabled" : "disabled"}</strong></div>
              <div><span>缺失项</span><strong>{connection.missingItems.length}</strong></div>
            </div>
            <div className="connection-actions"><Button onClick={switchMode}>{mode === "demo" ? "切换到 Live" : "切换到 Demo"}</Button><Button onClick={resetDemo}>重新检查</Button><Button variant="danger" onClick={disconnect}>断开连接</Button></div>
          </article>
          <article className="panel">
            <div className="panel-header"><div><h2>生产连接要求</h2><p>启用真实 Meta 连接前</p></div></div>
            <MissingMetaList items={connection.missingItems} />
            <div className="checklist">
              <div><span className="check success">✓</span><div><strong>服务端 Token 加密</strong><small>Access Token 不进入浏览器</small></div></div>
              <div><span className="check success">✓</span><div><strong>App Secret Proof</strong><small>每次 Graph 请求服务端生成</small></div></div>
              <div><span className="check warning">!</span><div><strong>Meta App 审核</strong><small>需要在实际 App 控制台完成，代码不能代替审核</small></div></div>
              <div><span className="check warning">!</span><div><strong>写入开关关闭</strong><small>ENABLE_META_WRITES=false</small></div></div>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
