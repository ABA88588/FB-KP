"use client";

import { useEffect, useState } from "react";
import type { ToastKind } from "@/lib/app-types";
import { apiPath, appPath } from "@/lib/app-paths";
import { useAppRuntime } from "@/lib/app-runtime";
import { Button, PageHeader } from "@/components/ui";

type ConnectionPayload = {
  organization: { id: string; name: string; role: string };
  permissions: { canManageConnections: boolean };
  metaConfig: { configured: boolean; missing: string[] };
  state: string;
  counts: { users: number; businesses: number; adAccounts: number };
  connection: null | {
    id: string;
    status: string;
    metaUserIdMasked: string | null;
    businessIdsMasked: string[];
    scopes: string[];
    tokenExpiresAt: string | null;
    lastValidatedAt: string | null;
    accounts: Array<{
      id: string;
      name: string;
      metaIdMasked: string;
      currency: string;
      timezoneName: string;
      isReadOnly: boolean;
      isSelected: boolean;
      sourceLastSeenAt: string | null;
    }>;
  };
  missingItems: Array<{ id: string; label: string; detail: string }>;
  actions: { connectUrl: string; disconnectAvailable: boolean };
};

export function SettingsPage({ showToast: providedShowToast }: { showToast?: (text: string, kind?: ToastKind) => void } = {}) {
  const runtime = useAppRuntime();
  const showToast = providedShowToast ?? runtime.showToast;
  const [data, setData] = useState<ConnectionPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    const response = await fetch(apiPath("/api/settings/connections"), { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: ConnectionPayload; error?: string };
    setLoading(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setError(payload.error ?? "CONNECTIONS_LOAD_FAILED");
      return;
    }
    setData(payload.data);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "connected") showToast("Meta 连接已完成", "success");
    if (status === "failed") showToast("Meta OAuth 回调失败，请重新授权", "danger");
    if (status === "denied") showToast("Meta OAuth 已取消或被拒绝", "warning");
  }, [showToast]);

  const disconnect = async () => {
    if (!data?.connection) return;
    setDisconnecting(true);
    const response = await fetch(apiPath("/api/settings/connections"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disconnect", organizationId: data.organization.id, connectionId: data.connection.id })
    });
    setDisconnecting(false);
    if (!response.ok) {
      showToast("断开连接失败", "danger");
      return;
    }
    showToast("Meta 连接已断开", "success");
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow={data ? `组织 / ${data.organization.name}` : "组织 / 设置"}
        title="设置"
        description="管理 Meta App、授权连接、广告账户和写入安全策略"
        actions={
          <>
            <a className="button secondary" href={appPath("/settings/meta-app")}>Meta App 配置</a>
            <a className="button secondary" href={appPath("/settings/write-controls")}>写入控制</a>
          </>
        }
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          <a className="active" href={appPath("/settings/connections")}>Meta 连接</a>
          <a href={appPath("/settings/meta-app")}>Meta App</a>
          <a href={appPath("/settings/write-controls")}>写入控制</a>
          <a href={appPath("/settings/members")}>成员与角色</a>
        </aside>
        <section className="settings-content">
          {loading ? <article className="panel connection-detail">正在读取连接状态...</article> : null}
          {error ? <article className="panel danger connection-detail">读取连接状态失败：{error}</article> : null}
          {data ? (
            <>
              <article className="panel connection-detail">
                <div className="connection-title">
                  <div className="account-logo large">M</div>
                  <div>
                    <h2>Meta 账号连接</h2>
                    <p>{stateCopy(data.state)}</p>
                  </div>
                  <span className={data.state === "connected" ? "badge success" : "badge warning"}>{stateLabel(data.state)}</span>
                </div>
                <div className="detail-grid">
                  <div><span>Meta App</span><strong>{data.metaConfig.configured ? "已配置" : `缺少 ${data.metaConfig.missing.join(", ") || "配置"}`}</strong></div>
                  <div><span>Meta 用户</span><strong>{data.connection?.metaUserIdMasked ?? "未连接"}</strong></div>
                  <div><span>Business</span><strong>{data.counts.businesses}</strong></div>
                  <div><span>广告账户</span><strong>{data.counts.adAccounts}</strong></div>
                  <div><span>Token 到期</span><strong>{formatDate(data.connection?.tokenExpiresAt)}</strong></div>
                  <div><span>最近验证</span><strong>{formatDate(data.connection?.lastValidatedAt)}</strong></div>
                </div>
                <div className="connection-actions">
                  <a className={`button primary ${!data.permissions.canManageConnections || !data.metaConfig.configured ? "disabled" : ""}`} href={data.metaConfig.configured ? data.actions.connectUrl : appPath("/settings/meta-app")}>
                    {data.connection ? "重新授权" : "连接 Meta 账号"}
                  </a>
                  <Button onClick={() => void load()}>刷新状态</Button>
                  <Button variant="danger" disabled={!data.actions.disconnectAvailable || disconnecting} onClick={() => void disconnect()}>{disconnecting ? "断开中..." : "断开连接"}</Button>
                </div>
              </article>

              {data.missingItems.length > 0 ? (
                <article className="panel missing-panel">
                  <div className="panel-header"><div><h2>缺失项</h2><p>Live 模式不会回退 Demo 数据，请按顺序完成配置。</p></div></div>
                  <div className="missing-meta-list">
                    {data.missingItems.map((item) => <div key={item.id}><strong>{item.label}</strong><span>{item.detail}</span></div>)}
                  </div>
                </article>
              ) : null}

              <article className="panel">
                <div className="panel-header"><div><h2>广告账户</h2><p>来自真实 Meta 授权和数据库同步记录。</p></div></div>
                <div className="mini-table">
                  <div className="mini-row mini-head"><span>名称</span><span>ID</span><span>币种</span><span>状态</span><span>同步</span></div>
                  {(data.connection?.accounts ?? []).map((account) => (
                    <div className="mini-row" key={account.id}>
                      <span>{account.name}{account.isSelected ? " · 默认" : ""}</span>
                      <span>{account.metaIdMasked}</span>
                      <span>{account.currency}</span>
                      <span>{account.isReadOnly ? "只读" : "可写"}</span>
                      <span>{formatDate(account.sourceLastSeenAt)}</span>
                    </div>
                  ))}
                  {(data.connection?.accounts.length ?? 0) === 0 ? <div className="mini-row"><span>暂无广告账户</span><span>-</span><span>-</span><span>-</span><span>-</span></div> : null}
                </div>
              </article>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}

function stateLabel(state: string): string {
  if (state === "connected") return "已连接";
  if (state === "missing_config") return "未配置";
  if (state === "not_connected") return "未授权";
  if (state === "expired") return "Token 过期";
  if (state === "missing_accounts") return "缺少账户";
  return "需要处理";
}

function stateCopy(state: string): string {
  if (state === "connected") return "Meta OAuth 已完成，广告账户已写入数据库。";
  if (state === "missing_config") return "先配置 Meta App ID、Secret 和 OAuth Redirect URI。";
  if (state === "not_connected") return "Meta App 已配置，请使用 Owner/Admin 发起 OAuth 授权。";
  if (state === "expired") return "访问 Token 已过期，需要重新授权。";
  if (state === "missing_accounts") return "授权成功但没有发现广告账户，请检查 Business 权限。";
  return "连接需要检查。";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}
