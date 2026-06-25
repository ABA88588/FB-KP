# 08｜官方资料与版本基线

规格检查日期：2026-06-25。

> 这些链接供 Codex 在实现时核对。Meta 字段、权限、版本和组合限制可能变化；发生冲突时，以当前官方文档和实际测试账户响应为准，并将差异记录到 `docs/DECISIONS.md`。

## Meta

- Marketing API overview  
  https://developers.facebook.com/docs/marketing-api/
- Marketing API reference  
  https://developers.facebook.com/docs/marketing-api/reference/
- Insights API  
  https://developers.facebook.com/docs/marketing-api/insights/
- Insights breakdowns  
  https://developers.facebook.com/docs/marketing-api/insights/breakdowns/
- Graph API rate limits  
  https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
- Graph API v25.0 changelog；v25.0 发布于 2026-02-18  
  https://developers.facebook.com/docs/graph-api/changelog/version25.0/
- Access tokens  
  https://developers.facebook.com/docs/facebook-login/guides/access-tokens/
- App secret proof / securing requests  
  https://developers.facebook.com/docs/graph-api/guides/secure-requests/
- Meta Business SDK  
  https://developers.facebook.com/docs/business-sdk/
- Ad Rule reference（MVP 不执行自动规则）  
  https://developers.facebook.com/docs/marketing-api/reference/ad-rule/
- Delivery estimate reference（只有账户/配置支持时使用）  
  https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-delivery-estimate/

## Codex / OpenAI

- Codex overview  
  https://developers.openai.com/codex
- Prompting Codex  
  https://developers.openai.com/codex/prompting
- Codex best practices  
  https://developers.openai.com/codex/learn/best-practices
- Custom instructions with AGENTS.md  
  https://developers.openai.com/codex/guides/agents-md
- Agent Skills  
  https://developers.openai.com/codex/skills
- Follow a durable goal  
  https://developers.openai.com/codex/use-cases/follow-goals

## 技术栈

- Next.js 16.2 release  
  https://nextjs.org/blog/next-16-2
- Node.js releases；规格选择 Node.js 24 LTS  
  https://nodejs.org/en/about/previous-releases
- Prisma ORM 7 upgrade/reference  
  https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- shadcn/ui docs  
  https://ui.shadcn.com/docs
- shadcn charts / Recharts 3  
  https://ui.shadcn.com/docs/components/chart
- Better Auth Next.js integration  
  https://www.better-auth.com/docs/integrations/next

## 实现核对清单

在接入每个 Meta endpoint 前，Codex 必须核对：

1. 当前 `META_GRAPH_API_VERSION` 是否支持。
2. node/edge、HTTP method 和字段名称。
3. 所需 permission 和资产权限。
4. 请求参数限制和字段组合。
5. 分页语义。
6. 错误、限流和异步状态。
7. 测试账户是否实际验证。

未实际验证的线上能力，在 `IMPLEMENTATION_REPORT.md` 中必须标为“代码完成，等待 Meta 凭证/审核验证”，不能标为已上线可用。
