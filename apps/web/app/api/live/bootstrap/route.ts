import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adflow/db";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = createRequestId("live");
  try {
    const token = resolveSessionToken(request);
    if (!token) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", requestId }, { status: 401 });
    const session = await databaseAuthRepository.getSessionByToken(token);
    if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", requestId }, { status: 401 });

    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" }
    });
    if (!membership) return NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED", requestId }, { status: 403 });

    const [accounts, campaigns, adSets, ads, creatives, insights, syncJobs] = await Promise.all([
      prisma.adAccount.findMany({ where: { organizationId: membership.organizationId }, orderBy: [{ isSelected: "desc" }, { createdAt: "asc" }] }),
      prisma.campaign.findMany({ where: { organizationId: membership.organizationId }, orderBy: { updatedAt: "desc" }, take: 500 }),
      prisma.adSet.findMany({ where: { organizationId: membership.organizationId }, orderBy: { updatedAt: "desc" }, take: 500 }),
      prisma.ad.findMany({ where: { organizationId: membership.organizationId }, orderBy: { updatedAt: "desc" }, take: 500 }),
      prisma.creative.findMany({ where: { organizationId: membership.organizationId }, orderBy: { updatedAt: "desc" }, take: 500 }),
      prisma.insight.findMany({ where: { organizationId: membership.organizationId }, orderBy: { dateStart: "desc" }, take: 1000 }),
      prisma.syncJob.findMany({ where: { organizationId: membership.organizationId }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        organization: { id: membership.organization.id, name: membership.organization.name, role: membership.role },
        accounts: accounts.map((account) => ({
          id: account.metaId,
          name: account.name,
          maskedId: maskAccountId(account.metaId),
          currency: account.currency === "KRW" ? "KRW" : "USD",
          timezone: account.timezoneName,
          status: account.status === "1" ? "healthy" : "permission-denied"
        })),
        entities: [
          ...campaigns.map((campaign) => ({
            id: campaign.metaId,
            accountId: accountMetaId(accounts, campaign.adAccountId),
            level: "campaign",
            name: campaign.name,
            status: normalizeStatus(campaign.effectiveStatus),
            effective: normalizeEffective(campaign.effectiveStatus),
            budget: formatBudget(campaign.dailyBudgetMinor ?? campaign.lifetimeBudgetMinor),
            spend: "-",
            purchases: "-",
            cpa: "-",
            value: "-",
            roas: "-",
            impressions: "-",
            ctr: "-",
            cpc: "-",
            updated: campaign.updatedAt.toISOString().slice(0, 10)
          })),
          ...adSets.map((adSet) => ({
            id: adSet.metaId,
            accountId: accountMetaId(accounts, adSet.adAccountId),
            level: "adset",
            parentId: adSet.campaignMetaId,
            name: adSet.name,
            status: normalizeStatus(adSet.effectiveStatus),
            effective: normalizeEffective(adSet.effectiveStatus),
            budget: formatBudget(adSet.dailyBudgetMinor ?? adSet.lifetimeBudgetMinor),
            spend: "-",
            purchases: "-",
            cpa: "-",
            value: "-",
            roas: "-",
            impressions: "-",
            ctr: "-",
            cpc: "-",
            updated: adSet.updatedAt.toISOString().slice(0, 10)
          })),
          ...ads.map((ad) => ({
            id: ad.metaId,
            accountId: accountMetaId(accounts, ad.adAccountId),
            level: "ad",
            parentId: ad.adSetMetaId,
            name: ad.name,
            status: normalizeStatus(ad.effectiveStatus),
            effective: normalizeEffective(ad.effectiveStatus),
            budget: "-",
            spend: "-",
            purchases: "-",
            cpa: "-",
            value: "-",
            roas: "-",
            impressions: "-",
            ctr: "-",
            cpc: "-",
            updated: ad.updatedAt.toISOString().slice(0, 10)
          }))
        ],
        creatives: creatives.map((creative) => ({
          id: creative.metaId,
          accountId: accountMetaId(accounts, creative.adAccountId),
          title: creative.title ?? creative.name ?? creative.metaId,
          file: creative.name ?? `${creative.metaId}.jpg`,
          type: "图片",
          usage: 0,
          recent: 0,
          thumb: 0,
          status: creative.status === "PAUSED" ? "paused" : "active"
        })),
        reportRows: insights.map((insight) => ({
          date: insight.dateStart.toISOString().slice(0, 10),
          platform: "Meta",
          spend: String(insight.spend ?? "0"),
          impressions: String(insight.impressions ?? "0"),
          clicks: String(insight.clicks ?? "0"),
          purchases: String(insight.conversions ?? "0"),
          roas: String(insight.roas ?? "0")
        })),
        syncJobs: syncJobs.map((job) => ({
          accountId: job.adAccountId ? accountMetaId(accounts, job.adAccountId) : accounts[0]?.metaId ?? "",
          id: job.id,
          type: job.type,
          scope: job.queueName,
          status: normalizeJobStatus(job.status),
          progress: `${job.progress}%`,
          startedAt: job.startedAt?.toISOString() ?? job.createdAt.toISOString(),
          elapsed: job.completedAt ? `${Math.max(0, Math.round((job.completedAt.getTime() - (job.startedAt ?? job.createdAt).getTime()) / 1000))}s` : "运行中",
          requestId: job.requestId
        }))
      },
      requestId
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), requestId }, { status: 500 });
  }
}

function accountMetaId(accounts: Array<{ id: string; metaId: string }>, adAccountId: string): string {
  return accounts.find((account) => account.id === adAccountId)?.metaId ?? adAccountId;
}

function maskAccountId(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalizeStatus(value: string): string {
  if (value === "ACTIVE") return "active";
  if (value === "PAUSED") return "paused";
  return value === "active" || value === "paused" ? value : "paused";
}

function normalizeEffective(value: string): string {
  if (value === "ACTIVE") return "投放中";
  if (value === "PAUSED") return "已暂停";
  if (value === "WITH_ISSUES") return "学习受限";
  if (value === "PENDING_REVIEW") return "学习中";
  return "未投放";
}

function formatBudget(value: bigint | null): string {
  return value === null ? "-" : String(value);
}

function normalizeJobStatus(value: string): string {
  if (value === "SUCCEEDED") return "success";
  if (value === "RUNNING") return "running";
  if (value === "PARTIAL") return "partial";
  if (value === "FAILED") return "failed";
  return "queued";
}
