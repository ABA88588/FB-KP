import { z } from "zod";

import { JobValidationError } from "../errors.js";
import {
  QUEUE_NAMES,
  type ExportJobName,
  type MaintenanceJobName,
  type MutationJobName,
  type QueueName,
  type ReportJobName,
  type SyncJobName,
  type WorkerJobName
} from "./names.js";

const ISO_STRING = z.string().min(1);
const NON_EMPTY_ID = z.string().min(1);

export const BaseJobSchema = z
  .object({
    jobVersion: z.literal(1),
    organizationId: NON_EMPTY_ID,
    actorUserId: NON_EMPTY_ID.optional(),
    connectionId: NON_EMPTY_ID,
    adAccountId: NON_EMPTY_ID,
    requestId: NON_EMPTY_ID,
    idempotencyKey: NON_EMPTY_ID
  })
  .strict();

const DateRangeSchema = z
  .object({
    since: ISO_STRING,
    until: ISO_STRING
  })
  .strict();

const EntityLevelSchema = z.enum(["ACCOUNT", "CAMPAIGN", "ADSET", "AD"]);
const EntityTypeSchema = z.enum(["campaign", "adset", "ad", "creative"]);

const withPayload = <PayloadSchema extends z.ZodType>(payload: PayloadSchema) => BaseJobSchema.extend({ payload }).strict();

export const SyncJobSchemas = {
  "sync-account-assets": withPayload(
    z
      .object({
        forceFullSync: z.boolean().optional().default(false),
        cursor: z.string().min(1).optional(),
        since: ISO_STRING.optional()
      })
      .strict()
  ),
  "sync-entities": withPayload(
    z
      .object({
        entityTypes: z.array(EntityTypeSchema).min(1),
        cursor: z.string().min(1).optional(),
        updatedSince: ISO_STRING.optional()
      })
      .strict()
  ),
  "sync-insights": withPayload(
    z
      .object({
        level: EntityLevelSchema,
        dateRange: DateRangeSchema,
        breakdowns: z.array(z.string().min(1)).optional().default([]),
        attributionWindows: z.array(z.string().min(1)).optional().default([]),
        cursor: z.string().min(1).optional()
      })
      .strict()
  )
} as const satisfies Record<SyncJobName, z.ZodType>;

export const ReportJobSchemas = {
  "start-report": withPayload(
    z
      .object({
        reportId: NON_EMPTY_ID,
        query: z.record(z.string(), z.unknown()),
        deadlineAt: ISO_STRING.optional()
      })
      .strict()
  ),
  "poll-report": withPayload(
    z
      .object({
        reportId: NON_EMPTY_ID,
        metaReportRunId: NON_EMPTY_ID,
        pollAfter: ISO_STRING.optional(),
        pollAttempt: z.number().int().min(0).optional().default(0)
      })
      .strict()
  ),
  "ingest-report": withPayload(
    z
      .object({
        reportId: NON_EMPTY_ID,
        metaReportRunId: NON_EMPTY_ID,
        cursor: z.string().min(1).optional()
      })
      .strict()
  )
} as const satisfies Record<ReportJobName, z.ZodType>;

export const MutationJobSchemas = {
  "apply-single": withPayload(
    z
      .object({
        mutationRequestId: NON_EMPTY_ID,
        mutationType: NON_EMPTY_ID,
        payload: z.record(z.string(), z.unknown()),
        requiresRecentConfirmation: z.boolean().optional().default(true)
      })
      .strict()
  ),
  "apply-batch": withPayload(
    z
      .object({
        batchRequestId: NON_EMPTY_ID,
        mutationRequestIds: z.array(NON_EMPTY_ID).min(1),
        allowPartial: z.boolean().optional().default(false)
      })
      .strict()
  ),
  "reconcile-timeout": withPayload(
    z
      .object({
        mutationRequestId: NON_EMPTY_ID,
        expectedMetaObjectId: z.string().min(1).optional(),
        lastKnownOperationId: z.string().min(1).optional()
      })
      .strict()
  )
} as const satisfies Record<MutationJobName, z.ZodType>;

export const ExportJobSchemas = {
  "build-csv": withPayload(
    z
      .object({
        exportId: NON_EMPTY_ID,
        reportId: NON_EMPTY_ID,
        expiresAt: ISO_STRING.optional()
      })
      .strict()
  ),
  "expire-export": withPayload(
    z
      .object({
        exportId: NON_EMPTY_ID.optional(),
        before: ISO_STRING.optional()
      })
      .strict()
  )
} as const satisfies Record<ExportJobName, z.ZodType>;

export const MaintenanceJobSchemas = {
  "validate-tokens": withPayload(
    z
      .object({
        connectionIds: z.array(NON_EMPTY_ID).optional()
      })
      .strict()
  ),
  "cleanup-jobs": withPayload(
    z
      .object({
        before: ISO_STRING,
        statuses: z.array(z.enum(["SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN_OUTCOME"])).optional()
      })
      .strict()
  ),
  "refresh-materialized-metrics": withPayload(
    z
      .object({
        adAccountIds: z.array(NON_EMPTY_ID).optional(),
        dateRange: DateRangeSchema
      })
      .strict()
  )
} as const satisfies Record<MaintenanceJobName, z.ZodType>;

export type BaseWorkerJobData = z.infer<typeof BaseJobSchema> & {
  readonly payload: unknown;
};

export function parseWorkerJobData(queueName: QueueName, jobName: string, data: unknown): BaseWorkerJobData {
  const schema = getJobSchema(queueName, jobName);

  if (schema === null) {
    throw new JobValidationError(`Unknown job ${jobName} for queue ${queueName}.`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new JobValidationError(`Invalid ${queueName}/${jobName} payload: ${z.prettifyError(result.error)}`);
  }

  return result.data as BaseWorkerJobData;
}

export function getJobSchema(queueName: QueueName, jobName: string): z.ZodType | null {
  switch (queueName) {
    case QUEUE_NAMES.sync:
      return SyncJobSchemas[jobName as SyncJobName] ?? null;
    case QUEUE_NAMES.reports:
      return ReportJobSchemas[jobName as ReportJobName] ?? null;
    case QUEUE_NAMES.mutations:
      return MutationJobSchemas[jobName as MutationJobName] ?? null;
    case QUEUE_NAMES.exports:
      return ExportJobSchemas[jobName as ExportJobName] ?? null;
    case QUEUE_NAMES.maintenance:
      return MaintenanceJobSchemas[jobName as MaintenanceJobName] ?? null;
  }
}

export function isKnownWorkerJobName(queueName: QueueName, jobName: string): jobName is WorkerJobName {
  return getJobSchema(queueName, jobName) !== null;
}
