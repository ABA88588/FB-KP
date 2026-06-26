import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";
import { prisma } from "@adflow/db";
import { safeErrorMessage } from "@adflow/shared";
import { createProvider, getAccessToken, toBigInt, toNullablePrismaJson, toPrismaJson, writeAudit } from "./service-context.js";

export function createReportsProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<{ rows: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.reports, job.name, job.data);
    const payload = data.payload as { reportId: string; query?: Record<string, unknown> };
    const report = await prisma.reportRun.findUniqueOrThrow({ where: { id: payload.reportId } });
    await prisma.reportRun.update({ where: { id: report.id }, data: { status: "STARTED", startedAt: new Date(), progress: 10 } });
    try {
      const accessToken = await getAccessToken(data.connectionId);
      const provider = createProvider();
      const account = await prisma.adAccount.findUniqueOrThrow({ where: { id: data.adAccountId } });
      const query = (payload.query ?? report.queryJson) as { level?: string; dateRange?: { since?: string; until?: string }; breakdowns?: string[]; attributionWindows?: string[] };
      const since = query.dateRange?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const until = query.dateRange?.until ?? new Date().toISOString().slice(0, 10);
      const rows = await provider.listInsights({ accessToken, requestId: data.requestId }, account.metaId, {
        level: normalizeLevel(query.level),
        since,
        until,
        breakdowns: query.breakdowns ?? [],
        attributionWindows: query.attributionWindows ?? []
      });
      for (const row of rows) {
        const level = denormalizeLevel(query.level);
        const entityMetaId = insightEntityMetaId(row, account.metaId);
        const breakdownHash = JSON.stringify(query.breakdowns ?? []);
        const attributionHash = JSON.stringify(query.attributionWindows ?? []);
        await prisma.insight.upsert({
          where: { organizationId_adAccountId_level_entityMetaId_dateStart_dateStop_timeIncrement_breakdownHash_attributionHash: { organizationId: data.organizationId, adAccountId: data.adAccountId, level, entityMetaId, dateStart: new Date(String(row.date_start ?? since)), dateStop: new Date(String(row.date_stop ?? until)), timeIncrement: "1", breakdownHash, attributionHash } },
          create: { organizationId: data.organizationId, adAccountId: data.adAccountId, level, entityMetaId, dateStart: new Date(String(row.date_start ?? since)), dateStop: new Date(String(row.date_stop ?? until)), timeIncrement: "1", breakdownHash, breakdownJson: toPrismaJson(query.breakdowns ?? []), attributionHash, attributionJson: toNullablePrismaJson(query.attributionWindows ?? []), currency: account.currency, spend: String(row.spend ?? "0"), impressions: toBigInt(String(row.impressions ?? "0")), reach: toBigInt(String(row.reach ?? "0")), clicks: toBigInt(String(row.clicks ?? "0")), actionsJson: toNullablePrismaJson(row.actions), actionValuesJson: toNullablePrismaJson(row.action_values), rawJson: toNullablePrismaJson(row) },
          update: { spend: String(row.spend ?? "0"), impressions: toBigInt(String(row.impressions ?? "0")), reach: toBigInt(String(row.reach ?? "0")), clicks: toBigInt(String(row.clicks ?? "0")), actionsJson: toNullablePrismaJson(row.actions), actionValuesJson: toNullablePrismaJson(row.action_values), rawJson: toNullablePrismaJson(row), syncedAt: new Date() }
        });
      }
      await prisma.reportRun.update({ where: { id: report.id }, data: { status: "SUCCEEDED", completedAt: new Date(), progress: 100, rowCount: rows.length, resultSummaryJson: { rows: rows.length } } });
      await writeAudit({ organizationId: data.organizationId, actorUserId: data.actorUserId, action: `worker.${job.name}`, resourceType: "ReportRun", resourceId: report.id, outcome: "SUCCESS", requestId: data.requestId, summaryJson: { rows: rows.length } });
      return { rows: rows.length };
    } catch (error) {
      context.logger.error("report processor failed", { error: safeErrorMessage(error) });
      await prisma.reportRun.update({ where: { id: report.id }, data: { status: "FAILED", completedAt: new Date(), errorJson: { message: error instanceof Error ? error.message : "Unknown error" } } });
      throw error;
    }
  };
}

function normalizeLevel(value: string | undefined): "account" | "campaign" | "adset" | "ad" {
  if (value === "campaign" || value === "adset" || value === "ad") return value;
  return "account";
}

function denormalizeLevel(value: string | undefined): "ACCOUNT" | "CAMPAIGN" | "ADSET" | "AD" {
  if (value === "campaign") return "CAMPAIGN";
  if (value === "adset") return "ADSET";
  if (value === "ad") return "AD";
  return "ACCOUNT";
}

function insightEntityMetaId(row: Record<string, unknown>, fallback: string): string {
  const value = row.ad_id ?? row.adset_id ?? row.campaign_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}
