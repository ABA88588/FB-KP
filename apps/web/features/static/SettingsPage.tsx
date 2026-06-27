"use client";

import { useEffect, useState } from "react";
import type { ToastKind } from "@/lib/app-types";
import { apiPath, appPath } from "@/lib/app-paths";
import { useAppRuntime } from "@/lib/app-runtime";
import { Button, DisabledReason, PageHeader } from "@/components/ui";

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
      setError(payload.error ?? "读取连接状态失败。");
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

  const metaConfigured = data?.metaConfig.configured ?? false;
  const connected = data?.state === "connected";
  const accounts = data?.connection?.accounts ?? [];

  return (
    <>
      <PageHeader
        eyebrow={data ? `组织 / ${data.organization.name}` : "组织 / 设置"}
        title="Meta 账号连接"
        description="查看 Meta App、Meta 用户、Business、广告账户和 Token 状态。"
        actions={
          <>
            <a className="button secondary" href={appPath("/settings/meta-app")}>配置 Meta App</a>
            <a className="button secondary" href={appPath("/settings/write-controls")}>写入控制</a>
          </>
        }
      />
      <div className="settings-layout">
        <SettingsNav active="connections" />
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">M</div>
              <div>
                <h2>连接状态</h2>
                <p>{loading ? "正在读取连接状态。" : error ? "请先登录所有者或管理员账号查看完整连接状态。" : stateCopy(data?.state ?? "missing_config")}</p>
              </div>
              <span className={connected ? "badge success" : "badge warning"}>{stateLabel(data?.state ?? "missing_config")}</span>
            </div>
            <div className="detail-grid">
              <div><span>Meta App</span><strong>{metaConfigured ? "已配置" : "未配置"}</strong></div>
              <div><span>Meta 用户</span><strong>{data?.connection?.metaUserIdMasked ?? "未连接"}</strong></div>
              <div><span>Business 数量</span><strong>{data?.counts.businesses ?? 0}</strong></div>
              <div><span>广告账户数量</span><strong>{data?.counts.adAccounts ?? 0}</strong></div>
              <div><span>Token 到期</span><strong>{formatDate(data?.connection?.tokenExpiresAt)}</strong></div>
              <div><span>最近验证</span><strong>{formatDate(data?.connection?.lastValidatedAt)}</strong></div>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="connection-actions">
              <a className={`button secondary ${metaConfigured ? "" : "disabled"}`} href={metaConfigured ? data?.actions.connectUrl ?? appPath("/settings/connections") : undefined} aria-disabled={!metaConfigured}>
                {connected ? "重新授权" : "连接 Meta 账号"}
              </a>
              {!metaConfigured ? <DisabledReason>需要先配置 Meta App</DisabledReason> : null}
              <Button onClick={() => void load()}>刷新状态</Button>
              <Button variant="danger" disabled={!data?.actions.disconnectAvailable || disconnecting} title={!data?.actions.disconnectAvailable ? "当前未连接 Meta 账号" : undefined} onClick={() => void disconnect()}>
                {disconnecting ? "断开中..." : "断开连接"}
              </Button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header"><div><h2>授权权限</h2><p>完成 OAuth 后会显示账号授权范围和业务资产数量。</p></div></div>
            <div className="detail-grid">
              <div><span>权限状态</span><strong>{connected ? "已授权" : "未授权"}</strong></div>
              <div><span>Token 权限范围</span><strong>{data?.connection?.scopes.length ? data.connection.scopes.join(", ") : "未连接"}</strong></div>
              <div><span>当前角色</span><strong>{roleLabel(data?.organization.role)}</strong></div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header"><div><h2>广告账户</h2><p>来自真实 Meta 授权和数据库同步记录。</p></div></div>
            <div className="mini-table">
              <div className="mini-row mini-head"><span>名称</span><span>ID</span><span>币种</span><span>状态</span><span>同步</span></div>
              {accounts.map((account) => (
                <div className="mini-row" key={account.id}>
                  <span>{account.name}{account.isSelected ? " · 默认" : ""}</span>
                  <span>{account.metaIdMasked}</span>
                  <span>{account.currency}</span>
                  <span>{account.isReadOnly ? "只读" : "可写"}</span>
                  <span>{formatDate(account.sourceLastSeenAt)}</span>
                </div>
              ))}
              {accounts.length === 0 ? <div className="connections-empty">暂无广告账户。连接 Meta 后会显示你有权限访问的广告账户。</div> : null}
            </div>
          </article>
        </section>
      </div>
    </>
  );
}

function SettingsNav({ active }: { active: "connections" | "meta-app" | "write-controls" }) {
  return (
    <aside className="settings-nav">
      <a className={active === "connections" ? "active" : ""} href={appPath("/settings/connections")}>Meta 连接</a>
      <a className={active === "meta-app" ? "active" : ""} href={appPath("/settings/meta-app")}>Meta App</a>
      <a className={active === "write-controls" ? "active" : ""} href={appPath("/settings/write-controls")}>写入控制</a>
      <a href={appPath("/settings/members")}>成员与角色</a>
      <a href={appPath("/sync-center")}>审计日志</a>
      <a href={appPath("/demo/overview")}>演示沙箱</a>
    </aside>
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
  if (state === "missing_config") return "请先配置 Meta App ID、应用密钥和 OAuth 回调地址。";
  if (state === "not_connected") return "Meta App 已配置，请使用所有者或管理员账号发起 OAuth 授权。";
  if (state === "expired") return "访问 Token 已过期，需要重新授权。";
  if (state === "missing_accounts") return "授权成功但没有发现广告账户，请检查 Business 权限。";
  return "连接状态需要检查。";
}

function roleLabel(role: string | undefined): string {
  if (role === "OWNER") return "所有者";
  if (role === "ADMIN") return "管理员";
  if (role === "OPERATOR") return "操作员";
  if (role === "ANALYST") return "分析员";
  if (role === "VIEWER") return "查看者";
  return "未登录";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "无";
  return date.toLocaleString("zh-CN", { hour12: false });
}
