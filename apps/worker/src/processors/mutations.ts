import { UnrecoverableError, type Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";
import { prisma } from "@adflow/db";
import { evaluateMetaMutationGuard, type MetaMutationResult } from "@adflow/meta-client";
import { parseServerEnv, safeErrorMessage } from "@adflow/shared";
import { createProvider, errorJson, getAccessToken, toBigInt, toNullablePrismaJson, toPrismaJson, writeAudit, writeMetaApiLog } from "./service-context.js";

type OperationResult = MetaMutationResult & Record<string, unknown>;

export function createMutationsProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<{ operationId: string; metaId?: string }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.mutations, job.name, job.data);
    const payload = data.payload as { mutationRequestId?: string; mutationType?: string; payload?: Record<string, unknown>; mutationRequestIds?: string[] };
    if (job.name === "apply-batch") {
      const results = [];
      for (const operationId of payload.mutationRequestIds ?? []) {
        results.push(await applyOperation(operationId, data, context));
      }
      return { operationId: payload.mutationRequestIds?.[0] ?? data.idempotencyKey, metaId: String(results.length) };
    }
    if (!payload.mutationRequestId) throw new Error("mutationRequestId is required.");
    return applyOperation(payload.mutationRequestId, data, context, payload.mutationType);
  };
}

async function applyOperation(operationId: string, data: ReturnType<typeof parseWorkerJobData>, context: ProcessorContext, expectedMutationType?: string): Promise<{ operationId: string; metaId?: string }> {
  const startedAt = Date.now();
  const env = parseServerEnv(process.env);
  const operation = await prisma.operation.findUniqueOrThrow({ where: { id: operationId } });
  if (operation.organizationId !== data.organizationId || operation.adAccountId !== data.adAccountId || operation.connectionId !== data.connectionId) {
    throw new Error("Mutation operation does not match the worker job account, connection, or organization.");
  }
  if (expectedMutationType !== undefined && expectedMutationType !== operation.type) {
    throw new Error(`Mutation operation type mismatch: expected ${expectedMutationType}, found ${operation.type}.`);
  }
  if (operation.status === "SUCCEEDED") {
    const metaId = readMetaId(operation.resultJson) ?? readMetaId(operation.metaObjectIdsJson);
    return metaId === undefined ? { operationId: operation.id } : { operationId: operation.id, metaId };
  }
  if (operation.status === "CANCELLED" || operation.status === "UNKNOWN_OUTCOME") {
    throw new UnrecoverableError(`Mutation operation ${operation.id} is ${operation.status}.`);
  }
  const [account, connection, membership] = await Promise.all([
    prisma.adAccount.findUniqueOrThrow({ where: { id: operation.adAccountId } }),
    prisma.metaConnection.findUniqueOrThrow({ where: { id: operation.connectionId } }),
    operation.actorUserId ? prisma.membership.findFirst({ where: { organizationId: operation.organizationId, userId: operation.actorUserId } }) : null
  ]);
  const guard = evaluateMetaMutationGuard({
    adAccountMetaId: account.metaId,
    enableMetaWrites: env.ENABLE_META_WRITES,
    emergencyReadonly: env.EMERGENCY_READONLY,
    allowedMetaAdAccountIds: env.ALLOWED_META_AD_ACCOUNT_IDS,
    role: membership?.role ?? "VIEWER",
    scopes: connection.scopes,
    accountReadOnly: account.isReadOnly,
    connectionHealthy: connection.status === "HEALTHY"
  }, operation.id);
  if (!guard.allowed) {
    await prisma.operation.update({ where: { id: operation.id }, data: { status: "FAILED", errorJson: { reasons: guard.reasons }, completedAt: new Date() } });
    await writeAudit({ organizationId: operation.organizationId, actorUserId: operation.actorUserId ?? undefined, action: `meta.write.${operation.type}`, resourceType: "Operation", resourceId: operation.id, outcome: "DENIED", requestId: operation.requestId, summaryJson: { reasons: guard.reasons } });
    await writeMetaApiLog({ organizationId: operation.organizationId, operation: `meta.write.${operation.type}`, requestId: operation.requestId, startedAt, outcome: "DENIED" });
    throw new Error(`Meta write denied: ${guard.reasons.join(", ")}`);
  }

  await prisma.operation.update({ where: { id: operation.id }, data: { status: "RUNNING", startedAt: new Date(), attemptCount: { increment: 1 } } });
  try {
    const accessToken = await getAccessToken(operation.connectionId);
    const provider = createProvider();
    const payload = operation.payloadJson as Record<string, unknown>;
    let result: OperationResult;
    switch (operation.type) {
      case "create-bundle": {
        const campaignName = stringFromUnknown(payload.campaignName ?? payload.name, "Untitled Campaign");
        const campaignObjective = stringFromUnknown(payload.objective, "OUTCOME_TRAFFIC");
        const adSetName = stringFromUnknown(payload.adSetName, `${campaignName} Ad Set`);
        const optimizationGoal = stringFromUnknown(payload.optimizationGoal, "LINK_CLICKS");
        const billingEvent = stringFromUnknown(payload.billingEvent, "IMPRESSIONS");
        const creativeName = stringFromUnknown(payload.creativeName ?? payload.title, `${campaignName} Creative`);
        const creativeTitle = stringFromUnknown(payload.title, campaignName);
        const destinationUrl = stringFromUnknown(payload.destinationUrl, "");
        const adName = stringFromUnknown(payload.adName, `${campaignName} Ad`);
        const bundleBudgetMinor = budgetMinorOrUndefined(payload.dailyBudgetMinor ?? payload.budget, account.currency);
        const campaignResult = await provider.createCampaign({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          name: campaignName,
          objective: campaignObjective,
          buyingType: "AUCTION",
          specialAdCategories: [],
          operationId: operation.id,
          guard,
          ...(bundleBudgetMinor !== undefined ? { dailyBudgetMinor: bundleBudgetMinor } : {})
        });
        const campaign = await prisma.campaign.create({
          data: {
            organizationId: operation.organizationId,
            adAccountId: operation.adAccountId,
            metaId: campaignResult.metaId,
            name: campaignName,
            objective: campaignObjective,
            configuredStatus: "PAUSED",
            effectiveStatus: "PAUSED",
            dailyBudgetMinor: toBigInt(bundleBudgetMinor),
            specialAdCategories: [],
            rawJson: campaignResult,
            sourceLastSeenAt: new Date()
          }
        });
        const adSetResult = await provider.createAdSet({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          campaignMetaId: campaignResult.metaId,
          name: adSetName,
          optimizationGoal,
          billingEvent,
          targetingJson: JSON.stringify(payload.targetingJson ?? { audience: payload.audience ?? "all" }),
          promotedObjectJson: JSON.stringify(payload.promotedObjectJson ?? { custom_event_type: payload.event ?? "OTHER" }),
          operationId: operation.id,
          guard,
          ...(bundleBudgetMinor !== undefined ? { dailyBudgetMinor: bundleBudgetMinor } : {})
        });
        const adSet = await prisma.adSet.create({
          data: {
            organizationId: operation.organizationId,
            adAccountId: operation.adAccountId,
            campaignId: campaign.id,
            campaignMetaId: campaignResult.metaId,
            metaId: adSetResult.metaId,
            name: adSetName,
            configuredStatus: "PAUSED",
            effectiveStatus: "PAUSED",
            dailyBudgetMinor: toBigInt(bundleBudgetMinor),
            rawJson: adSetResult,
            sourceLastSeenAt: new Date()
          }
        });
        const creativeResult = await provider.createAdCreative({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          name: creativeName,
          objectStorySpecJson: JSON.stringify(payload.objectStorySpecJson ?? {
            page_id: payload.pageId,
            link_data: {
              name: creativeTitle,
              link: destinationUrl
            }
          }),
          operationId: operation.id,
          guard,
          ...(payload.assetFeedSpecJson !== undefined ? { assetFeedSpecJson: JSON.stringify(payload.assetFeedSpecJson) } : {})
        });
        const creative = await prisma.creative.create({
          data: {
            organizationId: operation.organizationId,
            adAccountId: operation.adAccountId,
            metaId: creativeResult.metaId,
            name: creativeName,
            title: creativeTitle,
            status: "PAUSED",
            rawJson: creativeResult,
            sourceLastSeenAt: new Date()
          }
        });
        const adResult = await provider.createAd({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          adSetMetaId: adSetResult.metaId,
          creativeMetaId: creativeResult.metaId,
          name: adName,
          operationId: operation.id,
          guard
        });
        await prisma.ad.create({
          data: {
            organizationId: operation.organizationId,
            adAccountId: operation.adAccountId,
            campaignId: campaign.id,
            adSetId: adSet.id,
            creativeId: creative.id,
            campaignMetaId: campaignResult.metaId,
            adSetMetaId: adSetResult.metaId,
            creativeMetaId: creativeResult.metaId,
            metaId: adResult.metaId,
            name: adName,
            configuredStatus: "PAUSED",
            effectiveStatus: "PAUSED",
            rawJson: adResult,
            sourceLastSeenAt: new Date()
          }
        });
        result = {
          operationId: operation.id,
          status: "PAUSED",
          metaId: adResult.metaId,
          campaignMetaId: campaignResult.metaId,
          adSetMetaId: adSetResult.metaId,
          creativeMetaId: creativeResult.metaId
        };
        break;
      }
      case "create-campaign": {
        const campaignDailyBudgetMinor = numberOrUndefined(payload.dailyBudgetMinor);
        const campaignName = stringFromUnknown(payload.name, "Untitled Campaign");
        const campaignObjective = stringFromUnknown(payload.objective, "OUTCOME_TRAFFIC");
        const buyingType = stringFromUnknown(payload.buyingType, "AUCTION");
        result = await provider.createCampaign({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          name: campaignName,
          objective: campaignObjective,
          buyingType,
          specialAdCategories: Array.isArray(payload.specialAdCategories) ? payload.specialAdCategories.map(String) : [],
          operationId: operation.id,
          guard,
          ...(campaignDailyBudgetMinor !== undefined ? { dailyBudgetMinor: campaignDailyBudgetMinor } : {})
        });
        await prisma.campaign.upsert({
          where: { organizationId_adAccountId_metaId: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: result.metaId } },
          create: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: result.metaId, name: campaignName, objective: campaignObjective, configuredStatus: "PAUSED", effectiveStatus: "PAUSED", dailyBudgetMinor: toBigInt(numberOrUndefined(payload.dailyBudgetMinor)), specialAdCategories: [], rawJson: toPrismaJson(result), sourceLastSeenAt: new Date() },
          update: { name: campaignName, objective: campaignObjective, configuredStatus: "PAUSED", effectiveStatus: "PAUSED", dailyBudgetMinor: toBigInt(numberOrUndefined(payload.dailyBudgetMinor)), rawJson: toPrismaJson(result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
        });
        break;
      }
      case "create-adset": {
        const adSetDailyBudgetMinor = numberOrUndefined(payload.dailyBudgetMinor);
        const campaignMetaId = stringFromUnknown(payload.campaignMetaId, "");
        const adSetName = stringFromUnknown(payload.name, "Untitled Ad Set");
        const optimizationGoal = stringFromUnknown(payload.optimizationGoal, "LINK_CLICKS");
        const billingEvent = stringFromUnknown(payload.billingEvent, "IMPRESSIONS");
        result = await provider.createAdSet({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          campaignMetaId,
          name: adSetName,
          optimizationGoal,
          billingEvent,
          targetingJson: JSON.stringify(payload.targetingJson ?? {}),
          promotedObjectJson: JSON.stringify(payload.promotedObjectJson ?? {}),
          operationId: operation.id,
          guard,
          ...(adSetDailyBudgetMinor !== undefined ? { dailyBudgetMinor: adSetDailyBudgetMinor } : {})
        });
        const campaign = await prisma.campaign.findFirst({ where: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: campaignMetaId } });
        await prisma.adSet.upsert({
          where: { organizationId_adAccountId_metaId: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: result.metaId } },
          create: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, campaignId: campaign?.id ?? null, metaId: result.metaId, campaignMetaId, name: adSetName, configuredStatus: "PAUSED", effectiveStatus: "PAUSED", dailyBudgetMinor: toBigInt(numberOrUndefined(payload.dailyBudgetMinor)), rawJson: toPrismaJson(result), sourceLastSeenAt: new Date() },
          update: { campaignId: campaign?.id ?? null, name: adSetName, configuredStatus: "PAUSED", effectiveStatus: "PAUSED", dailyBudgetMinor: toBigInt(numberOrUndefined(payload.dailyBudgetMinor)), rawJson: toPrismaJson(result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
        });
        break;
      }
      case "create-creative":
        result = await provider.createAdCreative({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          name: stringFromUnknown(payload.name, "Untitled Creative"),
          objectStorySpecJson: JSON.stringify(payload.objectStorySpecJson ?? {}),
          operationId: operation.id,
          guard,
          ...(payload.assetFeedSpecJson !== undefined ? { assetFeedSpecJson: JSON.stringify(payload.assetFeedSpecJson) } : {})
        });
        await prisma.creative.upsert({
          where: { organizationId_adAccountId_metaId: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: result.metaId } },
          create: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: result.metaId, name: stringFromUnknown(payload.name, "Untitled Creative"), status: "PAUSED", rawJson: toPrismaJson(result), sourceLastSeenAt: new Date() },
          update: { name: stringFromUnknown(payload.name, "Untitled Creative"), status: "PAUSED", rawJson: toPrismaJson(result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
        });
        break;
      case "create-ad": {
        const campaignMetaId = stringFromUnknown(payload.campaignMetaId, "");
        const adSetMetaId = stringFromUnknown(payload.adSetMetaId, "");
        const creativeMetaId = stringFromUnknown(payload.creativeMetaId, "");
        const adName = stringFromUnknown(payload.name, "Untitled Ad");
        result = await provider.createAd({ accessToken, requestId: operation.requestId }, {
          adAccountMetaId: account.metaId,
          adSetMetaId,
          creativeMetaId,
          name: adName,
          operationId: operation.id,
          guard
        });
        const [campaign, adSet, creative] = await Promise.all([
          prisma.campaign.findFirst({ where: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: campaignMetaId } }),
          prisma.adSet.findFirst({ where: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: adSetMetaId } }),
          prisma.creative.findFirst({ where: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: creativeMetaId } })
        ]);
        await prisma.ad.upsert({
          where: { organizationId_adAccountId_metaId: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, metaId: result.metaId } },
          create: { organizationId: operation.organizationId, adAccountId: operation.adAccountId, campaignId: campaign?.id ?? null, adSetId: adSet?.id ?? null, creativeId: creative?.id ?? null, metaId: result.metaId, campaignMetaId, adSetMetaId, creativeMetaId, name: adName, configuredStatus: "PAUSED", effectiveStatus: "PAUSED", rawJson: toPrismaJson(result), sourceLastSeenAt: new Date() },
          update: { campaignId: campaign?.id ?? null, adSetId: adSet?.id ?? null, creativeId: creative?.id ?? null, name: adName, configuredStatus: "PAUSED", effectiveStatus: "PAUSED", rawJson: toPrismaJson(result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
        });
        break;
      }
      case "pause":
      case "enable":
      case "update-budget": {
        const objectType = (payload.objectType as "campaign" | "adset" | "ad") ?? "campaign";
        const objectMetaId = stringFromUnknown(payload.objectMetaId, "");
        const updateDailyBudgetMinor = operation.type === "update-budget" ? numberOrUndefined(payload.dailyBudgetMinor) : undefined;
        const requestedStatus = payload.status === "ACTIVE" || payload.status === "PAUSED" ? payload.status : operation.type === "pause" ? "PAUSED" : operation.type === "enable" ? "ACTIVE" : undefined;
        const requestedName = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : undefined;
        result = await provider.updateObject({ accessToken, requestId: operation.requestId }, {
          objectMetaId,
          objectType,
          operationId: operation.id,
          guard,
          ...(requestedName !== undefined ? { name: requestedName } : {}),
          ...(requestedStatus !== undefined ? { status: requestedStatus } : {}),
          ...(updateDailyBudgetMinor !== undefined ? { dailyBudgetMinor: updateDailyBudgetMinor } : {})
        });
        await updateLocalMetaObject({
          organizationId: operation.organizationId,
          adAccountId: operation.adAccountId,
          objectType,
          objectMetaId,
          ...(requestedName !== undefined ? { name: requestedName } : {}),
          ...(requestedStatus !== undefined ? { status: requestedStatus } : {}),
          ...(updateDailyBudgetMinor !== undefined ? { dailyBudgetMinor: updateDailyBudgetMinor } : {})
        });
        break;
      }
      case "duplicate": {
        const objectType = (payload.objectType as "campaign" | "adset" | "ad") ?? "campaign";
        const objectMetaId = stringFromUnknown(payload.objectMetaId, "");
        result = await provider.duplicateObject({ accessToken, requestId: operation.requestId }, {
          objectMetaId,
          objectType,
          operationId: operation.id,
          guard
        });
        await duplicateLocalMetaObject({
          organizationId: operation.organizationId,
          adAccountId: operation.adAccountId,
          objectType,
          sourceMetaId: objectMetaId,
          newMetaId: result.metaId,
          result
        });
        break;
      }
      default:
        throw new Error(`Unsupported mutation type: ${operation.type}`);
    }
    const storedResult = withMetaRequestDetails(result, operation.id, operation.requestId, account.metaId);
    await prisma.operation.update({ where: { id: operation.id }, data: { status: "SUCCEEDED", resultJson: toPrismaJson(storedResult), metaObjectIdsJson: toPrismaJson({ metaId: result.metaId, operationId: operation.id }), completedAt: new Date() } });
    await writeMetaApiLog({ organizationId: operation.organizationId, operation: `meta.write.${operation.type}`, requestId: operation.requestId, startedAt, outcome: "SUCCESS" });
    await writeAudit({ organizationId: operation.organizationId, actorUserId: operation.actorUserId ?? undefined, action: `meta.write.${operation.type}`, resourceType: "Operation", resourceId: operation.id, outcome: "SUCCESS", requestId: operation.requestId, afterJson: storedResult });
    return { operationId: operation.id, metaId: result.metaId };
  } catch (error) {
    const details = errorJson(error);
    const unknownOutcome = isNonIdempotentMutation(operation.type) && details.retryable;
    context.logger.error("mutation processor failed", { error: safeErrorMessage(error) });
    await prisma.operation.update({ where: { id: operation.id }, data: { status: unknownOutcome ? "UNKNOWN_OUTCOME" : "FAILED", errorJson: toPrismaJson({ ...details, operationId: operation.id }), completedAt: new Date() } });
    await writeMetaApiLog({ organizationId: operation.organizationId, operation: `meta.write.${operation.type}`, requestId: operation.requestId, startedAt, outcome: unknownOutcome ? "UNKNOWN" : "FAILED", error });
    await writeAudit({ organizationId: operation.organizationId, actorUserId: operation.actorUserId ?? undefined, action: `meta.write.${operation.type}`, resourceType: "Operation", resourceId: operation.id, outcome: unknownOutcome ? "UNKNOWN" : "FAILED", requestId: operation.requestId, summaryJson: { ...details, operationId: operation.id } });
    if (unknownOutcome) {
      throw new UnrecoverableError(`Meta mutation ${operation.id} may have reached Meta; marked UNKNOWN_OUTCOME and stopped retries.`);
    }
    throw error;
  }
}

async function updateLocalMetaObject(input: { organizationId: string; adAccountId: string; objectType: "campaign" | "adset" | "ad"; objectMetaId: string; name?: string; status?: "ACTIVE" | "PAUSED"; dailyBudgetMinor?: number }) {
  if (input.objectType === "campaign") {
    const data: { name?: string; configuredStatus?: string; effectiveStatus?: string; dailyBudgetMinor?: bigint | null; sourceLastSeenAt: Date } = { sourceLastSeenAt: new Date() };
    if (input.name !== undefined) data.name = input.name;
    if (input.status !== undefined) {
      data.configuredStatus = input.status;
      data.effectiveStatus = input.status;
    }
    if (input.dailyBudgetMinor !== undefined) data.dailyBudgetMinor = toBigInt(input.dailyBudgetMinor);
    await prisma.campaign.updateMany({ where: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.objectMetaId }, data });
    return;
  }
  if (input.objectType === "adset") {
    const data: { name?: string; configuredStatus?: string; effectiveStatus?: string; dailyBudgetMinor?: bigint | null; sourceLastSeenAt: Date } = { sourceLastSeenAt: new Date() };
    if (input.name !== undefined) data.name = input.name;
    if (input.status !== undefined) {
      data.configuredStatus = input.status;
      data.effectiveStatus = input.status;
    }
    if (input.dailyBudgetMinor !== undefined) data.dailyBudgetMinor = toBigInt(input.dailyBudgetMinor);
    await prisma.adSet.updateMany({ where: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.objectMetaId }, data });
    return;
  }
  const data: { name?: string; configuredStatus?: string; effectiveStatus?: string; sourceLastSeenAt: Date } = { sourceLastSeenAt: new Date() };
  if (input.name !== undefined) data.name = input.name;
  if (input.status !== undefined) {
    data.configuredStatus = input.status;
    data.effectiveStatus = input.status;
  }
  await prisma.ad.updateMany({ where: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.objectMetaId }, data });
}

async function duplicateLocalMetaObject(input: { organizationId: string; adAccountId: string; objectType: "campaign" | "adset" | "ad"; sourceMetaId: string; newMetaId: string; result: OperationResult }): Promise<void> {
  if (input.objectType === "campaign") {
    const source = await prisma.campaign.findFirst({ where: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.sourceMetaId } });
    await prisma.campaign.upsert({
      where: { organizationId_adAccountId_metaId: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.newMetaId } },
      create: {
        organizationId: input.organizationId,
        adAccountId: input.adAccountId,
        metaId: input.newMetaId,
        name: source?.name === undefined ? "Duplicated Campaign" : `${source.name} Copy`,
        objective: source?.objective ?? null,
        configuredStatus: "PAUSED",
        effectiveStatus: "PAUSED",
        dailyBudgetMinor: source?.dailyBudgetMinor ?? null,
        specialAdCategories: source?.specialAdCategories ?? [],
        rawJson: toPrismaJson(input.result),
        sourceLastSeenAt: new Date()
      },
      update: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED", rawJson: toPrismaJson(input.result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
    });
    return;
  }
  if (input.objectType === "adset") {
    const source = await prisma.adSet.findFirst({ where: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.sourceMetaId } });
    await prisma.adSet.upsert({
      where: { organizationId_adAccountId_metaId: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.newMetaId } },
      create: {
        organizationId: input.organizationId,
        adAccountId: input.adAccountId,
        campaignId: source?.campaignId ?? null,
        campaignMetaId: source?.campaignMetaId ?? "",
        metaId: input.newMetaId,
        name: source?.name === undefined ? "Duplicated Ad Set" : `${source.name} Copy`,
        configuredStatus: "PAUSED",
        effectiveStatus: "PAUSED",
        dailyBudgetMinor: source?.dailyBudgetMinor ?? null,
        lifetimeBudgetMinor: source?.lifetimeBudgetMinor ?? null,
        optimizationGoal: source?.optimizationGoal ?? null,
        billingEvent: source?.billingEvent ?? null,
        targetingJson: source?.targetingJson ?? toNullablePrismaJson(null),
        promotedObjectJson: source?.promotedObjectJson ?? toNullablePrismaJson(null),
        rawJson: toPrismaJson(input.result),
        sourceLastSeenAt: new Date()
      },
      update: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED", rawJson: toPrismaJson(input.result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
    });
    return;
  }
  const source = await prisma.ad.findFirst({ where: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.sourceMetaId } });
  await prisma.ad.upsert({
    where: { organizationId_adAccountId_metaId: { organizationId: input.organizationId, adAccountId: input.adAccountId, metaId: input.newMetaId } },
    create: {
      organizationId: input.organizationId,
      adAccountId: input.adAccountId,
      campaignId: source?.campaignId ?? null,
      adSetId: source?.adSetId ?? null,
      creativeId: source?.creativeId ?? null,
      campaignMetaId: source?.campaignMetaId ?? "",
      adSetMetaId: source?.adSetMetaId ?? "",
      creativeMetaId: source?.creativeMetaId ?? null,
      metaId: input.newMetaId,
      name: source?.name === undefined ? "Duplicated Ad" : `${source.name} Copy`,
      configuredStatus: "PAUSED",
      effectiveStatus: "PAUSED",
      rawJson: toPrismaJson(input.result),
      sourceLastSeenAt: new Date()
    },
    update: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED", rawJson: toPrismaJson(input.result), sourceLastSeenAt: new Date(), isDeletedAtSource: false }
  });
}

function withMetaRequestDetails(result: OperationResult, operationId: string, requestId: string, adAccountMetaId: string): OperationResult {
  return {
    ...result,
    operationId,
    metaRequest: {
      operationId,
      requestId,
      adAccountMetaId
    }
  };
}

function isNonIdempotentMutation(type: string): boolean {
  return type === "create-bundle" || type === "create-campaign" || type === "create-adset" || type === "create-creative" || type === "create-ad" || type === "duplicate";
}

function readMetaId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.metaId === "string" ? record.metaId : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringFromUnknown(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function budgetMinorOrUndefined(value: unknown, currency: string): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return currency === "USD" ? Math.round(parsed * 100) : Math.round(parsed);
}
