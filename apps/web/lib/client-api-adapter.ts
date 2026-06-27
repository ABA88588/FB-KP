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
import { apiPath } from "@/lib/app-paths";

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
  sourceLabel: "演示数据源",
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
  sourceLabel: "Live Meta",
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
  return clientEnv.dataMode === "demo" ? "demo" : "live";
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
      stateLabel: "演示沙箱",
      stateDetail: "所有数据均为模拟，不会连接 Meta，也不会写入真实广告对象。",
      writeBlockedReason: ""
    };
  }

  const missingItems = getMissingMetaRequirements();
  if (missingItems.length > 0) {
    return {
      mode,
      state: "unconfigured",
      sourceLabel: "Live Meta",
      canRead: false,
      canWrite: false,
      missingItems,
      stateLabel: "未连接 Meta",
      stateDetail: "尚未连接 Meta，请先配置 Meta App 并完成授权。",
      writeBlockedReason: "尚未完成 Meta App 配置和账号授权，不能写入真实 Meta 对象。"
    };
  }

  if (isEnabled(clientEnv.metaReadonly)) {
    return {
      mode,
      state: "readonly",
      sourceLabel: "Live Meta",
      canRead: true,
      canWrite: false,
      missingItems,
      stateLabel: "实时只读",
      stateDetail: "当前账号允许读取真实 Meta 数据，但写入控制仍处于只读状态。",
      writeBlockedReason: "当前 Live 连接为只读状态。"
    };
  }

  if (!isEnabled(clientEnv.metaWritesEnabled) || !isEnabled(clientEnv.metaClientWritesReady)) {
    return {
      mode,
      state: "write-disabled",
      sourceLabel: "Live Meta",
      canRead: true,
      canWrite: false,
      missingItems,
      stateLabel: "写入关闭",
      stateDetail: "实时读取可用，但真实 Meta 写入未开启或尚未完成客户端写入验收。",
      writeBlockedReason: "需要同时开启 ENABLE_META_WRITES 并完成客户端写入验收。"
    };
  }

  return {
    mode,
    state: "live-ready",
    sourceLabel: "Live Meta",
    canRead: true,
    canWrite: true,
    missingItems,
    stateLabel: "实时模式",
    stateDetail: "当前页面读取数据库中的真实 Meta 数据，不使用演示数据。",
    writeBlockedReason: ""
  };
}

export function getMissingMetaRequirements(): MissingMetaRequirement[] {
  const missing: MissingMetaRequirement[] = [];
  if (!isEnabled(clientEnv.metaConfigured)) {
    missing.push({
      id: "server-meta-credentials",
      label: "Meta App 配置",
      detail: "需要配置 App ID、App Secret 和 OAuth Redirect URI。"
    });
  }
  return missing;
}

export function writeBlockedMessage(connection: ClientApiConnection): string {
  return connection.writeBlockedReason || "当前数据源禁止写入。";
}

function reportRowsToCsv(rows: ReportRow[]): string {
  return [
    "date,platform,spend,impressions,clicks,purchases,roas",
    ...rows.map((row) => [row.date, row.platform, row.spend, row.impressions, row.clicks, row.purchases, row.roas].map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(","))
  ].join("\n");
}

function liveKpis(rows: ReportRow[]): KpiMetric[] {
  if (rows.length === 0) return [];
  const spend = rows.reduce((sum, row) => sum + parseMetric(row.spend), 0);
  const impressions = rows.reduce((sum, row) => sum + parseMetric(row.impressions), 0);
  const clicks = rows.reduce((sum, row) => sum + parseMetric(row.clicks), 0);
  const purchases = rows.reduce((sum, row) => sum + parseMetric(row.purchases), 0);
  const roas = rows.length > 0 ? rows.reduce((sum, row) => sum + parseMetric(row.roas), 0) / rows.length : 0;
  return [
    { label: "花费", value: String(Math.round(spend)), delta: "Live DB", direction: "up", note: "来自数据库同步", accent: true },
    { label: "曝光", value: String(Math.round(impressions)), delta: "Live DB", direction: "up", note: "来自数据库同步" },
    { label: "点击", value: String(Math.round(clicks)), delta: "Live DB", direction: "up", note: "来自数据库同步" },
    { label: "购买", value: String(Math.round(purchases)), delta: roas.toFixed(2), direction: "up", note: "平均 ROAS" }
  ];
}

function queueOperation(adAccountId: string, type: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  void fetch(apiPath("/api/operations"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adAccountId, type, payload, confirmed: true })
  }).catch(() => undefined);
}

function queueSync(accountId: string, type: string): void {
  if (typeof window === "undefined") return;
  void fetch(apiPath(`/api/ad-accounts/${encodeURIComponent(accountId)}/sync`), {
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
