import { rowsToCsv } from "@adflow/shared";
import { demoAccounts, entityRows, kpiMetrics, reportRows, syncJobs } from "./demo-data";
import type { AdAccount, CampaignEntity, CreatedAdBundle, CreateAdDraftInput, DemoQueryContext, EntityLevel, KpiMetric, ReportRow, SyncJob, UpdateEntityInput } from "./types";

export class DemoMetaAdsProvider {
  readonly mode = "demo" as const;
  #entities: Record<EntityLevel, CampaignEntity[]>;
  #syncJobs: SyncJob[];
  #creatives: Array<{ id: string; name: string; assetFile: string; status: "paused" }>;
  #entitySequence = 9000;
  #syncSequence = 1;

  constructor() {
    this.#entities = {
      campaign: entityRows.campaign.map((row) => ({ ...row })),
      adset: entityRows.adset.map((row) => ({ ...row })),
      ad: entityRows.ad.map((row) => ({ ...row }))
    };
    this.#syncJobs = syncJobs.map((job) => (job.error ? { ...job, error: { ...job.error } } : { ...job }));
    this.#creatives = [];
  }

  listAdAccounts(): AdAccount[] {
    return demoAccounts;
  }

  getKpis(context?: DemoQueryContext): KpiMetric[] {
    const factor = contextFactor(context);
    return kpiMetrics.map((metric) => ({
      ...metric,
      value: scaleDisplayValue(metric.value, factor),
      delta: scalePercent(metric.delta, context?.compareRange)
    }));
  }

  listEntities(level: EntityLevel, query = "", context?: DemoQueryContext): CampaignEntity[] {
    const normalized = query.trim().toLowerCase();
    return this.#entities[level]
      .filter((row) => `${row.name} ${row.id}`.toLowerCase().includes(normalized))
      .map((row) => withContext(row, context));
  }

  updateStatus(level: EntityLevel, ids: string[], status: "active" | "paused"): CampaignEntity[] {
    this.#entities[level] = this.#entities[level].map((row) =>
      ids.includes(row.id)
        ? { ...row, status, effective: status === "active" ? "投放中" : "已暂停", updated: "刚刚" }
        : row
    );
    return this.#entities[level];
  }

  updateBudget(level: EntityLevel, ids: string[], dailyBudget: number): CampaignEntity[] {
    const formatted = `₩${dailyBudget.toLocaleString("en-US")} / 日`;
    this.#entities[level] = this.#entities[level].map((row) =>
      ids.includes(row.id)
        ? { ...row, budget: level === "ad" ? `广告组预算 · ${formatted}` : formatted, updated: "刚刚" }
        : row
    );
    return this.#entities[level];
  }

  updateEntity(level: EntityLevel, id: string, input: UpdateEntityInput): CampaignEntity | null {
    const amount = Number(input.budget.replace(/[^\d.-]/g, ""));
    const formattedBudget = amount > 0 ? `₩${Math.round(amount).toLocaleString("en-US")} / 日` : input.budget;
    let updated: CampaignEntity | null = null;
    this.#entities[level] = this.#entities[level].map((row) => {
      if (row.id !== id) return row;
      updated = {
        ...row,
        name: input.name,
        status: input.status,
        effective: input.status === "active" ? "投放中" : "已暂停",
        budget: level === "ad" ? `广告组预算 · ${formattedBudget}` : formattedBudget,
        updated: "刚刚"
      };
      return updated;
    });
    return updated;
  }

  createAdBundle(input: CreateAdDraftInput): CreatedAdBundle {
    const campaignId = this.#nextId("238499");
    const adSetId = this.#nextId("238509");
    const creativeId = this.#nextId("cr_demo_");
    const adId = this.#nextId("238519");
    const budgetValue = Number(input.budget.replace(/[^\d.-]/g, "")) || 100000;
    const budget = `₩${budgetValue.toLocaleString("en-US")} / 日`;

    const campaign: CampaignEntity = {
      id: campaignId,
      level: "campaign",
      name: input.campaignName,
      status: "paused",
      effective: "已暂停",
      budget,
      spend: "₩0",
      purchases: "—",
      cpa: "—",
      value: "—",
      roas: "—",
      impressions: "—",
      ctr: "—",
      cpc: "—",
      updated: "刚刚"
    };
    const adSet: CampaignEntity = {
      ...campaign,
      id: adSetId,
      level: "adset",
      name: `${input.audience}｜${input.event}`,
      budget
    };
    const ad: CampaignEntity = {
      ...campaign,
      id: adId,
      level: "ad",
      name: input.title,
      budget: `广告组预算 · ${budget}`
    };

    this.#entities.campaign = [campaign, ...this.#entities.campaign];
    this.#entities.adset = [adSet, ...this.#entities.adset];
    this.#entities.ad = [ad, ...this.#entities.ad];
    this.#creatives = [{ id: creativeId, name: input.title, assetFile: input.assetFile, status: "paused" }, ...this.#creatives];

    return { campaignId, adSetId, creativeId, adId };
  }

  duplicateEntities(level: EntityLevel, ids: string[]): CampaignEntity[] {
    const sourceRows = this.#entities[level].filter((row) => ids.includes(row.id));
    const copies = sourceRows.map((row) => {
      this.#entitySequence += 1;
      return {
        ...row,
        id: `${row.id.slice(0, -4)}${this.#entitySequence}`,
        name: `${row.name}｜副本`,
        status: "paused" as const,
        effective: "已暂停" as const,
        spend: "₩0",
        purchases: "—",
        cpa: "—",
        value: "—",
        roas: "—",
        impressions: "—",
        ctr: "—",
        cpc: "—",
        updated: "刚刚",
        warning: false
      };
    });
    this.#entities[level] = [...copies, ...this.#entities[level]];
    return copies;
  }

  markEntities(level: EntityLevel, ids: string[], warning: boolean): CampaignEntity[] {
    this.#entities[level] = this.#entities[level].map((row) =>
      ids.includes(row.id) ? { ...row, warning, updated: "刚刚" } : row
    );
    return this.#entities[level];
  }

  touchEntities(level: EntityLevel, ids: string[]): CampaignEntity[] {
    this.#entities[level] = this.#entities[level].map((row) =>
      ids.includes(row.id) ? { ...row, updated: "刚刚" } : row
    );
    return this.#entities[level];
  }

  listReportRows(): ReportRow[] {
    return reportRows;
  }

  exportReportCsv(): string {
    return rowsToCsv([
      ["日期", "平台", "花费", "曝光", "点击", "购买", "ROAS"],
      ...reportRows.map((row) => [row.date, row.platform, row.spend, row.impressions, row.clicks, row.purchases, row.roas])
    ]);
  }

  listSyncJobs(): SyncJob[] {
    return this.#syncJobs;
  }

  enqueueSyncJob(): SyncJob {
    this.#syncSequence += 1;
    const startedAt = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const job: SyncJob = {
      id: `manual-sync-${this.#syncSequence}`,
      type: "立即同步",
      scope: "Campaign / Ad Set / Ad / Insights",
      status: "running",
      progress: "8%",
      startedAt,
      elapsed: "0s",
      requestId: `req_demo_${String(this.#syncSequence).padStart(3, "0")}`
    };
    this.#syncJobs = [job, ...this.#syncJobs];
    return job;
  }

  updateSyncJob(id: string, patch: Partial<Pick<SyncJob, "status" | "progress" | "elapsed">>): SyncJob[] {
    this.#syncJobs = this.#syncJobs.map((job) => (job.id === id ? { ...job, ...patch } : job));
    return this.#syncJobs;
  }

  #nextId(prefix: string): string {
    this.#entitySequence += 1;
    return `${prefix}${this.#entitySequence}`;
  }
}

export const demoProvider = new DemoMetaAdsProvider();

function contextFactor(context?: DemoQueryContext): number {
  const accountFactor = context?.accountId?.endsWith("7712") ? 0.74 : 1;
  const dateFactor = context?.dateRange === "近 30 天" ? 3.9 : context?.dateRange === "近 14 天" ? 1.85 : 1;
  const compareFactor = context?.compareRange === "去年同期" ? 1.12 : context?.compareRange === "不对比" ? 0.96 : 1;
  return accountFactor * dateFactor * compareFactor;
}

function withContext(row: CampaignEntity, context?: DemoQueryContext): CampaignEntity {
  const factor = contextFactor(context);
  if (factor === 1) return { ...row };
  return {
    ...row,
    spend: scaleDisplayValue(row.spend, factor),
    purchases: scaleIntegerDisplay(row.purchases, factor),
    cpa: scaleDisplayValue(row.cpa, factor > 1 ? 0.94 : 1.08),
    value: scaleDisplayValue(row.value, factor * (factor > 1 ? 1.04 : 0.97)),
    roas: scaleRoas(row.roas, factor),
    impressions: scaleIntegerDisplay(row.impressions, factor),
    cpc: scaleDisplayValue(row.cpc, factor > 1 ? 0.92 : 1.05)
  };
}

function scaleDisplayValue(value: string, factor: number): string {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) return value;
  const scaled = Math.round(numeric * factor);
  if (value.includes("₩")) return `₩${scaled.toLocaleString("en-US")}`;
  if (value.endsWith("M")) return `${(Number(value.replace("M", "")) * factor).toFixed(2)}M`;
  return scaled.toLocaleString("en-US");
}

function scaleIntegerDisplay(value: string, factor: number): string {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) return value;
  return Math.max(1, Math.round(numeric * factor)).toLocaleString("en-US");
}

function scaleRoas(value: string, factor: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return (numeric * (factor > 1 ? 1.03 : 0.96)).toFixed(2);
}

function scalePercent(value: string, compareRange?: DemoQueryContext["compareRange"]): string {
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) return value;
  const factor = compareRange === "去年同期" ? 0.72 : compareRange === "不对比" ? 0 : 1;
  return `${(numeric * factor).toFixed(1)}%`;
}
