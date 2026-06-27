"use client";

import { Copy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiPath, appPath } from "@/lib/app-paths";
import { useAppRuntime } from "@/lib/app-runtime";
import { Button, PageHeader } from "@/components/ui";

type MetaAppStatus = {
  organizationId: string;
  source: "database" | "environment" | "unconfigured";
  configured: boolean;
  metaAppId: string;
  metaAppIdMasked: string;
  graphApiVersion: string;
  oauthRedirectUri: string;
  enableMetaWrites: boolean;
  emergencyReadOnly: boolean;
  allowedAdAccountIds: string[];
  secretConfigured: boolean;
  updatedAt: string | null;
  missing: string[];
};

export function MetaAppSettingsPage() {
  const { showToast } = useAppRuntime();
  const [status, setStatus] = useState<MetaAppStatus | null>(null);
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [graphApiVersion, setGraphApiVersion] = useState("v25.0");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [enableMetaWrites, setEnableMetaWrites] = useState(false);
  const [emergencyReadOnly, setEmergencyReadOnly] = useState(true);
  const [allowedAdAccountIds, setAllowedAdAccountIds] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    const response = await fetch(apiPath("/api/settings/meta-app"), { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: MetaAppStatus; error?: string };
    setLoading(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setMessage(payload.error ?? "META_APP_STATUS_FAILED");
      return;
    }
    setStatus(payload.data);
    setMetaAppId(payload.data.metaAppId);
    setGraphApiVersion(payload.data.graphApiVersion);
    setOauthRedirectUri(payload.data.oauthRedirectUri);
    setEnableMetaWrites(payload.data.enableMetaWrites);
    setEmergencyReadOnly(payload.data.emergencyReadOnly);
    setAllowedAdAccountIds(payload.data.allowedAdAccountIds.join("\n"));
  };

  useEffect(() => {
    if (!oauthRedirectUri && typeof window !== "undefined") {
      setOauthRedirectUri(`${window.location.origin}${appPath("/api/meta/oauth/callback")}`);
    }
  }, [oauthRedirectUri]);

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const body: Record<string, unknown> = {
      metaAppId,
      graphApiVersion,
      oauthRedirectUri,
      enableMetaWrites,
      emergencyReadOnly,
      allowedAdAccountIds
    };
    if (metaAppSecret.trim()) body.metaAppSecret = metaAppSecret.trim();
    const response = await fetch(apiPath("/api/settings/meta-app"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: MetaAppStatus; error?: string };
    setSaving(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setMessage(payload.error ?? "保存失败");
      showToast("Meta App 配置保存失败", "danger");
      return;
    }
    setMetaAppSecret("");
    setStatus(payload.data);
    setMessage("配置已保存。Secret 已加密写入数据库，前端不会回显。");
    showToast("Meta App 配置已保存", "success");
  };

  const testConfig = async () => {
    setTesting(true);
    setMessage("");
    const response = await fetch(apiPath("/api/settings/meta-app/test"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: { status?: string; appName?: string | null }; error?: string };
    setTesting(false);
    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "测试失败");
      showToast("Meta App 测试失败", "danger");
      return;
    }
    setMessage(`测试通过${payload.data?.appName ? `：${payload.data.appName}` : ""}`);
    showToast("Meta App 配置测试通过", "success");
  };

  const copyRedirectUri = async () => {
    await navigator.clipboard.writeText(oauthRedirectUri);
    showToast("OAuth Redirect URI 已复制", "success");
  };

  return (
    <>
      <PageHeader
        eyebrow="设置 / Meta App"
        title="Meta App 配置"
        description="配置真实 Meta OAuth 所需的 App ID、Secret、Graph API 版本和写入安全开关。"
        actions={<a className="button secondary" href={appPath("/settings/connections")}>查看连接</a>}
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          <a href={appPath("/settings/connections")}>Meta 连接</a>
          <a className="active" href={appPath("/settings/meta-app")}>Meta App</a>
          <a href={appPath("/settings/write-controls")}>写入控制</a>
          <a href={appPath("/settings/members")}>成员与角色</a>
          <a href={appPath("/sync-center")}>审计日志</a>
          <a href={appPath("/demo/overview")}>演示沙箱</a>
        </aside>
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">M</div>
              <div>
                <h2>应用配置状态</h2>
                <p>{statusCopy(status)}</p>
              </div>
              <span className={status?.configured ? "badge success" : "badge warning"}>{status?.configured ? "已配置" : "未完成"}</span>
            </div>
            <div className="detail-grid">
              <div><span>来源</span><strong>{status?.source ?? "-"}</strong></div>
              <div><span>App ID</span><strong>{status?.metaAppIdMasked || "-"}</strong></div>
              <div><span>Secret</span><strong>{status?.secretConfigured ? "已加密保存" : "未保存"}</strong></div>
              <div><span>Graph API</span><strong>{status?.graphApiVersion ?? graphApiVersion}</strong></div>
              <div><span>写入开关</span><strong>{enableMetaWrites ? "允许" : "关闭"}</strong></div>
              <div><span>紧急只读</span><strong>{emergencyReadOnly ? "开启" : "关闭"}</strong></div>
            </div>
            {status?.missing.length ? <div className="form-error">缺少：{status.missing.join(", ")}</div> : null}
            {loading ? <p>正在读取配置...</p> : null}
          </article>

          <form className="panel auth-form" onSubmit={(event) => void save(event)}>
            <div className="panel-header"><div><h2>Meta App 配置</h2><p>Secret 只会被加密保存，API 返回不会包含明文。</p></div></div>
            <label>
              <span>Meta App ID</span>
              <input value={metaAppId} onChange={(event) => setMetaAppId(event.target.value)} required />
            </label>
            <label>
              <span>Meta App Secret</span>
              <input type="password" value={metaAppSecret} onChange={(event) => setMetaAppSecret(event.target.value)} placeholder={status?.secretConfigured ? "保持现有 Secret 不变" : "输入 App Secret"} />
            </label>
            <label>
              <span>Graph API Version</span>
              <input value={graphApiVersion} onChange={(event) => setGraphApiVersion(event.target.value)} required pattern="^v[0-9]+\\.[0-9]+$" />
            </label>
            <label>
              <span>OAuth Redirect URI</span>
              <div className="inline-input-action">
                <input aria-label="OAuth Redirect URI" value={oauthRedirectUri} onChange={(event) => setOauthRedirectUri(event.target.value)} required />
                <Button size="compact" onClick={() => void copyRedirectUri()} aria-label="复制 OAuth Redirect URI"><Copy size={14} /></Button>
              </div>
            </label>
            <label>
              <span>Allowed Ad Account IDs</span>
              <textarea value={allowedAdAccountIds} onChange={(event) => setAllowedAdAccountIds(event.target.value)} rows={4} placeholder="每行一个 act_ 或广告账户 ID" />
            </label>
            <div className="checklist compact-checklist">
              <label><input type="checkbox" checked={enableMetaWrites} onChange={(event) => setEnableMetaWrites(event.target.checked)} /> 启用真实 Meta 写入</label>
              <label><input type="checkbox" checked={emergencyReadOnly} onChange={(event) => setEmergencyReadOnly(event.target.checked)} /> 紧急只读</label>
            </div>
            {message ? <div className={message.includes("失败") ? "form-error" : "state-notice success"}>{message}</div> : null}
            <div className="connection-actions">
              <Button variant="primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存配置"}</Button>
              <Button type="button" onClick={() => void testConfig()} disabled={testing || !status?.configured}>{testing ? "测试中..." : "测试配置"}</Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

function statusCopy(status: MetaAppStatus | null): string {
  if (!status) return "正在读取 Meta App 配置。";
  if (status.configured) return "配置已可用于 Meta OAuth。Secret 明文不会返回浏览器。";
  return "请补齐 Meta App ID、Secret 和 OAuth Redirect URI。";
}
