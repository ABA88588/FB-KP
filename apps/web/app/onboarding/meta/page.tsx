import Link from "next/link";

export default function MetaOnboardingPage({ searchParams }: { searchParams?: { status?: string } }) {
  const status = searchParams?.status ?? "not_started";
  return (
    <section className="state-panel">
      <span className="status-dot warning" aria-hidden="true" />
      <strong>Meta 连接需要生产凭证</strong>
      <span>{copyForStatus(status)}</span>
      <a className="button primary" href="/api/meta/oauth/start">开始 Meta OAuth</a>
      <Link className="button secondary" href="/overview">返回总览</Link>
    </section>
  );
}

function copyForStatus(status: string): string {
  if (status === "oauth_code_received") return "OAuth 回调已通过 state 校验。下一步需要接入数据库 token 持久化和账号选择。";
  if (status === "oauth_denied") return "Meta OAuth 被取消或拒绝，请确认 Meta App 权限后重试。";
  return "需要 META_APP_ID、META_APP_SECRET、回调域名和测试广告账户 allowlist 后才能连接真实 Meta。";
}
