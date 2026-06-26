"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ConnectionStateNotice, MissingMetaList } from "@/components/ui";
import { useDemoContext } from "@/lib/demo-context";

export function LoginPage() {
  const router = useRouter();
  const { connection } = useDemoContext();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("AdFlow Team");
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(authMode === "login" ? { email, password } : { email, password, name, organizationName })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);
    if (!response.ok || !payload.ok) {
      setStatus(payload.error ?? "认证失败");
      return;
    }
    router.push("/overview");
  };

  return (
    <main className="standalone-auth">
      <section className="auth-panel">
        <div>
          <div className="eyebrow">AdFlow Console</div>
          <h1>Sign in</h1>
          <p>{connection.stateDetail}</p>
        </div>
        <ConnectionStateNotice connection={connection} />
        <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
          <div className="segmented-control compact">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>登录</button>
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>注册</button>
          </div>
          {authMode === "register" ? (
            <>
              <label>
                <span>姓名</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label>
                <span>组织</span>
                <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
              </label>
            </>
          ) : null}
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          {status ? <div className="form-error" role="alert">{status}</div> : null}
          <Button variant="primary" type="submit" disabled={submitting}>{submitting ? "处理中..." : authMode === "login" ? "登录" : "注册并进入"}</Button>
        </form>
        <div className="auth-actions">
          <Button onClick={() => router.push("/onboarding")}>连接向导</Button>
        </div>
      </section>
    </main>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { connection, mode, setMode } = useDemoContext();
  return (
    <main className="standalone-auth">
      <section className="auth-panel setup">
        <div>
          <div className="eyebrow">Meta connection</div>
          <h1>Onboarding</h1>
          <p>{connection.stateDetail}</p>
        </div>
        <div className="setup-grid">
          <article>
            <span>Current mode</span>
            <strong>{mode === "demo" ? "Demo" : "Live"}</strong>
            <small>{connection.sourceLabel}</small>
          </article>
          <article>
            <span>Writes</span>
            <strong>{connection.canWrite ? "Enabled" : "Disabled"}</strong>
            <small>{connection.writeBlockedReason || "Selected source can write."}</small>
          </article>
        </div>
        <ConnectionStateNotice connection={connection} />
        <div className="panel missing-panel">
          <div className="panel-header"><div><h2>Missing Meta requirements</h2><p>Live mode will not fall back to demo data.</p></div></div>
          <MissingMetaList items={connection.missingItems} />
        </div>
        <div className="auth-actions">
          <Button onClick={() => setMode(mode === "demo" ? "live" : "demo")}>{mode === "demo" ? "切换到 Live" : "切换到 Demo"}</Button>
          <Button onClick={() => router.push("/settings/connections")}>连接设置</Button>
          <Button variant="primary" onClick={() => router.push("/overview")}>进入工作台</Button>
        </div>
      </section>
    </main>
  );
}
