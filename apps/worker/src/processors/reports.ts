import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData, type BaseWorkerJobData } from "../queues/schemas.js";
import { shouldRetryJobFailure } from "../queues/retry.js";
import { prisma } from "@adflow/db";
import type { LiveInsight } from "@adflow/meta-client";
import { safeErrorMessage } from "@adflow/shared";
import { createProvider, errorJson, getAccessToken, saveCursorCheckpoint, toBigInt, toNullablePrismaJson, toPrismaJson, writeAudit, writeMetaApiLog } from "./service-context.js";

const MAX_REPORT_PAGES = 100;

type ReportQuery = {
  level?: string;
  dateRange?: { since?: string; until?: string };
  breakdowns?: string[];
  attributionWindows?: string[];
  cursor?: string;
};

export function createReportsProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<{ rows: number; pages: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.reports, job.name, job.data);
    const payload = data.payload as { reportId: string; query?: Record<string, unknown>; cursor?: string };
    const startedAt = Date.now();
    const report = await prisma.reportRun.findUniqueOrThrow({ where: { id: payload.reportId } });

    if (job.name !== "start-report") {
      const message = `Report job ${job.name} requires Meta async report APIs that are not implemented in the current client.`;
      await prisma.reportRun.update({ where: { id: report.id }, data: { status: "FAILED", completedAt: new Date(), errorJson: { message } } });
      throw new Error(message);
    }

    await job.updateProgress(10);
    await prisma.reportRun.update({ where: { id: report.id }, data: { status: "STARTED", startedAt: new Date(), progress: 10 } });

    try {
      const accessToken = await getAccessToken(data.connectionId);
      const provider = createProvider();
      const account = await prisma.adAccount.findUniqueOrThrow({ where: { id: data.adAccountId } });
      const query = normalizeReportQuery((payload.query ?? report.queryJson) as Record<string, unknown>, payload.cursor);
      const since = query.dateRange?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const until = query.dateRange?.until ?? new Date().toISOString().slice(0, 10);
      const level = denormalizeLevel(query.level);
      let rows = 0;
      let pages = 0;
      let after = query.cursor;

      for (let pageNumber = 1; pageNumber <= MAX_REPORT_PAGES; pageNumber += 1) {
        const page = await provider.listInsightsPage({ accessToken, requestId: data.requestId }, account.metaId, {
          level: normalizeLevel(query.level),
          since,
          until,
          breakdowns: query.breakdowns ?? [],
          attributionWindows: query.attributionWindows ?? [],
          ...(after !== undefined ? { after } : {})
        });
        await writeInsightRows(data, account.metaId, account.currency, level, since, until, query, page.data);
        rows += page.data.length;
        pages += 1;
        const nextAfter = page.cursor.nextAfter ?? page.cursor.after;
        const checkpoint = {
          reportId: report.id,
          pageNumber,
          pageRows: page.data.length,
          rows,
          nextCursor: nextAfter ?? null,
          hasNextPage: page.cursor.hasNextPage,
          updatedAt: new Date().toISOString()
        };
        await saveCursorCheckpoint({
          organizationId: data.organizationId,
          connectionId: data.connectionId,
          adAccountId: data.adAccountId,
          scope: "REPORT",
          objectKey: report.id,
          ...(nextAfter !== undefined ? { after: nextAfter } : {}),
          since: new Date(since),
          until: new Date(until),
          checkpointJson: checkpoint,
          completed: !page.cursor.hasNextPage || nextAfter === undefined
        });
        const progress = Math.min(95, 10 + pageNumber * 5);
        await job.updateProgress(progress);
        await prisma.reportRun.update({
          where: { id: report.id },
          data: {
            status: "INGESTING",
            progress,
            rowCount: rows,
            resultSummaryJson: toPrismaJson(checkpoint)
          }
        });
        if (!page.cursor.hasNextPage || nextAfter === undefined) break;
        after = nextAfter;
        if (pageNumber === MAX_REPORT_PAGES) {
          throw new Error(`Report pagination exceeded ${MAX_REPORT_PAGES} pages.`);
        }
      }

      await job.updateProgress(100);
      await prisma.reportRun.update({
        where: { id: report.id },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          progress: 100,
          rowCount: rows,
          resultSummaryJson: { rows, pages, mode: "sync-insights" }
        }
      });
      await writeMetaApiLog({ organizationId: data.organizationId, operation: `worker.${job.name}`, requestId: data.requestId, startedAt, outcome: "SUCCESS" });
      await writeAudit({
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: `worker.${job.name}`,
        resourceType: "ReportRun",
        resourceId: report.id,
        outcome: "SUCCESS",
        requestId: data.requestId,
        summaryJson: { rows, pages }
      });
      return { rows, pages };
    } catch (error) {
      const retrying = shouldRetryJobFailure(error, job.attemptsMade + 1, context.retryPolicy);
      context.logger.error("report processor failed", { error: safeErrorMessage(error) });
      await prisma.reportRun.update({
        where: { id: report.id },
        data: {
          status: retrying ? "INGESTING" : "FAILED",
          completedAt: retrying ? null : new Date(),
          errorJson: toPrismaJson(errorJson(error))
        }
      });
      await writeMetaApiLog({ organizationId: data.organizationId, operation: `worker.${job.name}`, requestId: data.requestId, startedAt, outcome: "FAILED", error });
      await writeAudit({
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: `worker.${job.name}`,
        resourceType: "ReportRun",
        resourceId: report.id,
        outcome: retrying ? "PARTIAL" : "FAILED",
        requestId: data.requestId,
        summaryJson: errorJson(error)
      });
      throw error;
    }
  };
}

async function writeInsightRows(data: BaseWorkerJobData, accountMetaId: string, currency: string, level: "ACCOUNT" | "CAMPAIGN" | "ADSET" | "AD", since: string, until: string, query: ReportQuery, rows: readonly LiveInsight[]): Promise<void> {
  const breakdownHash = JSON.stringify(query.breakdowns ?? []);
  const attributionHash = JSON.stringify(query.attributionWindows ?? []);
  for (const row of rows) {
    const entityMetaId = insightEntityMetaId(row, accountMetaId);
    await prisma.insight.upsert({
      where: {
        organizationId_adAccountId_level_entityMetaId_dateStart_dateStop_timeIncrement_breakdownHash_attributionHash: {
          organizationId: data.organizationId,
          adAccountId: data.adAccountId,
          level,
          entityMetaId,
          dateStart: new Date(String(row.date_start ?? since)),
          dateStop: new Date(String(row.date_stop ?? until)),
          timeIncrement: "1",
          breakdownHash,
          attributionHash
        }
      },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        level,
        entityMetaId,
        dateStart: new Date(String(row.date_start ?? since)),
        dateStop: new Date(String(row.date_stop ?? until)),
        timeIncrement: "1",
        breakdownHash,
        breakdownJson: toPrismaJson(query.breakdowns ?? []),
        attributionHash,
        attributionJson: toNullablePrismaJson(query.attributionWindows ?? []),
        currency,
        spend: String(row.spend ?? "0"),
        impressions: toBigInt(String(row.impressions ?? "0")),
        reach: toBigInt(String(row.reach ?? "0")),
        clicks: toBigInt(String(row.clicks ?? "0")),
        actionsJson: toNullablePrismaJson(row.actions),
        actionValuesJson: toNullablePrismaJson(row.action_values),
        rawJson: toNullablePrismaJson(row)
      },
      update: {
        spend: String(row.spend ?? "0"),
        impressions: toBigInt(String(row.impressions ?? "0")),
        reach: toBigInt(String(row.reach ?? "0")),
        clicks: toBigInt(String(row.clicks ?? "0")),
        actionsJson: toNullablePrismaJson(row.actions),
        actionValuesJson: toNullablePrismaJson(row.action_values),
        rawJson: toNullablePrismaJson(row),
        syncedAt: new Date()
      }
    });
  }
}

function normalizeReportQuery(value: Record<string, unknown>, cursor: string | undefined): ReportQuery {
  const dateRange = typeof value.dateRange === "object" && value.dateRange !== null && !Array.isArray(value.dateRange) ? value.dateRange as Record<string, unknown> : undefined;
  const normalizedDateRange = dateRange === undefined ? undefined : {
    ...(typeof dateRange.since === "string" ? { since: dateRange.since } : {}),
    ...(typeof dateRange.until === "string" ? { until: dateRange.until } : {})
  };
  return {
    ...(typeof value.level === "string" ? { level: value.level } : {}),
    ...(normalizedDateRange !== undefined ? { dateRange: normalizedDateRange } : {}),
    breakdowns: Array.isArray(value.breakdowns) ? value.breakdowns.filter((item): item is string => typeof item === "string") : [],
    attributionWindows: Array.isArray(value.attributionWindows) ? value.attributionWindows.filter((item): item is string => typeof item === "string") : [],
    ...(cursor !== undefined ? { cursor } : {})
  };
}

function normalizeLevel(value: string | undefined): "account" | "campaign" | "adset" | "ad" {
  if (value === "campaign" || value === "CAMPAIGN") return "campaign";
  if (value === "adset" || value === "ADSET") return "adset";
  if (value === "ad" || value === "AD") return "ad";
  return "account";
}

function denormalizeLevel(value: string | undefined): "ACCOUNT" | "CAMPAIGN" | "ADSET" | "AD" {
  if (value === "campaign" || value === "CAMPAIGN") return "CAMPAIGN";
  if (value === "adset" || value === "ADSET") return "ADSET";
  if (value === "ad" || value === "AD") return "AD";
  return "ACCOUNT";
}

function insightEntityMetaId(row: Record<string, unknown>, fallback: string): string {
  const value = row.ad_id ?? row.adset_id ?? row.campaign_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}
