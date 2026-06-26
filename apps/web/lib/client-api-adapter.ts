"use client";

import {
  demoProvider,
  type AdAccount,
  type CampaignEntity,
  type CreativeAsset,
  type CreatedAdBundle,
  type CreateAdDraftInput,
  type DemoQueryContext,
  type EntityLevel,
  type KpiMetric,
  type ReportRow,
  type SyncJob,
  type UpdateEntityInput
} from "@adflow/meta-client";

export type ClientDataMode = "demo" | "live";
export type ConnectionState = "demo" | "live-ready" | "unconfigured" | "readonly" | "write-disabled";

export type MissingMetaRequirement = {
  id: string;
  label: string;
  detail: string;
};

export type ClientApiConnection = {
  mode: ClientDataMode;
  state: ConnectionState;
  sourceLabel: string;
  canRead: boolean;
  canWrite: boolean;
  missingItems: MissingMetaRequirement[];
  stateLabel: string;
  stateDetail: string;
  writeBlockedReason: string;
};

export type CreativeTypeFilter = "全部" | CreativeAsset["type"];

export type ClientApiAdapter = {
  mode: ClientDataMode;
  sourceLabel: string;
  listAdAccounts: () => AdAccount[];
  getKpis: (context?: DemoQueryContext) => KpiMetric[];
  listEntities: (level: EntityLevel, accountId: string, query?: string, context?: DemoQueryContext) => CampaignEntity[];
  updateStatus: (level: EntityLevel, accountId: string, ids: string[], status: "active" | "paused") => CampaignEntity[];
  updateBudget: (level: EntityLevel, accountId: string, ids: string[], dailyBudget: number) => CampaignEntity[];
  updateEntity: (level: EntityLevel, accountId: string, id: string, input: UpdateEntityInput) => CampaignEntity | null;
  createAdBundle: (accountId: string, input: CreateAdDraftInput) => CreatedAdBundle;
  duplicateEntities: (level: EntityLevel, accountId: string, ids: string[]) => CampaignEntity[];
  markEntities: (level: EntityLevel, accountId: string, ids: string[], warning: boolean) => CampaignEntity[];
  touchEntities: (level: EntityLevel, accountId: string, ids: string[]) => CampaignEntity[];
  listCreatives: (accountId: string, query?: string, type?: CreativeTypeFilter) => CreativeAsset[];
  createCreative: (accountId: string) => CreativeAsset | null;
  duplicateCreative: (accountId: string, id: string) => CreativeAsset | null;
  archiveCreative: (accountId: string, id: string) => CreativeAsset[];
  listReportRows: () => ReportRow[];
  exportReportCsv: () => string;
  listSyncJobs: (accountId: string) => SyncJob[];
  enqueueSyncJob: (accountId: string) => SyncJob;
  updateSyncJob: (accountId: string, id: string, patch: Partial<Pick<SyncJob, "status" | "progress" | "elapsed">>) => SyncJob[];
};

const clientEnv = {
  dataMode: process.env.NEXT_PUBLIC_ADFLOW_DATA_MODE,
  metaConfigured: process.env.NEXT_PUBLIC_META_CONFIGURED,
  metaAppId: process.env.NEXT_PUBLIC_META_APP_ID,
  metaBusinessId: process.env.NEXT_PUBLIC_META_BUSINESS_ID,
  metaAdAccountId: process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID,
  metaAdAccountName: process.env.NEXT_PUBLIC_META_AD_ACCOUNT_NAME,
  metaCurrency: process.env.NEXT_PUBLIC_META_CURRENCY,
  metaTimezone: process.env.NEXT_PUBLIC_META_TIMEZONE,
  metaReadonly: process.env.NEXT_PUBLIC_META_READONLY,
  metaWritesEnabled: process.env.NEXT_PUBLIC_ENABLE_META_WRITES,
  metaClientWritesReady: process.env.NEXT_PUBLIC_META_CLIENT_WRITES_READY
};

const liveBlockedBundle: CreatedAdBundle = {
  campaignId: "",
  adSetId: "",
  creativeId: "",
  adId: ""
};

export const demoAdapter: ClientApiAdapter = {
  mode: "demo",
  sourceLabel: "Demo Provider",
  listAdAccounts: () => demoProvider.listAdAccounts(),
  getKpis: (context) => demoProvider.getKpis(context),
  listEntities: (level, accountId, query = "", context) => demoProvider.listEntities(level, accountId, query, context),
  updateStatus: (level, accountId, ids, status) => demoProvider.updateStatus(level, accountId, ids, status),
  updateBudget: (level, accountId, ids, dailyBudget) => demoProvider.updateBudget(level, accountId, ids, dailyBudget),
  updateEntity: (level, accountId, id, input) => demoProvider.updateEntity(level, accountId, id, input),
  createAdBundle: (accountId, input) => demoProvider.createAdBundle(accountId, input),
  duplicateEntities: (level, accountId, ids) => demoProvider.duplicateEntities(level, accountId, ids),
  markEntities: (level, accountId, ids, warning) => demoProvider.markEntities(level, accountId, ids, warning),
  touchEntities: (level, accountId, ids) => demoProvider.touchEntities(level, accountId, ids),
  listCreatives: (accountId, query = "", type = "全部") => demoProvider.listCreatives(accountId, query, type),
  createCreative: (accountId) => demoProvider.createCreative(accountId),
  duplicateCreative: (accountId, id) => demoProvider.duplicateCreative(accountId, id),
  archiveCreative: (accountId, id) => demoProvider.archiveCreative(accountId, id),
  listReportRows: () => demoProvider.listReportRows(),
  exportReportCsv: () => demoProvider.exportReportCsv(),
  listSyncJobs: (accountId) => demoProvider.listSyncJobs(accountId),
  enqueueSyncJob: (accountId) => demoProvider.enqueueSyncJob(accountId),
  updateSyncJob: (accountId, id, patch) => demoProvider.updateSyncJob(accountId, id, patch)
};

export const liveAdapter: ClientApiAdapter = {
  mode: "live",
  sourceLabel: "Live Meta API",
  listAdAccounts: () => liveAccountList(),
  getKpis: () => [],
  listEntities: () => [],
  updateStatus: () => [],
  updateBudget: () => [],
  updateEntity: () => null,
  createAdBundle: () => liveBlockedBundle,
  duplicateEntities: () => [],
  markEntities: () => [],
  touchEntities: () => [],
  listCreatives: () => [],
  createCreative: () => null,
  duplicateCreative: () => null,
  archiveCreative: () => [],
  listReportRows: () => [],
  exportReportCsv: () => "",
  listSyncJobs: () => [],
  enqueueSyncJob: (accountId) => ({
    accountId,
    id: "live-sync-not-configured",
    type: "Live sync",
    scope: "Meta Graph API",
    status: "queued",
    progress: "0%",
    startedAt: "-",
    elapsed: "-",
    requestId: "live-adapter-skeleton"
  }),
  updateSyncJob: () => []
};

export function resolveInitialDataMode(): ClientDataMode {
  return clientEnv.dataMode === "live" ? "live" : "demo";
}

export function getClientApiAdapter(mode: ClientDataMode): ClientApiAdapter {
  return mode === "live" ? liveAdapter : demoAdapter;
}

export function getClientApiConnection(mode: ClientDataMode): ClientApiConnection {
  if (mode === "demo") {
    return {
      mode,
      state: "demo",
      sourceLabel: demoAdapter.sourceLabel,
      canRead: true,
      canWrite: true,
      missingItems: [],
      stateLabel: "Demo mode",
      stateDetail: "Using deterministic local demo data. No Meta objects are read or changed.",
      writeBlockedReason: ""
    };
  }

  const missingItems = getMissingMetaRequirements();
  if (missingItems.length > 0) {
    return {
      mode,
      state: "unconfigured",
      sourceLabel: liveAdapter.sourceLabel,
      canRead: false,
      canWrite: false,
      missingItems,
      stateLabel: "Live mode unconfigured",
      stateDetail: "Meta credentials are incomplete, so live pages are blocked instead of falling back to demo data.",
      writeBlockedReason: "Live mode is missing required Meta configuration."
    };
  }

  if (isEnabled(clientEnv.metaReadonly)) {
    return {
      mode,
      state: "readonly",
      sourceLabel: liveAdapter.sourceLabel,
      canRead: true,
      canWrite: false,
      missingItems,
      stateLabel: "Live mode readonly",
      stateDetail: "Live reads are allowed, but this session cannot change Meta objects.",
      writeBlockedReason: "The current Live connection is readonly."
    };
  }

  if (!isEnabled(clientEnv.metaWritesEnabled) || !isEnabled(clientEnv.metaClientWritesReady)) {
    return {
      mode,
      state: "write-disabled",
      sourceLabel: liveAdapter.sourceLabel,
      canRead: true,
      canWrite: false,
      missingItems,
      stateLabel: "Live writes disabled",
      stateDetail: "Live reads may be connected later, but write operations are disabled by configuration.",
      writeBlockedReason: "ENABLE_META_WRITES and NEXT_PUBLIC_META_CLIENT_WRITES_READY must both be enabled."
    };
  }

  return {
    mode,
    state: "live-ready",
    sourceLabel: liveAdapter.sourceLabel,
    canRead: true,
    canWrite: true,
    missingItems,
    stateLabel: "Live mode ready",
    stateDetail: "Live adapter is selected. Demo fixtures are not used.",
    writeBlockedReason: ""
  };
}

export function getMissingMetaRequirements(): MissingMetaRequirement[] {
  const missing: MissingMetaRequirement[] = [];
  if (!hasValue(clientEnv.metaAppId)) {
    missing.push({
      id: "meta-app-id",
      label: "NEXT_PUBLIC_META_APP_ID",
      detail: "Public Meta app id is required before Live mode can identify the app."
    });
  }
  if (!hasValue(clientEnv.metaBusinessId)) {
    missing.push({
      id: "meta-business-id",
      label: "NEXT_PUBLIC_META_BUSINESS_ID",
      detail: "Business id is required to scope Live onboarding and account selection."
    });
  }
  if (!hasValue(clientEnv.metaAdAccountId)) {
    missing.push({
      id: "meta-ad-account-id",
      label: "NEXT_PUBLIC_META_AD_ACCOUNT_ID",
      detail: "A target ad account id is required before Live pages can query data."
    });
  }
  if (!isEnabled(clientEnv.metaConfigured)) {
    missing.push({
      id: "server-meta-credentials",
      label: "META_ACCESS_TOKEN / META_APP_SECRET",
      detail: "Server-side Meta credentials must be confirmed through NEXT_PUBLIC_META_CONFIGURED=true."
    });
  }
  return missing;
}

export function writeBlockedMessage(connection: ClientApiConnection): string {
  return connection.writeBlockedReason || "Writes are disabled for the selected data source.";
}

function liveAccountList(): AdAccount[] {
  if (!hasValue(clientEnv.metaAdAccountId)) return [];
  return [
    {
      id: clientEnv.metaAdAccountId,
      name: clientEnv.metaAdAccountName || "Live Meta Account",
      maskedId: maskAccountId(clientEnv.metaAdAccountId),
      currency: clientEnv.metaCurrency === "KRW" ? "KRW" : "USD",
      timezone: clientEnv.metaTimezone || "UTC",
      status: "healthy"
    }
  ];
}

function maskAccountId(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function hasValue(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes";
}
