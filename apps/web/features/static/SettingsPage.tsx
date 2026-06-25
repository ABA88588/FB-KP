"use client";

import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader } from "@/components/ui";

export function SettingsPage({ showToast }: { showToast: (text: string, kind?: ToastKind) => void }) {
  return (
    <>
      <PageHeader eyebrow="组织 / 云帆电商" title="设置" description="管理连接、账户、成员和安全策略" />
      <div className="settings-layout">
        <aside className="settings-nav"><button className="active">Meta 连接</button><button>广告账户</button><button>成员与角色</button><button>指标设置</button><button>安全与审计</button></aside>
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">M</div>
              <div><h2>Meta 演示连接</h2><p>用于 UI、测试和开发，不包含真实 Token</p></div>
              <span className="badge success">健康</span>
            </div>
            <div className="detail-grid">
              <div><span>连接类型</span><strong>Demo Provider</strong></div>
              <div><span>数据来源</span><strong>确定性 Fixture</strong></div>
              <div><span>权限</span><strong>ads_read · ads_management（模拟）</strong></div>
              <div><span>最近验证</span><strong>刚刚</strong></div>
              <div><span>写操作</span><strong className="warning-text">仅模拟，不发送到 Meta</strong></div>
              <div><span>关联账户</span><strong>2</strong></div>
            </div>
            <div className="connection-actions"><Button onClick={() => showToast("演示数据已重置", "success")}>重置演示数据</Button><Button variant="danger" onClick={() => showToast("演示连接不会保存真实 Token", "warning")}>断开连接</Button></div>
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
