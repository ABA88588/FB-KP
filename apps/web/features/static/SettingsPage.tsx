"use client";

import { useState } from "react";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader } from "@/components/ui";
import { useAppRuntime } from "@/lib/app-runtime";

const settingsTabs = ["Meta 连接", "广告账户", "成员与角色", "指标设置", "安全与审计"] as const;

export function SettingsPage({ showToast: providedShowToast }: { showToast?: (text: string, kind?: ToastKind) => void } = {}) {
  const runtime = useAppRuntime();
  const showToast = providedShowToast ?? runtime.showToast;
  const [tab, setTab] = useState<(typeof settingsTabs)[number]>("Meta 连接");
  const [status, setStatus] = useState<"健康" | "已断开">("健康");
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

  return (
    <>
      <PageHeader eyebrow="组织 / 云帆电商" title="设置" description="管理连接、账户、成员和安全策略" />
      <div className="settings-layout">
        <aside className="settings-nav">
          {settingsTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} type="button" onClick={() => setTab(item)}>{item}</button>)}
        </aside>
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">M</div>
              <div><h2>{tab}</h2><p>用于 UI、测试和开发，不包含真实 Token</p></div>
              <span className={status === "健康" ? "badge success" : "badge warning"}>{status}</span>
            </div>
            <div className="detail-grid">
              <div><span>连接类型</span><strong>Demo Provider</strong></div>
              <div><span>数据来源</span><strong>确定性 Fixture</strong></div>
              <div><span>权限</span><strong>ads_read · ads_management（模拟）</strong></div>
              <div><span>最近验证</span><strong>{lastChecked}</strong></div>
              <div><span>写操作</span><strong className="warning-text">仅模拟，不发送到 Meta</strong></div>
              <div><span>关联账户</span><strong>2</strong></div>
            </div>
            <div className="connection-actions"><Button onClick={resetDemo}>重置演示数据</Button><Button variant="danger" onClick={disconnect}>断开连接</Button></div>
          </article>
          <article className="panel">
            <div className="panel-header"><div><h2>生产连接要求</h2><p>启用真实 Meta 连接前</p></div></div>
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
