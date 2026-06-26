import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";
import { prisma } from "@adflow/db";
import { safeErrorMessage } from "@adflow/shared";
import { asDate, createProvider, getAccessToken, markSyncJob, toBigInt, toNullablePrismaJson, toPrismaJson, writeAudit } from "./service-context.js";

export function createSyncProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<{ synced: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.sync, job.name, job.data);
    await markSyncJob({ organizationId: data.organizationId, idempotencyKey: data.idempotencyKey, status: "RUNNING", progress: 5 });
    try {
      const accessToken = await getAccessToken(data.connectionId);
      const provider = createProvider();
      const account = await prisma.adAccount.findUniqueOrThrow({ where: { id: data.adAccountId } });
      let synced = 0;

      if (job.name === "sync-account-assets") {
        const [accounts, pages, pixels, audiences] = await Promise.all([
          provider.listAdAccounts({ accessToken, requestId: data.requestId }),
          provider.listPages({ accessToken, requestId: data.requestId }),
          provider.listPixels({ accessToken, requestId: data.requestId }, account.metaId),
          provider.listCustomAudiences({ accessToken, requestId: data.requestId }, account.metaId)
        ]);
        for (const row of accounts) {
          await prisma.adAccount.upsert({
            where: { organizationId_metaId: { organizationId: data.organizationId, metaId: row.metaId } },
            create: {
              metaId: row.metaId,
              accountId: row.accountId,
              name: row.name,
              status: row.status,
              disableReason: row.disableReason ?? null,
              currency: row.currency,
              timezoneName: row.timezoneName,
              dataSource: "LIVE",
              isReadOnly: row.isReadOnly,
              rawJson: toPrismaJson(row),
              sourceLastSeenAt: new Date(),
              organizationId: data.organizationId,
              connectionId: data.connectionId
            },
            update: {
              name: row.name,
              status: row.status,
              disableReason: row.disableReason ?? null,
              currency: row.currency,
              timezoneName: row.timezoneName,
              isReadOnly: row.isReadOnly,
              rawJson: toPrismaJson(row),
              sourceLastSeenAt: new Date()
            }
          });
          synced += 1;
        }
        for (const page of pages) {
          await prisma.page.upsert({
            where: { organizationId_metaId: { organizationId: data.organizationId, metaId: page.metaId } },
            create: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: page.metaId, name: page.name ?? page.metaId, tasks: [], rawJson: toNullablePrismaJson(page.raw), sourceLastSeenAt: new Date() },
            update: { name: page.name ?? page.metaId, rawJson: toNullablePrismaJson(page.raw), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
          });
          synced += 1;
        }
        for (const pixel of pixels) {
          await prisma.pixel.upsert({
            where: { organizationId_metaId: { organizationId: data.organizationId, metaId: pixel.metaId } },
            create: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: pixel.metaId, name: pixel.name ?? pixel.metaId, rawJson: toNullablePrismaJson(pixel.raw), sourceLastSeenAt: new Date() },
            update: { name: pixel.name ?? pixel.metaId, rawJson: toNullablePrismaJson(pixel.raw), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
          });
          synced += 1;
        }
        for (const audience of audiences) {
          await prisma.customAudience.upsert({
            where: { organizationId_metaId: { organizationId: data.organizationId, metaId: audience.metaId } },
            create: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: audience.metaId, name: audience.name ?? audience.metaId, rawJson: toNullablePrismaJson(audience.raw), sourceLastSeenAt: new Date() },
            update: { name: audience.name ?? audience.metaId, rawJson: toNullablePrismaJson(audience.raw), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
          });
          synced += 1;
        }
      }

      if (job.name === "sync-entities") {
        const payload = data.payload as { entityTypes: string[] };
        if (payload.entityTypes.includes("campaign")) {
          for (const row of await provider.listCampaigns({ accessToken, requestId: data.requestId }, account.metaId)) {
            await prisma.campaign.upsert({
              where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
              create: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId, name: row.name, objective: row.objective ?? null, configuredStatus: row.configuredStatus, effectiveStatus: row.effectiveStatus, dailyBudgetMinor: toBigInt(row.dailyBudgetMinor), sourceUpdatedAt: asDate(row.updatedTime), sourceLastSeenAt: new Date(), specialAdCategories: [], rawJson: toNullablePrismaJson(row) },
              update: { name: row.name, objective: row.objective ?? null, configuredStatus: row.configuredStatus, effectiveStatus: row.effectiveStatus, dailyBudgetMinor: toBigInt(row.dailyBudgetMinor), sourceUpdatedAt: asDate(row.updatedTime), sourceLastSeenAt: new Date(), rawJson: toNullablePrismaJson(row), isDeletedAtSource: false }
            });
            synced += 1;
          }
        }
        if (payload.entityTypes.includes("adset")) {
          for (const row of await provider.listAdSets({ accessToken, requestId: data.requestId }, account.metaId)) {
            const campaign = await prisma.campaign.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.campaignMetaId } });
            await prisma.adSet.upsert({
              where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
              create: { organizationId: data.organizationId, adAccountId: data.adAccountId, campaignId: campaign?.id ?? null, campaignMetaId: row.campaignMetaId, metaId: row.metaId, name: row.name, configuredStatus: row.configuredStatus, effectiveStatus: row.effectiveStatus, dailyBudgetMinor: toBigInt(row.dailyBudgetMinor), lifetimeBudgetMinor: toBigInt(row.lifetimeBudgetMinor), optimizationGoal: row.optimizationGoal ?? null, billingEvent: row.billingEvent ?? null, targetingJson: toNullablePrismaJson(row.targetingJson), promotedObjectJson: toNullablePrismaJson(row.promotedObjectJson), sourceUpdatedAt: asDate(row.updatedTime), sourceLastSeenAt: new Date(), rawJson: toNullablePrismaJson(row) },
              update: { campaignId: campaign?.id ?? null, name: row.name, configuredStatus: row.configuredStatus, effectiveStatus: row.effectiveStatus, dailyBudgetMinor: toBigInt(row.dailyBudgetMinor), lifetimeBudgetMinor: toBigInt(row.lifetimeBudgetMinor), optimizationGoal: row.optimizationGoal ?? null, billingEvent: row.billingEvent ?? null, targetingJson: toNullablePrismaJson(row.targetingJson), promotedObjectJson: toNullablePrismaJson(row.promotedObjectJson), sourceUpdatedAt: asDate(row.updatedTime), sourceLastSeenAt: new Date(), rawJson: toNullablePrismaJson(row), isDeletedAtSource: false }
            });
            synced += 1;
          }
        }
        if (payload.entityTypes.includes("ad")) {
          for (const row of await provider.listAds({ accessToken, requestId: data.requestId }, account.metaId)) {
            const campaign = await prisma.campaign.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.campaignMetaId } });
            const adSet = await prisma.adSet.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.adSetMetaId } });
            const creative = row.creativeMetaId ? await prisma.creative.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.creativeMetaId } }) : null;
            await prisma.ad.upsert({
              where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
              create: { organizationId: data.organizationId, adAccountId: data.adAccountId, campaignId: campaign?.id ?? null, adSetId: adSet?.id ?? null, creativeId: creative?.id ?? null, campaignMetaId: row.campaignMetaId, adSetMetaId: row.adSetMetaId, creativeMetaId: row.creativeMetaId ?? null, metaId: row.metaId, name: row.name, configuredStatus: row.configuredStatus, effectiveStatus: row.effectiveStatus, sourceUpdatedAt: asDate(row.updatedTime), sourceLastSeenAt: new Date(), rawJson: toNullablePrismaJson(row) },
              update: { campaignId: campaign?.id ?? null, adSetId: adSet?.id ?? null, creativeId: creative?.id ?? null, creativeMetaId: row.creativeMetaId ?? null, name: row.name, configuredStatus: row.configuredStatus, effectiveStatus: row.effectiveStatus, sourceUpdatedAt: asDate(row.updatedTime), sourceLastSeenAt: new Date(), rawJson: toNullablePrismaJson(row), isDeletedAtSource: false }
            });
            synced += 1;
          }
        }
        if (payload.entityTypes.includes("creative")) {
          for (const row of await provider.listCreatives({ accessToken, requestId: data.requestId }, account.metaId)) {
            await prisma.creative.upsert({
              where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
              create: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId, name: row.name ?? null, title: row.title ?? null, body: row.body ?? null, imageHash: row.imageHash ?? null, imageUrl: row.imageUrl ?? null, thumbnailUrl: row.thumbnailUrl ?? null, status: row.status ?? null, rawJson: toNullablePrismaJson(row.raw), sourceLastSeenAt: new Date() },
              update: { name: row.name ?? null, title: row.title ?? null, body: row.body ?? null, imageHash: row.imageHash ?? null, imageUrl: row.imageUrl ?? null, thumbnailUrl: row.thumbnailUrl ?? null, status: row.status ?? null, rawJson: toNullablePrismaJson(row.raw), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
            });
            synced += 1;
          }
        }
      }

      if (job.name === "sync-insights") {
        const payload = data.payload as { level: "ACCOUNT" | "CAMPAIGN" | "ADSET" | "AD"; dateRange: { since: string; until: string }; breakdowns?: string[]; attributionWindows?: string[] };
        const rows = await provider.listInsights({ accessToken, requestId: data.requestId }, account.metaId, {
          level: payload.level.toLowerCase() as "account" | "campaign" | "adset" | "ad",
          since: payload.dateRange.since,
          until: payload.dateRange.until,
          ...(payload.breakdowns !== undefined ? { breakdowns: payload.breakdowns } : {}),
          ...(payload.attributionWindows !== undefined ? { attributionWindows: payload.attributionWindows } : {})
        });
        for (const row of rows) {
          const entityMetaId = insightEntityMetaId(row, account.metaId);
          const breakdownHash = JSON.stringify(payload.breakdowns ?? []);
          const attributionHash = JSON.stringify(payload.attributionWindows ?? []);
          await prisma.insight.upsert({
            where: { organizationId_adAccountId_level_entityMetaId_dateStart_dateStop_timeIncrement_breakdownHash_attributionHash: { organizationId: data.organizationId, adAccountId: data.adAccountId, level: payload.level, entityMetaId, dateStart: new Date(String(row.date_start ?? payload.dateRange.since)), dateStop: new Date(String(row.date_stop ?? payload.dateRange.until)), timeIncrement: "1", breakdownHash, attributionHash } },
            create: { organizationId: data.organizationId, adAccountId: data.adAccountId, level: payload.level, entityMetaId, dateStart: new Date(String(row.date_start ?? payload.dateRange.since)), dateStop: new Date(String(row.date_stop ?? payload.dateRange.until)), timeIncrement: "1", breakdownHash, breakdownJson: toPrismaJson(payload.breakdowns ?? []), attributionHash, attributionJson: toNullablePrismaJson(payload.attributionWindows ?? []), currency: account.currency, spend: String(row.spend ?? "0"), impressions: toBigInt(String(row.impressions ?? "0")), reach: toBigInt(String(row.reach ?? "0")), clicks: toBigInt(String(row.clicks ?? "0")), actionsJson: toNullablePrismaJson(row.actions), actionValuesJson: toNullablePrismaJson(row.action_values), rawJson: toNullablePrismaJson(row) },
            update: { spend: String(row.spend ?? "0"), impressions: toBigInt(String(row.impressions ?? "0")), reach: toBigInt(String(row.reach ?? "0")), clicks: toBigInt(String(row.clicks ?? "0")), actionsJson: toNullablePrismaJson(row.actions), actionValuesJson: toNullablePrismaJson(row.action_values), rawJson: toNullablePrismaJson(row), syncedAt: new Date() }
          });
          synced += 1;
        }
      }

      await markSyncJob({ organizationId: data.organizationId, idempotencyKey: data.idempotencyKey, status: "SUCCEEDED", progress: 100, resultSummaryJson: { synced } });
      await writeAudit({ organizationId: data.organizationId, actorUserId: data.actorUserId, action: `worker.${job.name}`, resourceType: "SyncJob", outcome: "SUCCESS", requestId: data.requestId, summaryJson: { synced } });
      return { synced };
    } catch (error) {
      await markSyncJob({ organizationId: data.organizationId, idempotencyKey: data.idempotencyKey, status: "FAILED", progress: 100, error });
      context.logger.error("sync processor failed", { error: safeErrorMessage(error) });
      throw error;
    }
  };
}

function insightEntityMetaId(row: Record<string, unknown>, fallback: string): string {
  const value = row.ad_id ?? row.adset_id ?? row.campaign_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}
