import { rowsToCsv } from "@adflow/shared";
import { demoAccounts, entityRows, kpiMetrics, reportRows, syncJobs } from "./demo-data";
import type { AdAccount, CampaignEntity, EntityLevel, KpiMetric, ReportRow, SyncJob } from "./types";

export class DemoMetaAdsProvider {
  readonly mode = "demo" as const;
  #entities: Record<EntityLevel, CampaignEntity[]>;
  #syncJobs: SyncJob[];
  #entitySequence = 9000;
  #syncSequence = 1;

  constructor() {
    this.#entities = {
      campaign: entityRows.campaign.map((row) => ({ ...row })),
      adset: entityRows.adset.map((row) => ({ ...row })),
      ad: entityRows.ad.map((row) => ({ ...row }))
    };
    this.#syncJobs = syncJobs.map((job) => (job.error ? { ...job, error: { ...job.error } } : { ...job }));
  }

  listAdAccounts(): AdAccount[] {
    return demoAccounts;
  }

  getKpis(): KpiMetric[] {
    return kpiMetrics;
  }

  listEntities(level: EntityLevel, query = ""): CampaignEntity[] {
    const normalized = query.trim().toLowerCase();
    return this.#entities[level].filter((row) => `${row.name} ${row.id}`.toLowerCase().includes(normalized));
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
}

export const demoProvider = new DemoMetaAdsProvider();
