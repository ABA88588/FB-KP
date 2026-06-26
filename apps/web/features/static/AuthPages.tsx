"use client";

import { useRouter } from "next/navigation";
import { Button, ConnectionStateNotice, MissingMetaList } from "@/components/ui";
import { useDemoContext } from "@/lib/demo-context";

export function LoginPage() {
  const router = useRouter();
  const { connection } = useDemoContext();
  return (
    <main className="standalone-auth">
      <section className="auth-panel">
        <div>
          <div className="eyebrow">AdFlow Console</div>
          <h1>Sign in</h1>
          <p>{connection.stateDetail}</p>
        </div>
        <ConnectionStateNotice connection={connection} />
        <div className="auth-actions">
          <Button variant="primary" onClick={() => router.push("/overview")}>进入工作台</Button>
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
