"use client";

import { useEffect, useState } from "react";
import { apiPath, appPath } from "@/lib/app-paths";
import { useAppRuntime } from "@/lib/app-runtime";
import { Button, PageHeader } from "@/components/ui";

type MetaAppStatus = {
  organizationId: string;
  configured: boolean;
  metaAppId: string;
  graphApiVersion: string;
  oauthRedirectUri: string;
  enableMetaWrites: boolean;
  emergencyReadOnly: boolean;
  allowedAdAccountIds: string[];
  secretConfigured: boolean;
  missing: string[];
};

export function WriteControlsPage() {
  const { showToast } = useAppRuntime();
  const [status, setStatus] = useState<MetaAppStatus | null>(null);
  const [enableMetaWrites, setEnableMetaWrites] = useState(false);
  const [emergencyReadOnly, setEmergencyReadOnly] = useState(true);
  const [allowedAdAccountIds, setAllowedAdAccountIds] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch(apiPath("/api/settings/meta-app"), { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: MetaAppStatus; error?: string };
    if (!response.ok || !payload.ok || !payload.data) {
      setMessage(payload.error ?? "读取写入控制失败");
      return;
    }
    setStatus(payload.data);
    setEnableMetaWrites(payload.data.enableMetaWrites);
    setEmergencyReadOnly(payload.data.emergencyReadOnly);
    setAllowedAdAccountIds(payload.data.allowedAdAccountIds.join("\n"));
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!status?.configured || !status.secretConfigured) {
      setMessage("请先完成 Meta App 配置。");
      return;
    }
    setSaving(true);
    const response = await fetch(apiPath("/api/settings/meta-app"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        metaAppId: status.metaAppId,
        graphApiVersion: status.graphApiVersion,
        oauthRedirectUri: status.oauthRedirectUri,
        enableMetaWrites,
        emergencyReadOnly,
        allowedAdAccountIds
      })
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "保存写入控制失败");
      showToast("写入控制保存失败", "danger");
      return;
    }
    setMessage("写入控制已保存。真实写入仍需角色、token scope、allowlist 和账户状态同时通过。");
    showToast("写入控制已保存", "success");
    await load();
  };

  return (
    <>
      <PageHeader
        eyebrow="设置 / 写入控制"
        title="写入控制"
        description="管理真实 Meta 写入的全局开关、紧急只读和广告账户 allowlist。"
        actions={<a className="button secondary" href={appPath("/settings/meta-app")}>Meta App 配置</a>}
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          <a href={appPath("/settings/connections")}>Meta 连接</a>
          <a href={appPath("/settings/meta-app")}>Meta App</a>
          <a className="active" href={appPath("/settings/write-controls")}>写入控制</a>
          <a href={appPath("/settings/members")}>成员与角色</a>
        </aside>
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">W</div>
              <div>
                <h2>真实写入守卫</h2>
                <p>只有所有条件同时满足时，Worker 才会向 Meta 执行写操作。</p>
              </div>
              <span className={enableMetaWrites && !emergencyReadOnly ? "badge warning" : "badge success"}>{enableMetaWrites && !emergencyReadOnly ? "可进入写入检查" : "只读保护"}</span>
            </div>
            <div className="checklist">
              <div><span className={enableMetaWrites ? "check warning" : "check success"}>{enableMetaWrites ? "!" : "✓"}</span><div><strong>全局写入开关</strong><small>{enableMetaWrites ? "已打开，仍需二次确认和 allowlist。" : "关闭时所有 Meta 写操作会被拒绝。"}</small></div></div>
              <div><span className={emergencyReadOnly ? "check success" : "check warning"}>{emergencyReadOnly ? "✓" : "!"}</span><div><strong>紧急只读</strong><small>{emergencyReadOnly ? "开启时写入全部阻断。" : "关闭后进入其他守卫判断。"}</small></div></div>
              <div><span className="check success">✓</span><div><strong>角色</strong><small>Owner/Admin/Operator 才允许写入。</small></div></div>
              <div><span className="check success">✓</span><div><strong>Token Scope</strong><small>必须包含 ads_management。</small></div></div>
            </div>
          </article>

          <article className="panel auth-form">
            <div className="panel-header"><div><h2>写入开关</h2><p>生产环境默认建议保持紧急只读开启，完成测试账户验收后再打开。</p></div></div>
            <div className="checklist compact-checklist">
              <label><input type="checkbox" checked={enableMetaWrites} onChange={(event) => setEnableMetaWrites(event.target.checked)} /> 启用真实 Meta 写入</label>
              <label><input type="checkbox" checked={emergencyReadOnly} onChange={(event) => setEmergencyReadOnly(event.target.checked)} /> 紧急只读</label>
            </div>
            <label>
              <span>允许写入的广告账户 IDs</span>
              <textarea value={allowedAdAccountIds} onChange={(event) => setAllowedAdAccountIds(event.target.value)} rows={6} placeholder="每行一个广告账户 ID，例如 act_123456789" />
            </label>
            {status?.missing.length ? <div className="form-error">Meta App 尚未完成配置：{status.missing.join(", ")}</div> : null}
            {message ? <div className={message.includes("失败") ? "form-error" : "state-notice success"}>{message}</div> : null}
            <div className="connection-actions">
              <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? "保存中..." : "保存写入控制"}</Button>
              <a className="button secondary" href={appPath("/settings/connections")}>查看连接与账户状态</a>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
