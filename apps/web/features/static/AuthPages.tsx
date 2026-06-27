"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ConnectionStateNotice, MissingMetaList } from "@/components/ui";
import { apiPath } from "@/lib/app-paths";
import { useDemoContext } from "@/lib/demo-context";

export function LoginPage() {
  const router = useRouter();
  const { connection } = useDemoContext();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    if (authMode === "register" && password !== confirmPassword) {
      setStatus("两次输入的密码不一致。");
      return;
    }
    setSubmitting(true);
    const endpoint = authMode === "login" ? apiPath("/api/auth/login") : apiPath("/api/auth/register");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(authMode === "login" ? { email, password } : { email, password, name, organizationName })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);
    if (!response.ok || !payload.ok) {
      setStatus(readableAuthError(payload.error));
      return;
    }
    router.push("/overview");
  };

  return (
    <main className="standalone-auth">
      <section className="auth-panel">
        <div>
          <div className="eyebrow">AdFlow 广告工作台</div>
          <h1>AdFlow 广告工作台</h1>
          <p>连接 Meta 后，可统一管理广告账户、报表、素材、同步任务和写入控制。</p>
        </div>
        <ConnectionStateNotice connection={{ ...connection, stateLabel: "当前尚未连接 Meta", stateDetail: "当前尚未连接 Meta。登录后请先配置 Meta App，并完成账号授权。" }} />
        <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
          <div className="segmented-control compact" role="tablist" aria-label="认证方式">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>登录</button>
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>注册</button>
          </div>
          {authMode === "register" ? (
            <>
              <label>
                <span>组织名称</span>
                <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="例如：品牌运营团队" required />
              </label>
              <label>
                <span>姓名</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="用于审计日志显示" required />
              </label>
            </>
          ) : null}
          <label>
            <span>邮箱</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          {authMode === "register" ? (
            <label>
              <span>确认密码</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
            </label>
          ) : null}
          {status ? <div className="form-error" role="alert">{status}</div> : null}
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "处理中..." : authMode === "login" ? "登录工作台" : "创建所有者账号"}
          </Button>
        </form>
        <div className="auth-actions">
          <Button onClick={() => router.push("/onboarding")}>进入接入向导</Button>
        </div>
      </section>
    </main>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { connection } = useDemoContext();
  return (
    <main className="standalone-auth">
      <section className="auth-panel setup">
        <div>
          <div className="eyebrow">Meta 接入向导</div>
          <h1>完成正式 Live 接入</h1>
          <p>正式模式不会使用演示数据。请按顺序配置 Meta App、授权账号并同步广告账户。</p>
        </div>
        <div className="setup-grid">
          <article>
            <span>当前模式</span>
            <strong>正式 Live</strong>
            <small>默认读取数据库中的真实 Meta 数据。</small>
          </article>
          <article>
            <span>写入保护</span>
            <strong>只读 / 写入关闭</strong>
            <small>{connection.writeBlockedReason || "真实写入需要通过全部守卫。"}</small>
          </article>
        </div>
        <ConnectionStateNotice connection={connection} />
        <div className="panel missing-panel">
          <div className="panel-header"><div><h2>待完成事项</h2><p>缺失项补齐前不会发起真实 Meta OAuth，也不会显示演示数据。</p></div></div>
          <MissingMetaList items={connection.missingItems} />
        </div>
        <div className="auth-actions">
          <Button onClick={() => router.push("/settings/meta-app")}>配置 Meta App</Button>
          <Button onClick={() => router.push("/settings/connections")}>查看连接</Button>
          <Button variant="primary" onClick={() => router.push("/overview")}>进入工作台</Button>
        </div>
      </section>
    </main>
  );
}

function readableAuthError(error: string | undefined): string {
  if (error === "INVALID_CREDENTIALS") return "邮箱或密码不正确。";
  if (error === "EMAIL_ALREADY_REGISTERED") return "该邮箱已经注册。";
  if (error === "INVALID_REGISTRATION") return "请检查注册信息。";
  return error ?? "认证失败。";
}
