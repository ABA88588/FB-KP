export const QUEUE_NAMES = {
  sync: "meta-sync",
  reports: "meta-reports",
  mutations: "meta-mutations",
  exports: "exports",
  maintenance: "maintenance"
} as const;

export type QueueKey = keyof typeof QUEUE_NAMES;
export type QueueName = (typeof QUEUE_NAMES)[QueueKey];

export const QUEUE_NAME_LIST = [
  QUEUE_NAMES.sync,
  QUEUE_NAMES.reports,
  QUEUE_NAMES.mutations,
  QUEUE_NAMES.exports,
  QUEUE_NAMES.maintenance
] as const satisfies readonly QueueName[];

export const SYNC_JOB_NAMES = ["sync-account-assets", "sync-entities", "sync-insights"] as const;
export const REPORT_JOB_NAMES = ["start-report", "poll-report", "ingest-report"] as const;
export const MUTATION_JOB_NAMES = ["apply-single", "apply-batch", "reconcile-timeout"] as const;
export const EXPORT_JOB_NAMES = ["build-csv", "expire-export"] as const;
export const MAINTENANCE_JOB_NAMES = ["validate-tokens", "cleanup-jobs", "refresh-materialized-metrics"] as const;

export type SyncJobName = (typeof SYNC_JOB_NAMES)[number];
export type ReportJobName = (typeof REPORT_JOB_NAMES)[number];
export type MutationJobName = (typeof MUTATION_JOB_NAMES)[number];
export type ExportJobName = (typeof EXPORT_JOB_NAMES)[number];
export type MaintenanceJobName = (typeof MAINTENANCE_JOB_NAMES)[number];
export type WorkerJobName = SyncJobName | ReportJobName | MutationJobName | ExportJobName | MaintenanceJobName;
