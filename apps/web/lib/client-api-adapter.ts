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

export type LiveSnapshot = {
  accounts: AdAccount[];
  entities: CampaignEntity[];
  creatives: CreativeAsset[];
  reportRows: ReportRow[];
  syncJobs: SyncJob[];
};

const clientEnv = {
  dataMode: process.env.NEXT_PUBLIC_ADFLOW_DATA_MODE,
  metaConfigured: process.env.NEXT_PUBLIC_META_CONFIGURED,
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

export function createLiveAdapter(snapshot: LiveSnapshot | null): ClientApiAdapter {
  const data: LiveSnapshot = snapshot ?? { accounts: [], entities: [], creatives: [], reportRows: [], syncJobs: [] };
  return {
  mode: "live",
  sourceLabel: "Live Meta API",
  listAdAccounts: () => data.accounts,
  getKpis: () => liveKpis(data.reportRows),
  listEntities: (level, accountId, query = "") => data.entities.filter((entity) => entity.level === level && entity.accountId === accountId && entity.name.toLowerCase().includes(query.toLowerCase())),
  updateStatus: (level, accountId, ids, status) => {
    for (const id of ids) {
      queueOperation(accountId, status === "active" ? "enable" : "pause", { objectMetaId: id, objectType: level });
    }
    return data.entities.map((entity) => (entity.level === level && entity.accountId === accountId && ids.includes(entity.id) ? { ...entity, status } : entity));
  },
  updateBudget: (level, accountId, ids, dailyBudget) => {
    for (const id of ids) {
      queueOperation(accountId, "update-budget", { objectMetaId: id, objectType: level, dailyBudgetMinor: dailyBudget });
    }
    return data.entities.map((entity) => (entity.level === level && entity.accountId === accountId && ids.includes(entity.id) ? { ...entity, budget: String(dailyBudget) } : entity));
  },
  updateEntity: (level, accountId, id, input) => {
    queueOperation(accountId, "update-budget", { objectMetaId: id, objectType: level, name: input.name, status: input.status === "active" ? "ACTIVE" : "PAUSED", dailyBudgetMinor: parseBudgetMinor(input.budget) });
    return data.entities.find((entity) => entity.level === level && entity.accountId === accountId && entity.id === id) ?? null;
  },
  createAdBundle: (accountId, input) => {
    queueOperation(accountId, "create-bundle", input);
    return liveBlockedBundle;
  },
  duplicateEntities: (level, accountId, ids) => {
    for (const id of ids) {
      queueOperation(accountId, "duplicate", { objectMetaId: id, objectType: level });
    }
    return data.entities.filter((entity) => entity.level === level && entity.accountId === accountId && ids.includes(entity.id));
  },
  markEntities: () => [],
  touchEntities: () => [],
  listCreatives: (accountId, query = "", type = "全部") => data.creatives.filter((creative) => creative.accountId === accountId && creative.title.toLowerCase().includes(query.toLowerCase()) && (type === "全部" || creative.type === type)),
  createCreative: (accountId) => {
    queueOperation(accountId, "create-creative", {
      name: `Live Creative ${new Date().toISOString().slice(0, 10)}`,
      objectStorySpecJson: {}
    });
    return null;
  },
  duplicateCreative: (accountId, id) => {
    queueOperation(accountId, "duplicate", { objectMetaId: id, objectType: "creative" });
    return null;
  },
  archiveCreative: () => [],
  listReportRows: () => data.reportRows,
  exportReportCsv: () => reportRowsToCsv(data.reportRows),
  listSyncJobs: (accountId) => data.syncJobs.filter((job) => job.accountId === accountId),
  enqueueSyncJob: (accountId) => {
    queueSync(accountId, "sync-entities");
    return {
      accountId,
      id: `live-sync-${Date.now()}`,
      type: "sync-entities",
      scope: "meta-sync",
      status: "queued",
      progress: "0%",
      startedAt: new Date().toISOString(),
      elapsed: "-",
      requestId: "pending"
    };
  },
  updateSyncJob: () => []
};
}

export function resolveInitialDataMode(): ClientDataMode {
  return clientEnv.dataMode === "live" ? "live" : "demo";
}

export function getClientApiAdapter(mode: ClientDataMode, liveSnapshot: LiveSnapshot | null = null): ClientApiAdapter {
  return mode === "live" ? createLiveAdapter(liveSnapshot) : demoAdapter;
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
      sourceLabel: "Live Meta API",
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
      sourceLabel: "Live Meta API",
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
      sourceLabel: "Live Meta API",
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
    sourceLabel: "Live Meta API",
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
  if (!isEnabled(clientEnv.metaConfigured)) {
    missing.push({
      id: "server-meta-credentials",
      label: "META_APP_ID / META_APP_SECRET",
      detail: "Server-side Meta OAuth credentials must be confirmed through NEXT_PUBLIC_META_CONFIGURED=true."
    });
  }
  return missing;
}

export function writeBlockedMessage(connection: ClientApiConnection): string {
  return connection.writeBlockedReason || "Writes are disabled for the selected data source.";
}

function reportRowsToCsv(rows: ReportRow[]): string {
  return [
    "date,platform,spend,impressions,clicks,purchases,roas",
    ...rows.map((row) => [row.date, row.platform, row.spend, row.impressions, row.clicks, row.purchases, row.roas].map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(","))
  ].join("\n");
}

function liveKpis(rows: ReportRow[]): KpiMetric[] {
  const spend = rows.reduce((sum, row) => sum + parseMetric(row.spend), 0);
  const impressions = rows.reduce((sum, row) => sum + parseMetric(row.impressions), 0);
  const clicks = rows.reduce((sum, row) => sum + parseMetric(row.clicks), 0);
  const purchases = rows.reduce((sum, row) => sum + parseMetric(row.purchases), 0);
  const roas = rows.length > 0 ? rows.reduce((sum, row) => sum + parseMetric(row.roas), 0) / rows.length : 0;
  return [
    { label: "Spend", value: String(Math.round(spend)), delta: "Live DB", direction: "up", note: "Synced from database", accent: true },
    { label: "Impressions", value: String(Math.round(impressions)), delta: "Live DB", direction: "up", note: "Synced from database" },
    { label: "Clicks", value: String(Math.round(clicks)), delta: "Live DB", direction: "up", note: "Synced from database" },
    { label: "Purchases", value: String(Math.round(purchases)), delta: roas.toFixed(2), direction: "up", note: "Average ROAS" }
  ];
}

function queueOperation(adAccountId: string, type: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  void fetch("/api/operations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adAccountId, type, payload, confirmed: true })
  }).catch(() => undefined);
}

function queueSync(accountId: string, type: string): void {
  if (typeof window === "undefined") return;
  void fetch(`/api/ad-accounts/${encodeURIComponent(accountId)}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type })
  }).catch(() => undefined);
}

function parseMetric(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBudgetMinor(value: string): number | undefined {
  const parsed = parseMetric(value);
  return parsed > 0 ? Math.round(parsed) : undefined;
}

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes";
}
