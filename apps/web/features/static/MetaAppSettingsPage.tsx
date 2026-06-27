"use client";

import { Copy } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiPath, appPath } from "@/lib/app-paths";
import { useAppRuntime } from "@/lib/app-runtime";
import { graphApiVersionError, normalizeGraphApiVersion } from "@/lib/graph-api-version";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    setFormError("");
    const response = await fetch(apiPath("/api/settings/meta-app"), { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: MetaAppStatus; error?: string };
    setLoading(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setMessage(payload.error ?? "读取 Meta App 配置失败。请先登录所有者或管理员账号。");
      return;
    }
    setStatus(payload.data);
    setMetaAppId(payload.data.metaAppId);
    setGraphApiVersion(payload.data.graphApiVersion);
    setOauthRedirectUri(payload.data.oauthRedirectUri);
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
    const normalizedGraphApiVersion = normalizeGraphApiVersion(graphApiVersion);
    if (!normalizedGraphApiVersion) {
      setFormError(graphApiVersionError);
      setMessage("");
      return;
    }
    setSaving(true);
    setMessage("");
    setFormError("");
    const response = await fetch(apiPath("/api/settings/meta-app"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        metaAppId: metaAppId.trim(),
        graphApiVersion: normalizedGraphApiVersion,
        oauthRedirectUri,
        enableMetaWrites: status?.enableMetaWrites ?? false,
        emergencyReadOnly: status?.emergencyReadOnly ?? true,
        allowedAdAccountIds: status?.allowedAdAccountIds ?? [],
        ...(metaAppSecret.trim() ? { metaAppSecret: metaAppSecret.trim() } : {})
      })
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: MetaAppStatus; error?: string };
    setSaving(false);
    if (!response.ok || !payload.ok || !payload.data) {
      setMessage(payload.error ?? "保存配置失败。");
      showToast("Meta App 配置保存失败", "danger");
      return;
    }
    setMetaAppSecret("");
    setStatus(payload.data);
    setMetaAppId(payload.data.metaAppId);
    setGraphApiVersion(payload.data.graphApiVersion);
    setOauthRedirectUri(payload.data.oauthRedirectUri);
    setMessage("配置已保存。应用密钥已加密写入数据库，前端不会回显明文。");
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
      setMessage(payload.error ?? "测试配置失败。");
      showToast("Meta App 测试失败", "danger");
      return;
    }
    setMessage(`测试通过${payload.data?.appName ? `：${payload.data.appName}` : ""}`);
    showToast("Meta App 配置测试通过", "success");
  };

  const copyRedirectUri = async () => {
    await navigator.clipboard.writeText(oauthRedirectUri);
    showToast("OAuth 回调地址已复制", "success");
  };

  return (
    <>
      <PageHeader
        eyebrow="设置 / Meta App"
        title="Meta App 配置"
        description="配置真实 Meta OAuth 所需的应用 ID、应用密钥、Graph API 版本和 OAuth 回调地址。"
        actions={<a className="button secondary" href={appPath("/settings/connections")}>查看连接</a>}
      />
      <div className="settings-layout">
        <SettingsNav active="meta-app" />
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">M</div>
              <div>
                <h2>应用配置状态</h2>
                <p>{statusCopy(status)}</p>
              </div>
              <span className={status?.configured ? "badge success" : "badge warning"}>{status?.configured ? "已配置" : "未配置"}</span>
            </div>
            <div className="detail-grid">
              <div><span>来源</span><strong>{sourceLabel(status?.source)}</strong></div>
              <div><span>应用 ID</span><strong>{status?.metaAppIdMasked || "未填写"}</strong></div>
              <div><span>应用密钥</span><strong>{status?.secretConfigured ? "已保存" : "未保存"}</strong></div>
              <div><span>Graph API 版本</span><strong>{status?.graphApiVersion ?? graphApiVersion}</strong></div>
              <div><span>写入开关</span><strong>{status?.enableMetaWrites ? "开启" : "关闭"}</strong></div>
              <div><span>紧急只读</span><strong>{status?.emergencyReadOnly ?? true ? "开启" : "关闭"}</strong></div>
            </div>
            <div className="redirect-readonly">
              <span>OAuth 回调地址</span>
              <strong>{oauthRedirectUri || "正在生成..."}</strong>
              <Button size="compact" onClick={() => void copyRedirectUri()}><Copy size={14} /> 复制回调地址</Button>
            </div>
            {loading ? <p>正在读取配置...</p> : null}
          </article>

          <form className="panel auth-form" noValidate onSubmit={(event) => void save(event)}>
            <div className="panel-header"><div><h2>配置表单</h2><p>应用密钥只允许输入，不会从服务端回显。</p></div></div>
            <label>
              <span>Meta App ID</span>
              <input value={metaAppId} onChange={(event) => setMetaAppId(event.target.value)} placeholder="输入 Meta App ID" required />
            </label>
            <label>
              <span>Meta App Secret</span>
              <input type="password" value={metaAppSecret} onChange={(event) => setMetaAppSecret(event.target.value)} placeholder={status?.secretConfigured ? "保持现有应用密钥不变" : "输入应用密钥"} />
            </label>
            <label>
              <span>Graph API 版本</span>
              <input value={graphApiVersion} onChange={(event) => { setGraphApiVersion(event.target.value); setFormError(""); }} required />
            </label>
            <label>
              <span>OAuth 回调地址</span>
              <div className="inline-input-action">
                <input aria-label="OAuth 回调地址" value={oauthRedirectUri} readOnly required />
                <Button size="compact" onClick={() => void copyRedirectUri()} aria-label="复制 OAuth 回调地址"><Copy size={14} /></Button>
              </div>
            </label>
            {formError ? <div className="form-error">{formError}</div> : null}
            {message ? <div className={message.includes("失败") ? "form-error" : "state-notice success"}>{message}</div> : null}
            <div className="connection-actions">
              <Button variant="primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存配置"}</Button>
              <Button type="button" onClick={() => void testConfig()} disabled={testing || !status?.configured}>{testing ? "测试中..." : "测试配置"}</Button>
              <Button type="button" onClick={() => void copyRedirectUri()}>复制回调地址</Button>
            </div>
          </form>

          <article className="panel missing-panel">
            <div className="panel-header"><div><h2>缺失项</h2><p>缺失项补齐前不能发起真实 Meta OAuth。</p></div></div>
            <div className="missing-meta-list">
              <div><strong>Meta App ID</strong><span>{metaAppId.trim() ? "已填写" : "未填写"}</span></div>
              <div><strong>Meta App Secret</strong><span>{status?.secretConfigured || metaAppSecret.trim() ? "已保存或待保存" : "未保存"}</span></div>
              <div><strong>Meta 账号</strong><span>尚未连接 Meta 账号</span></div>
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

function statusCopy(status: MetaAppStatus | null): string {
  if (!status) return "正在读取 Meta App 配置。";
  if (status.configured) return "配置已可用于 Meta OAuth。应用密钥明文不会返回浏览器。";
  return "请补齐 Meta App ID、应用密钥和 OAuth 回调地址。";
}

function sourceLabel(source: MetaAppStatus["source"] | undefined): string {
  if (source === "database") return "数据库配置";
  if (source === "environment") return "环境变量配置";
  return "未配置";
}
