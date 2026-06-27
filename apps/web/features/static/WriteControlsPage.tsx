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
      setMessage(payload.error ?? "读取写入控制失败。请先登录所有者或管理员账号。");
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
      setMessage(payload.error ?? "保存写入控制失败。");
      showToast("写入控制保存失败", "danger");
      return;
    }
    setMessage("写入控制已保存。真实写入仍需要角色、Token 权限范围、allowlist 和账户状态同时通过。");
    showToast("写入控制已保存", "success");
    await load();
  };

  const allowlistCount = allowedAdAccountIds.split(/\s+/).filter(Boolean).length;

  return (
    <>
      <PageHeader
        eyebrow="设置 / 写入控制"
        title="写入控制"
        description="管理真实 Meta 写入的全局开关、紧急只读和广告账户 allowlist。"
        actions={<a className="button secondary" href={appPath("/settings/meta-app")}>Meta App 配置</a>}
      />
      <div className="settings-layout">
        <SettingsNav active="write-controls" />
        <section className="settings-content">
          <article className="panel connection-detail">
            <div className="connection-title">
              <div className="account-logo large">W</div>
              <div>
                <h2>真实写入守卫</h2>
                <p>只有所有条件同时满足，Worker 才会向 Meta 执行写操作。</p>
              </div>
              <span className={enableMetaWrites && !emergencyReadOnly ? "badge warning" : "badge success"}>{enableMetaWrites && !emergencyReadOnly ? "进入写入检查" : "只读保护"}</span>
            </div>
            <div className="checklist">
              <GuardItem ok={enableMetaWrites} title="全局写入开关" detail={enableMetaWrites ? "已开启，仍需二次确认和 allowlist。" : "关闭时所有 Meta 写操作都会被拒绝。"} />
              <GuardItem ok={!emergencyReadOnly} invert title="紧急只读" detail={emergencyReadOnly ? "开启时写入全部阻断。" : "关闭后继续检查其他守卫。"} />
              <GuardItem ok title="用户角色" detail="所有者、管理员、操作员才允许写入。" />
              <GuardItem ok={false} title="Token 权限范围" detail="必须包含 ads_management；未连接时视为缺失。" />
              <GuardItem ok={allowlistCount > 0} title="广告账户 allowlist" detail={allowlistCount > 0 ? `已配置 ${allowlistCount} 个广告账户。` : "当前为空，禁止真实写入。"} />
              <GuardItem ok={false} title="当前广告账户状态" detail="未连接广告账户，无法确认是否只读。" />
            </div>
          </article>

          <article className="panel auth-form">
            <div className="panel-header"><div><h2>写入开关</h2><p>生产环境建议先使用测试广告账户验收后再开启。</p></div></div>
            <div className="checklist compact-checklist">
              <label><input type="checkbox" checked={enableMetaWrites} onChange={(event) => setEnableMetaWrites(event.target.checked)} /> 启用真实 Meta 写入</label>
              <label><input type="checkbox" checked={emergencyReadOnly} onChange={(event) => setEmergencyReadOnly(event.target.checked)} /> 紧急只读</label>
            </div>
            <label>
              <span>允许写入的广告账户 ID</span>
              <textarea value={allowedAdAccountIds} onChange={(event) => setAllowedAdAccountIds(event.target.value)} rows={6} placeholder="每行一个广告账户 ID，例如 act_123456789" />
            </label>
            {status?.missing.length ? <div className="form-error">Meta App 尚未完成配置：{status.missing.join(", ")}</div> : null}
            {message ? <div className={message.includes("失败") ? "form-error" : "state-notice success"}>{message}</div> : null}
            <div className="connection-actions">
              <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? "保存中..." : "保存写入控制"}</Button>
              <a className="button secondary" href={appPath("/settings/connections")}>检查连接与账户状态</a>
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

function GuardItem({ ok, invert, title, detail }: { ok: boolean; invert?: boolean; title: string; detail: string }) {
  const pass = invert ? !ok : ok;
  return (
    <div>
      <span className={pass ? "check success" : "check warning"}>{pass ? "✓" : "!"}</span>
      <div><strong>{title}</strong><small>{detail}</small></div>
    </div>
  );
}
