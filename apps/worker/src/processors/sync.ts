import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData, type BaseWorkerJobData } from "../queues/schemas.js";
import { shouldRetryJobFailure } from "../queues/retry.js";
import { prisma } from "@adflow/db";
import type { LiveAd, LiveAdAccount, LiveAdSet, LiveAsset, LiveCampaign, LiveCreative, LiveInsight, MetaCursorPage } from "@adflow/meta-client";
import { safeErrorMessage } from "@adflow/shared";
import {
  asDate,
  createProvider,
  errorJson,
  getAccessToken,
  markSyncJob,
  saveCursorCheckpoint,
  toBigInt,
  toNullablePrismaJson,
  toPrismaJson,
  writeAudit,
  writeMetaApiLog,
  type WorkerCursorScope
} from "./service-context.js";

const MAX_SYNC_PAGES = 100;

type SyncMode = "full" | "incremental";
type SyncStats = {
  synced: number;
  pages: number;
  mode: SyncMode;
};

type AccountAssetsPayload = {
  forceFullSync?: boolean;
  cursor?: string;
  since?: string;
};

type EntitiesPayload = {
  entityTypes: Array<"campaign" | "adset" | "ad" | "creative">;
  cursor?: string;
  updatedSince?: string;
};

type InsightsPayload = {
  level: "ACCOUNT" | "CAMPAIGN" | "ADSET" | "AD";
  dateRange: { since: string; until: string };
  breakdowns?: string[];
  attributionWindows?: string[];
  cursor?: string;
};

type PageLoader<T> = (after: string | undefined) => Promise<MetaCursorPage<T>>;
type PageWriter<T> = (rows: readonly T[]) => Promise<number>;

export function createSyncProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<{ synced: number; pages: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.sync, job.name, job.data);
    const startedAt = Date.now();
    let lastProgress = 5;

    await updateProgress(job, lastProgress);
    await markSyncJob({
      organizationId: data.organizationId,
      idempotencyKey: data.idempotencyKey,
      status: "RUNNING",
      progress: lastProgress,
      checkpointJson: {
        jobName: job.name,
        status: "started",
        startedAt: new Date(startedAt).toISOString()
      }
    });

    try {
      const accessToken = await getAccessToken(data.connectionId);
      const provider = createProvider();
      const request = { accessToken, requestId: data.requestId };
      const account = await prisma.adAccount.findUniqueOrThrow({ where: { id: data.adAccountId } });
      let stats: SyncStats;

      if (job.name === "sync-account-assets") {
        stats = await syncAccountAssets({
          data,
          job,
          payload: data.payload as AccountAssetsPayload,
          accountMetaId: account.metaId,
          load: {
            adAccounts: (after) => provider.listAdAccountsPage(request, cursorParams(after)),
            pages: (after) => provider.listPagesPage(request, cursorParams(after)),
            pixels: (after) => provider.listPixelsPage(request, account.metaId, cursorParams(after)),
            customAudiences: (after) => provider.listCustomAudiencesPage(request, account.metaId, cursorParams(after))
          },
          setProgress: async (progress) => {
            lastProgress = progress;
            await updateProgress(job, progress);
          }
        });
      } else if (job.name === "sync-entities") {
        stats = await syncEntities({
          data,
          job,
          payload: data.payload as EntitiesPayload,
          accountMetaId: account.metaId,
          load: {
            campaigns: (after, updatedSince) => provider.listCampaignsPage(request, account.metaId, pageParams(after, updatedSince)),
            adSets: (after, updatedSince) => provider.listAdSetsPage(request, account.metaId, pageParams(after, updatedSince)),
            ads: (after, updatedSince) => provider.listAdsPage(request, account.metaId, pageParams(after, updatedSince)),
            creatives: (after) => provider.listCreativesPage(request, account.metaId, cursorParams(after))
          },
          setProgress: async (progress) => {
            lastProgress = progress;
            await updateProgress(job, progress);
          }
        });
        await prisma.adAccount.update({ where: { id: data.adAccountId }, data: { lastEntitySyncAt: new Date() } });
      } else if (job.name === "sync-insights") {
        const payload = data.payload as InsightsPayload;
        stats = await runPagedSync({
          data,
          job,
          mode: "incremental",
          scope: "INSIGHTS",
          objectKey: insightsObjectKey(data.adAccountId, payload),
          providedCursor: payload.cursor,
          since: new Date(payload.dateRange.since),
          until: new Date(payload.dateRange.until),
          progressBase: 10,
          loadPage: (after) =>
            provider.listInsightsPage(request, account.metaId, {
              level: payload.level.toLowerCase() as "account" | "campaign" | "adset" | "ad",
              since: payload.dateRange.since,
              until: payload.dateRange.until,
              breakdowns: payload.breakdowns ?? [],
              attributionWindows: payload.attributionWindows ?? [],
              ...cursorParams(after)
            }),
          writeRows: (rows) => writeInsightRows(data, account.metaId, account.currency, payload, rows),
          setProgress: async (progress) => {
            lastProgress = progress;
            await updateProgress(job, progress);
          }
        });
        await prisma.adAccount.update({ where: { id: data.adAccountId }, data: { lastInsightsSyncAt: new Date() } });
      } else {
        throw new Error(`Unsupported sync job: ${job.name}`);
      }

      await markSyncJob({
        organizationId: data.organizationId,
        idempotencyKey: data.idempotencyKey,
        status: "SUCCEEDED",
        progress: 100,
        checkpointJson: {
          jobName: job.name,
          status: "completed",
          mode: stats.mode,
          pages: stats.pages,
          synced: stats.synced,
          completedAt: new Date().toISOString()
        },
        resultSummaryJson: stats
      });
      await updateProgress(job, 100);
      await writeMetaApiLog({ organizationId: data.organizationId, operation: `worker.${job.name}`, requestId: data.requestId, startedAt, outcome: "SUCCESS" });
      await writeAudit({
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: `worker.${job.name}`,
        resourceType: "SyncJob",
        outcome: "SUCCESS",
        requestId: data.requestId,
        summaryJson: stats
      });
      return { synced: stats.synced, pages: stats.pages };
    } catch (error) {
      const retrying = shouldRetryJobFailure(error, job.attemptsMade + 1, context.retryPolicy);
      await markSyncJob({
        organizationId: data.organizationId,
        idempotencyKey: data.idempotencyKey,
        status: retrying ? "PARTIAL" : "FAILED",
        progress: retrying ? lastProgress : 100,
        error,
        incrementAttempt: true
      });
      await writeMetaApiLog({ organizationId: data.organizationId, operation: `worker.${job.name}`, requestId: data.requestId, startedAt, outcome: "FAILED", error });
      await writeAudit({
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: `worker.${job.name}`,
        resourceType: "SyncJob",
        outcome: retrying ? "PARTIAL" : "FAILED",
        requestId: data.requestId,
        summaryJson: errorJson(error)
      });
      context.logger.error("sync processor failed", { error: safeErrorMessage(error) });
      throw error;
    }
  };
}

async function syncAccountAssets(input: {
  data: BaseWorkerJobData;
  job: Job<unknown, unknown, string>;
  payload: AccountAssetsPayload;
  accountMetaId: string;
  load: {
    adAccounts: PageLoader<LiveAdAccount>;
    pages: PageLoader<LiveAsset>;
    pixels: PageLoader<LiveAsset>;
    customAudiences: PageLoader<LiveAsset>;
  };
  setProgress: (progress: number) => Promise<void>;
}): Promise<SyncStats> {
  const mode: SyncMode = input.payload.forceFullSync === true ? "full" : input.payload.since !== undefined || input.payload.cursor !== undefined ? "incremental" : "full";
  const since = input.payload.since === undefined ? undefined : new Date(input.payload.since);
  let synced = 0;
  let pages = 0;
  const forceFull = input.payload.forceFullSync === true;

  const sections: Array<{ scope: WorkerCursorScope; objectKey: string; cursor: string | undefined; progressBase: number; loadPage: PageLoader<LiveAsset | LiveAdAccount>; writeRows: PageWriter<LiveAsset | LiveAdAccount> }> = [
    {
      scope: "AD_ACCOUNTS",
      objectKey: `${input.data.organizationId}:ad-accounts`,
      cursor: input.payload.cursor,
      progressBase: 10,
      loadPage: input.load.adAccounts,
      writeRows: (rows) => writeAdAccountRows(input.data, rows as readonly LiveAdAccount[])
    },
    {
      scope: "PAGES",
      objectKey: `${input.data.adAccountId}:pages`,
      cursor: undefined,
      progressBase: 30,
      loadPage: input.load.pages,
      writeRows: (rows) => writePageRows(input.data, rows as readonly LiveAsset[])
    },
    {
      scope: "PIXELS",
      objectKey: `${input.data.adAccountId}:pixels`,
      cursor: undefined,
      progressBase: 50,
      loadPage: input.load.pixels,
      writeRows: (rows) => writePixelRows(input.data, rows as readonly LiveAsset[])
    },
    {
      scope: "CUSTOM_AUDIENCES",
      objectKey: `${input.data.adAccountId}:custom-audiences`,
      cursor: undefined,
      progressBase: 70,
      loadPage: input.load.customAudiences,
      writeRows: (rows) => writeCustomAudienceRows(input.data, rows as readonly LiveAsset[])
    }
  ];

  for (const section of sections) {
    const sectionStats = await runPagedSync({
      data: input.data,
      job: input.job,
      mode,
      scope: section.scope,
      objectKey: section.objectKey,
      forceFull,
      providedCursor: section.cursor,
      since,
      progressBase: section.progressBase,
      loadPage: section.loadPage,
      writeRows: section.writeRows,
      setProgress: input.setProgress
    });
    synced += sectionStats.synced;
    pages += sectionStats.pages;
  }
  return { synced, pages, mode };
}

async function syncEntities(input: {
  data: BaseWorkerJobData;
  job: Job<unknown, unknown, string>;
  payload: EntitiesPayload;
  accountMetaId: string;
  load: {
    campaigns: (after: string | undefined, updatedSince: string | undefined) => Promise<MetaCursorPage<LiveCampaign>>;
    adSets: (after: string | undefined, updatedSince: string | undefined) => Promise<MetaCursorPage<LiveAdSet>>;
    ads: (after: string | undefined, updatedSince: string | undefined) => Promise<MetaCursorPage<LiveAd>>;
    creatives: PageLoader<LiveCreative>;
  };
  setProgress: (progress: number) => Promise<void>;
}): Promise<SyncStats> {
  const mode: SyncMode = input.payload.updatedSince === undefined ? "full" : "incremental";
  const since = input.payload.updatedSince === undefined ? undefined : new Date(input.payload.updatedSince);
  const singleEntityCursor = input.payload.entityTypes.length === 1 ? input.payload.cursor : undefined;
  let synced = 0;
  let pages = 0;

  for (const entityType of input.payload.entityTypes) {
    const progressBase = entityProgressBase(entityType);
    if (entityType === "campaign") {
      const stats = await runPagedSync({
        data: input.data,
        job: input.job,
        mode,
        scope: "CAMPAIGNS",
        objectKey: `${input.data.adAccountId}:campaigns`,
        providedCursor: singleEntityCursor,
        since,
        progressBase,
        loadPage: (after) => input.load.campaigns(after, input.payload.updatedSince),
        writeRows: (rows) => writeCampaignRows(input.data, rows),
        setProgress: input.setProgress
      });
      synced += stats.synced;
      pages += stats.pages;
    }
    if (entityType === "adset") {
      const stats = await runPagedSync({
        data: input.data,
        job: input.job,
        mode,
        scope: "ADSETS",
        objectKey: `${input.data.adAccountId}:adsets`,
        providedCursor: singleEntityCursor,
        since,
        progressBase,
        loadPage: (after) => input.load.adSets(after, input.payload.updatedSince),
        writeRows: (rows) => writeAdSetRows(input.data, rows),
        setProgress: input.setProgress
      });
      synced += stats.synced;
      pages += stats.pages;
    }
    if (entityType === "ad") {
      const stats = await runPagedSync({
        data: input.data,
        job: input.job,
        mode,
        scope: "ADS",
        objectKey: `${input.data.adAccountId}:ads`,
        providedCursor: singleEntityCursor,
        since,
        progressBase,
        loadPage: (after) => input.load.ads(after, input.payload.updatedSince),
        writeRows: (rows) => writeAdRows(input.data, rows),
        setProgress: input.setProgress
      });
      synced += stats.synced;
      pages += stats.pages;
    }
    if (entityType === "creative") {
      const stats = await runPagedSync({
        data: input.data,
        job: input.job,
        mode,
        scope: "CREATIVES",
        objectKey: `${input.data.adAccountId}:creatives`,
        providedCursor: singleEntityCursor,
        since,
        progressBase,
        loadPage: input.load.creatives,
        writeRows: (rows) => writeCreativeRows(input.data, rows),
        setProgress: input.setProgress
      });
      synced += stats.synced;
      pages += stats.pages;
    }
  }

  return { synced, pages, mode };
}

async function runPagedSync<T>(input: {
  data: BaseWorkerJobData;
  job: Job<unknown, unknown, string>;
  mode: SyncMode;
  scope: WorkerCursorScope;
  objectKey: string;
  forceFull?: boolean | undefined;
  providedCursor?: string | undefined;
  since?: Date | undefined;
  until?: Date | undefined;
  progressBase: number;
  loadPage: PageLoader<T>;
  writeRows: PageWriter<T>;
  setProgress: (progress: number) => Promise<void>;
}): Promise<SyncStats> {
  let after = await initialCursor({
    organizationId: input.data.organizationId,
    scope: input.scope,
    objectKey: input.objectKey,
    providedCursor: input.providedCursor,
    forceFull: input.forceFull === true
  });
  let synced = 0;
  let pages = 0;

  for (let pageNumber = 1; pageNumber <= MAX_SYNC_PAGES; pageNumber += 1) {
    const page = await input.loadPage(after);
    const written = await input.writeRows(page.data);
    synced += written;
    pages += 1;
    const nextAfter = page.cursor.nextAfter ?? page.cursor.after;
    const checkpoint = {
      jobName: input.job.name,
      mode: input.mode,
      scope: input.scope,
      objectKey: input.objectKey,
      pageNumber,
      pageRows: page.data.length,
      synced,
      nextCursor: nextAfter ?? null,
      hasNextPage: page.cursor.hasNextPage,
      updatedAt: new Date().toISOString()
    };
    await saveCursorCheckpoint({
      organizationId: input.data.organizationId,
      connectionId: input.data.connectionId,
      adAccountId: input.data.adAccountId,
      scope: input.scope,
      objectKey: input.objectKey,
      ...(nextAfter !== undefined ? { after: nextAfter } : {}),
      ...(input.since !== undefined ? { since: input.since } : {}),
      ...(input.until !== undefined ? { until: input.until } : {}),
      checkpointJson: checkpoint,
      completed: !page.cursor.hasNextPage || nextAfter === undefined
    });
    const progress = Math.min(95, input.progressBase + pageNumber * 3);
    await markSyncJob({
      organizationId: input.data.organizationId,
      idempotencyKey: input.data.idempotencyKey,
      status: "RUNNING",
      progress,
      checkpointJson: checkpoint
    });
    await input.setProgress(progress);

    if (!page.cursor.hasNextPage || nextAfter === undefined) {
      return { synced, pages, mode: input.mode };
    }
    after = nextAfter;
  }

  throw new Error(`Meta sync pagination exceeded ${MAX_SYNC_PAGES} pages for ${input.scope}.`);
}

async function initialCursor(input: { organizationId: string; scope: WorkerCursorScope; objectKey: string; providedCursor?: string | undefined; forceFull: boolean }): Promise<string | undefined> {
  if (input.forceFull) return undefined;
  if (input.providedCursor !== undefined) return input.providedCursor;
  const cursor = await prisma.cursor.findUnique({
    where: {
      organizationId_scope_objectKey: {
        organizationId: input.organizationId,
        scope: input.scope,
        objectKey: input.objectKey
      }
    }
  });
  if (cursor?.completedAt !== null) return undefined;
  return cursor?.after ?? undefined;
}

async function writeAdAccountRows(data: BaseWorkerJobData, rows: readonly LiveAdAccount[]): Promise<number> {
  for (const row of rows) {
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
        sourceLastSeenAt: new Date(),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writePageRows(data: BaseWorkerJobData, rows: readonly LiveAsset[]): Promise<number> {
  for (const page of rows) {
    await prisma.page.upsert({
      where: { organizationId_metaId: { organizationId: data.organizationId, metaId: page.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        metaId: page.metaId,
        name: page.name ?? page.metaId,
        category: stringFromRecord(page.raw, "category") ?? null,
        tasks: stringArrayFromRecord(page.raw, "tasks"),
        rawJson: toNullablePrismaJson(page.raw),
        sourceLastSeenAt: new Date()
      },
      update: {
        name: page.name ?? page.metaId,
        category: stringFromRecord(page.raw, "category") ?? null,
        tasks: stringArrayFromRecord(page.raw, "tasks"),
        rawJson: toNullablePrismaJson(page.raw),
        sourceLastSeenAt: new Date(),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writePixelRows(data: BaseWorkerJobData, rows: readonly LiveAsset[]): Promise<number> {
  for (const pixel of rows) {
    await prisma.pixel.upsert({
      where: { organizationId_metaId: { organizationId: data.organizationId, metaId: pixel.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        metaId: pixel.metaId,
        name: pixel.name ?? pixel.metaId,
        code: stringFromRecord(pixel.raw, "code") ?? null,
        rawJson: toNullablePrismaJson(pixel.raw),
        sourceLastSeenAt: new Date()
      },
      update: {
        name: pixel.name ?? pixel.metaId,
        code: stringFromRecord(pixel.raw, "code") ?? null,
        rawJson: toNullablePrismaJson(pixel.raw),
        sourceLastSeenAt: new Date(),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writeCustomAudienceRows(data: BaseWorkerJobData, rows: readonly LiveAsset[]): Promise<number> {
  for (const audience of rows) {
    await prisma.customAudience.upsert({
      where: { organizationId_metaId: { organizationId: data.organizationId, metaId: audience.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        metaId: audience.metaId,
        name: audience.name ?? audience.metaId,
        subtype: stringFromRecord(audience.raw, "subtype") ?? null,
        approximateCount: toBigInt(stringFromRecord(audience.raw, "approximate_count")),
        deliveryStatusJson: toNullablePrismaJson(recordValue(audience.raw, "delivery_status")),
        operationStatusJson: toNullablePrismaJson(recordValue(audience.raw, "operation_status")),
        rawJson: toNullablePrismaJson(audience.raw),
        sourceLastSeenAt: new Date()
      },
      update: {
        name: audience.name ?? audience.metaId,
        subtype: stringFromRecord(audience.raw, "subtype") ?? null,
        approximateCount: toBigInt(stringFromRecord(audience.raw, "approximate_count")),
        deliveryStatusJson: toNullablePrismaJson(recordValue(audience.raw, "delivery_status")),
        operationStatusJson: toNullablePrismaJson(recordValue(audience.raw, "operation_status")),
        rawJson: toNullablePrismaJson(audience.raw),
        sourceLastSeenAt: new Date(),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writeCampaignRows(data: BaseWorkerJobData, rows: readonly LiveCampaign[]): Promise<number> {
  for (const row of rows) {
    await prisma.campaign.upsert({
      where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        metaId: row.metaId,
        name: row.name,
        objective: row.objective ?? null,
        configuredStatus: row.configuredStatus,
        effectiveStatus: row.effectiveStatus,
        dailyBudgetMinor: toBigInt(row.dailyBudgetMinor),
        sourceUpdatedAt: asDate(row.updatedTime),
        sourceLastSeenAt: new Date(),
        specialAdCategories: [],
        rawJson: toNullablePrismaJson(row)
      },
      update: {
        name: row.name,
        objective: row.objective ?? null,
        configuredStatus: row.configuredStatus,
        effectiveStatus: row.effectiveStatus,
        dailyBudgetMinor: toBigInt(row.dailyBudgetMinor),
        sourceUpdatedAt: asDate(row.updatedTime),
        sourceLastSeenAt: new Date(),
        rawJson: toNullablePrismaJson(row),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writeAdSetRows(data: BaseWorkerJobData, rows: readonly LiveAdSet[]): Promise<number> {
  for (const row of rows) {
    const campaign = await prisma.campaign.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.campaignMetaId } });
    await prisma.adSet.upsert({
      where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        campaignId: campaign?.id ?? null,
        campaignMetaId: row.campaignMetaId,
        metaId: row.metaId,
        name: row.name,
        configuredStatus: row.configuredStatus,
        effectiveStatus: row.effectiveStatus,
        dailyBudgetMinor: toBigInt(row.dailyBudgetMinor),
        lifetimeBudgetMinor: toBigInt(row.lifetimeBudgetMinor),
        optimizationGoal: row.optimizationGoal ?? null,
        billingEvent: row.billingEvent ?? null,
        targetingJson: toNullablePrismaJson(row.targetingJson),
        promotedObjectJson: toNullablePrismaJson(row.promotedObjectJson),
        sourceUpdatedAt: asDate(row.updatedTime),
        sourceLastSeenAt: new Date(),
        rawJson: toNullablePrismaJson(row)
      },
      update: {
        campaignId: campaign?.id ?? null,
        name: row.name,
        configuredStatus: row.configuredStatus,
        effectiveStatus: row.effectiveStatus,
        dailyBudgetMinor: toBigInt(row.dailyBudgetMinor),
        lifetimeBudgetMinor: toBigInt(row.lifetimeBudgetMinor),
        optimizationGoal: row.optimizationGoal ?? null,
        billingEvent: row.billingEvent ?? null,
        targetingJson: toNullablePrismaJson(row.targetingJson),
        promotedObjectJson: toNullablePrismaJson(row.promotedObjectJson),
        sourceUpdatedAt: asDate(row.updatedTime),
        sourceLastSeenAt: new Date(),
        rawJson: toNullablePrismaJson(row),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writeAdRows(data: BaseWorkerJobData, rows: readonly LiveAd[]): Promise<number> {
  for (const row of rows) {
    const [campaign, adSet, creative] = await Promise.all([
      prisma.campaign.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.campaignMetaId } }),
      prisma.adSet.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.adSetMetaId } }),
      row.creativeMetaId ? prisma.creative.findFirst({ where: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.creativeMetaId } }) : Promise.resolve(null)
    ]);
    await prisma.ad.upsert({
      where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        campaignId: campaign?.id ?? null,
        adSetId: adSet?.id ?? null,
        creativeId: creative?.id ?? null,
        campaignMetaId: row.campaignMetaId,
        adSetMetaId: row.adSetMetaId,
        creativeMetaId: row.creativeMetaId ?? null,
        metaId: row.metaId,
        name: row.name,
        configuredStatus: row.configuredStatus,
        effectiveStatus: row.effectiveStatus,
        sourceUpdatedAt: asDate(row.updatedTime),
        sourceLastSeenAt: new Date(),
        rawJson: toNullablePrismaJson(row)
      },
      update: {
        campaignId: campaign?.id ?? null,
        adSetId: adSet?.id ?? null,
        creativeId: creative?.id ?? null,
        creativeMetaId: row.creativeMetaId ?? null,
        name: row.name,
        configuredStatus: row.configuredStatus,
        effectiveStatus: row.effectiveStatus,
        sourceUpdatedAt: asDate(row.updatedTime),
        sourceLastSeenAt: new Date(),
        rawJson: toNullablePrismaJson(row),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writeCreativeRows(data: BaseWorkerJobData, rows: readonly LiveCreative[]): Promise<number> {
  for (const row of rows) {
    await prisma.creative.upsert({
      where: { organizationId_adAccountId_metaId: { organizationId: data.organizationId, adAccountId: data.adAccountId, metaId: row.metaId } },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        metaId: row.metaId,
        name: row.name ?? null,
        title: row.title ?? null,
        body: row.body ?? null,
        imageHash: row.imageHash ?? null,
        imageUrl: row.imageUrl ?? null,
        thumbnailUrl: row.thumbnailUrl ?? null,
        status: row.status ?? null,
        rawJson: toNullablePrismaJson(row.raw),
        sourceLastSeenAt: new Date()
      },
      update: {
        name: row.name ?? null,
        title: row.title ?? null,
        body: row.body ?? null,
        imageHash: row.imageHash ?? null,
        imageUrl: row.imageUrl ?? null,
        thumbnailUrl: row.thumbnailUrl ?? null,
        status: row.status ?? null,
        rawJson: toNullablePrismaJson(row.raw),
        sourceLastSeenAt: new Date(),
        isDeletedAtSource: false
      }
    });
  }
  return rows.length;
}

async function writeInsightRows(data: BaseWorkerJobData, accountMetaId: string, currency: string, payload: InsightsPayload, rows: readonly LiveInsight[]): Promise<number> {
  const breakdownHash = JSON.stringify(payload.breakdowns ?? []);
  const attributionHash = JSON.stringify(payload.attributionWindows ?? []);
  for (const row of rows) {
    const entityMetaId = insightEntityMetaId(row, accountMetaId);
    await prisma.insight.upsert({
      where: {
        organizationId_adAccountId_level_entityMetaId_dateStart_dateStop_timeIncrement_breakdownHash_attributionHash: {
          organizationId: data.organizationId,
          adAccountId: data.adAccountId,
          level: payload.level,
          entityMetaId,
          dateStart: new Date(String(row.date_start ?? payload.dateRange.since)),
          dateStop: new Date(String(row.date_stop ?? payload.dateRange.until)),
          timeIncrement: "1",
          breakdownHash,
          attributionHash
        }
      },
      create: {
        organizationId: data.organizationId,
        adAccountId: data.adAccountId,
        level: payload.level,
        entityMetaId,
        dateStart: new Date(String(row.date_start ?? payload.dateRange.since)),
        dateStop: new Date(String(row.date_stop ?? payload.dateRange.until)),
        timeIncrement: "1",
        breakdownHash,
        breakdownJson: toPrismaJson(payload.breakdowns ?? []),
        attributionHash,
        attributionJson: toNullablePrismaJson(payload.attributionWindows ?? []),
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
  return rows.length;
}

function insightEntityMetaId(row: Record<string, unknown>, fallback: string): string {
  const value = row.ad_id ?? row.adset_id ?? row.campaign_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function cursorParams(after: string | undefined): { after?: string } {
  return after === undefined ? {} : { after };
}

function pageParams(after: string | undefined, updatedSince: string | undefined): { after?: string; updatedSince?: string } {
  return {
    ...(after !== undefined ? { after } : {}),
    ...(updatedSince !== undefined ? { updatedSince } : {})
  };
}

async function updateProgress(job: Job<unknown, unknown, string>, progress: number): Promise<void> {
  await job.updateProgress(progress);
}

function entityProgressBase(entityType: "campaign" | "adset" | "ad" | "creative"): number {
  if (entityType === "campaign") return 10;
  if (entityType === "adset") return 30;
  if (entityType === "ad") return 50;
  return 70;
}

function insightsObjectKey(adAccountId: string, payload: InsightsPayload): string {
  return [
    adAccountId,
    "insights",
    payload.level,
    payload.dateRange.since,
    payload.dateRange.until,
    JSON.stringify(payload.breakdowns ?? []),
    JSON.stringify(payload.attributionWindows ?? [])
  ].join(":");
}

function recordValue(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function stringFromRecord(value: unknown, key: string): string | undefined {
  const entry = recordValue(value, key);
  if (typeof entry === "string" && entry.length > 0) return entry;
  if (typeof entry === "number" && Number.isFinite(entry)) return String(entry);
  return undefined;
}

function stringArrayFromRecord(value: unknown, key: string): string[] {
  const entry = recordValue(value, key);
  if (!Array.isArray(entry)) return [];
  return entry.filter((item): item is string => typeof item === "string");
}
