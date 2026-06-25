import { rowsToCsv } from "@adflow/shared";
import { demoAccounts, entityRows, kpiMetrics, reportRows, syncJobs } from "./demo-data";
import type { AdAccount, CampaignEntity, EntityLevel, KpiMetric, ReportRow, SyncJob } from "./types";

export class DemoMetaAdsProvider {
  readonly mode = "demo" as const;
  #entities: Record<EntityLevel, CampaignEntity[]>;

  constructor() {
    this.#entities = {
      campaign: [...entityRows.campaign],
      adset: [...entityRows.adset],
      ad: [...entityRows.ad]
    };
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
    return syncJobs;
  }
}

export const demoProvider = new DemoMetaAdsProvider();
