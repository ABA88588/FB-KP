import { rowsToCsv } from "@adflow/shared";
import { defaultAccountId, demoAccounts, entityRows, kpiMetrics, reportRows, syncJobs, usAccountId, type SeedCampaignEntity } from "./demo-data";
import type { MetaAdsProvider, MetaProviderAvailability } from "./provider";
import type { AdAccount, CampaignEntity, CreativeAsset, CreatedAdBundle, CreateAdDraftInput, DemoQueryContext, EntityLevel, KpiMetric, ReportRow, SyncJob, UpdateEntityInput } from "./types";

const baseCreatives: Array<Omit<CreativeAsset, "accountId">> = [
  { id: "asset-1", title: "夏季焕亮", file: "summer_glow.jpg", type: "图片", usage: 2, recent: 5, thumb: 1, status: "active" },
  { id: "asset-2", title: "新精华推广", file: "new_serum.mp4", type: "视频", usage: 3, recent: 4, thumb: 2, status: "active" },
  { id: "asset-3", title: "20% OFF", file: "20_off.jpg", type: "图片", usage: 4, recent: 3, thumb: 3, status: "active" },
  { id: "asset-4", title: "用户内容种草", file: "ugc_routine.jpg", type: "图片", usage: 5, recent: 2, thumb: 4, status: "active" },
  { id: "asset-5", title: "美妆套装", file: "beauty_set.jpg", type: "图片", usage: 6, recent: 1, thumb: 5, status: "active" }
];

export class DemoMetaAdsProvider implements MetaAdsProvider {
  readonly mode = "demo" as const;
  #entities: Record<EntityLevel, CampaignEntity[]>;
  #syncJobs: SyncJob[];
  #creatives: CreativeAsset[];
  #entitySequence = 9000;
  #creativeSequence = 100;
  #syncSequence = 1;

  constructor() {
    const [krAccount, usAccount] = demoAccounts;
    this.#entities = {
      campaign: [
        ...seedEntities(entityRows.campaign, krAccount, 1, ""),
        ...seedEntities(entityRows.campaign.slice(0, 7), usAccount, 0.072, "us")
      ],
      adset: [
        ...seedEntities(entityRows.adset, krAccount, 1, ""),
        ...seedEntities(entityRows.adset.slice(0, 5), usAccount, 0.072, "us")
      ],
      ad: [
        ...seedEntities(entityRows.ad, krAccount, 1, ""),
        ...seedEntities(entityRows.ad.slice(0, 5), usAccount, 0.072, "us")
      ]
    };
    this.#syncJobs = [
      ...syncJobs.map((job) => ({ ...job, accountId: defaultAccountId })),
      ...syncJobs.slice(0, 3).map((job) => {
        const seeded = {
          ...job,
          id: `${job.id}-us`,
          accountId: usAccountId,
          requestId: `${job.requestId}-us`
        };
        return job.error ? { ...seeded, error: { ...job.error } } : seeded;
      })
    ];
    this.#creatives = [
      ...baseCreatives.map((creative) => ({ ...creative, accountId: defaultAccountId })),
      ...baseCreatives.slice(0, 4).map((creative) => ({
        ...creative,
        id: `${creative.id}-us`,
        accountId: usAccountId,
        file: creative.file.replace(".", "_us."),
        usage: Math.max(0, creative.usage - 1)
      }))
    ];
  }

  getAvailability(): MetaProviderAvailability {
    return {
      mode: "demo",
      configured: true,
      disabled: false,
      status: "configured"
    };
  }

  listAdAccounts(): AdAccount[] {
    return demoAccounts;
  }

  getKpis(context?: DemoQueryContext): KpiMetric[] {
    const account = accountFor(context?.accountId);
    const factor = contextFactor(context);
    return kpiMetrics.map((metric) => ({
      ...metric,
      value: scaleDisplayValue(metric.value, factor, account.currency),
      delta: scalePercent(metric.delta, context?.compareRange),
      note: context?.compareRange === "不对比" ? "不对比" : metric.note
    }));
  }

  listEntities(level: EntityLevel, accountId: string, query = "", context?: DemoQueryContext): CampaignEntity[] {
    const normalized = query.trim().toLowerCase();
    return this.#entities[level]
      .filter((row) => row.accountId === accountId)
      .filter((row) => `${row.name} ${row.id}`.toLowerCase().includes(normalized))
      .map((row) => withContext(row, context));
  }

  updateStatus(level: EntityLevel, accountId: string, ids: string[], status: "active" | "paused"): CampaignEntity[] {
    this.#entities[level] = this.#entities[level].map((row) =>
      row.accountId === accountId && ids.includes(row.id)
        ? { ...row, status, effective: status === "active" ? "投放中" : "已暂停", updated: "刚刚" }
        : row
    );
    return this.listEntities(level, accountId);
  }

  updateBudget(level: EntityLevel, accountId: string, ids: string[], dailyBudget: number): CampaignEntity[] {
    const account = accountFor(accountId);
    const formatted = formatMoney(dailyBudget, account.currency, " / 日");
    this.#entities[level] = this.#entities[level].map((row) =>
      row.accountId === accountId && ids.includes(row.id)
        ? { ...row, budget: level === "ad" ? `广告组预算 · ${formatted}` : formatted, updated: "刚刚" }
        : row
    );
    return this.listEntities(level, accountId);
  }

  updateEntity(level: EntityLevel, accountId: string, id: string, input: UpdateEntityInput): CampaignEntity | null {
    const account = accountFor(accountId);
    const amount = Number(input.budget.replace(/[^\d.-]/g, ""));
    const formattedBudget = amount > 0 ? formatMoney(Math.round(amount), account.currency, " / 日") : input.budget;
    let updated: CampaignEntity | null = null;
    this.#entities[level] = this.#entities[level].map((row) => {
      if (row.accountId !== accountId || row.id !== id) return row;
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
    return updated ? withContext(updated, { accountId }) : null;
  }

  createAdBundle(accountId: string, input: CreateAdDraftInput): CreatedAdBundle {
    const account = accountFor(accountId);
    const campaignId = this.#nextId(account.currency === "USD" ? "238799" : "238499");
    const adSetId = this.#nextId(account.currency === "USD" ? "238809" : "238509");
    const creativeId = this.#nextId("cr_demo_");
    const adId = this.#nextId(account.currency === "USD" ? "238819" : "238519");
    const budgetValue = Number(input.budget.replace(/[^\d.-]/g, "")) || (account.currency === "USD" ? 120 : 100000);
    const budget = formatMoney(budgetValue, account.currency, " / 日");

    const campaign: CampaignEntity = {
      accountId,
      id: campaignId,
      level: "campaign",
      name: input.campaignName,
      status: "paused",
      effective: "已暂停",
      budget,
      spend: formatMoney(0, account.currency),
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
    this.#creatives = [
      {
        accountId,
        id: creativeId,
        title: input.title,
        file: input.assetFile,
        type: input.assetFile.toLowerCase().endsWith(".mp4") ? "视频" : "图片",
        usage: 1,
        recent: 0,
        thumb: ((this.#creativeSequence - 1) % 5) + 1,
        status: "paused"
      },
      ...this.#creatives.map((creative) => creative.accountId === accountId ? { ...creative, recent: creative.recent + 1 } : creative)
    ];

    return { campaignId, adSetId, creativeId, adId };
  }

  duplicateEntities(level: EntityLevel, accountId: string, ids: string[]): CampaignEntity[] {
    const sourceRows = this.#entities[level].filter((row) => row.accountId === accountId && ids.includes(row.id));
    const account = accountFor(accountId);
    const copies = sourceRows.map((row) => {
      this.#entitySequence += 1;
      return {
        ...row,
        id: `${row.id.slice(0, -4)}${this.#entitySequence}`,
        name: `${row.name}｜副本`,
        status: "paused" as const,
        effective: "已暂停" as const,
        spend: formatMoney(0, account.currency),
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

  markEntities(level: EntityLevel, accountId: string, ids: string[], warning: boolean): CampaignEntity[] {
    this.#entities[level] = this.#entities[level].map((row) =>
      row.accountId === accountId && ids.includes(row.id) ? { ...row, warning, updated: "刚刚" } : row
    );
    return this.listEntities(level, accountId);
  }

  touchEntities(level: EntityLevel, accountId: string, ids: string[]): CampaignEntity[] {
    this.#entities[level] = this.#entities[level].map((row) =>
      row.accountId === accountId && ids.includes(row.id) ? { ...row, updated: "刚刚" } : row
    );
    return this.listEntities(level, accountId);
  }

  listCreatives(accountId: string, query = "", type: "全部" | CreativeAsset["type"] = "全部"): CreativeAsset[] {
    const normalized = query.trim().toLowerCase();
    return this.#creatives
      .filter((creative) => creative.accountId === accountId && creative.status !== "archived")
      .filter((creative) => type === "全部" || creative.type === type)
      .filter((creative) => `${creative.title} ${creative.file}`.toLowerCase().includes(normalized))
      .map((creative) => ({ ...creative }));
  }

  createCreative(accountId: string): CreativeAsset {
    this.#creativeSequence += 1;
    const next: CreativeAsset = {
      accountId,
      id: `asset-demo-${this.#creativeSequence}`,
      title: `DEMO ASSET ${this.#creativeSequence}`,
      file: `演示素材_${this.#creativeSequence}.jpg`,
      type: "图片",
      usage: 0,
      recent: 0,
      thumb: ((this.#creativeSequence - 1) % 5) + 1,
      status: "active"
    };
    this.#creatives = [next, ...this.#creatives.map((creative) => creative.accountId === accountId ? { ...creative, recent: creative.recent + 1 } : creative)];
    return next;
  }

  duplicateCreative(accountId: string, id: string): CreativeAsset | null {
    const source = this.#creatives.find((creative) => creative.accountId === accountId && creative.id === id);
    if (!source) return null;
    this.#creativeSequence += 1;
    const copy: CreativeAsset = {
      ...source,
      id: `${source.id}-copy-${this.#creativeSequence}`,
      title: `${source.title} COPY`,
      file: source.file.replace(".", "_copy."),
      recent: 0
    };
    this.#creatives = [copy, ...this.#creatives];
    return copy;
  }

  archiveCreative(accountId: string, id: string): CreativeAsset[] {
    this.#creatives = this.#creatives.map((creative) =>
      creative.accountId === accountId && creative.id === id ? { ...creative, status: "archived" } : creative
    );
    return this.listCreatives(accountId);
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

  listSyncJobs(accountId: string): SyncJob[] {
    return this.#syncJobs.filter((job) => job.accountId === accountId).map((job) => (job.error ? { ...job, error: { ...job.error } } : { ...job }));
  }

  enqueueSyncJob(accountId: string): SyncJob {
    this.#syncSequence += 1;
    const startedAt = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const job: SyncJob = {
      accountId,
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

  updateSyncJob(accountId: string, id: string, patch: Partial<Pick<SyncJob, "status" | "progress" | "elapsed">>): SyncJob[] {
    this.#syncJobs = this.#syncJobs.map((job) => (job.accountId === accountId && job.id === id ? { ...job, ...patch } : job));
    return this.listSyncJobs(accountId);
  }

  #nextId(prefix: string): string {
    this.#entitySequence += 1;
    return `${prefix}${this.#entitySequence}`;
  }
}

export const demoProvider = new DemoMetaAdsProvider();

function seedEntities(rows: readonly SeedCampaignEntity[], account: AdAccount | undefined, factor: number, idFlavor: string): CampaignEntity[] {
  const activeAccount = account ?? accountFor(defaultAccountId);
  return rows.map((row) => ({
    ...row,
    accountId: activeAccount.id,
    id: idFlavor ? `${row.id}-${idFlavor}` : row.id,
    name: idFlavor ? row.name.replaceAll("KR", "US") : row.name,
    budget: formatBudget(row.budget, activeAccount.currency, factor),
    spend: formatCurrencyLike(row.spend, activeAccount.currency, factor),
    cpa: formatCurrencyLike(row.cpa, activeAccount.currency, factor),
    value: formatCurrencyLike(row.value, activeAccount.currency, factor),
    cpc: formatCurrencyLike(row.cpc, activeAccount.currency, factor),
    purchases: scaleIntegerDisplay(row.purchases, idFlavor ? 0.68 : 1),
    impressions: scaleIntegerDisplay(row.impressions, idFlavor ? 0.82 : 1)
  }));
}

function accountFor(accountId?: string): AdAccount {
  return demoAccounts.find((account) => account.id === accountId) ?? demoAccounts[0] ?? {
    id: defaultAccountId,
    name: "首尔美妆演示账户",
    maskedId: "act_••••8291",
    currency: "KRW",
    timezone: "Asia/Seoul",
    status: "healthy"
  };
}

function contextFactor(context?: DemoQueryContext): number {
  const accountFactor = context?.accountId === usAccountId ? 0.74 : 1;
  const dateFactor = context?.dateRange === "近 30 天" ? 3.9 : context?.dateRange === "近 14 天" ? 1.85 : 1;
  const compareFactor = context?.compareRange === "去年同期" ? 1.12 : 1;
  return accountFactor * dateFactor * compareFactor;
}

function withContext(row: CampaignEntity, context?: DemoQueryContext): CampaignEntity {
  const factor = contextFactor(context);
  if (factor === 1) return { ...row };
  const account = accountFor(row.accountId);
  return {
    ...row,
    spend: scaleDisplayValue(row.spend, factor, account.currency),
    purchases: scaleIntegerDisplay(row.purchases, factor),
    cpa: scaleDisplayValue(row.cpa, factor > 1 ? 0.94 : 1.08, account.currency),
    value: scaleDisplayValue(row.value, factor * (factor > 1 ? 1.04 : 0.97), account.currency),
    roas: scaleRoas(row.roas, factor),
    impressions: scaleIntegerDisplay(row.impressions, factor),
    cpc: scaleDisplayValue(row.cpc, factor > 1 ? 0.92 : 1.05, account.currency)
  };
}

function parseNumber(value: string): number {
  return Number(value.replace(/[^\d.-]/g, ""));
}

function formatMoney(value: number, currency: AdAccount["currency"], suffix = ""): string {
  const symbol = currency === "USD" ? "$" : "₩";
  return `${symbol}${Math.round(value).toLocaleString("en-US")}${suffix}`;
}

function formatCurrencyLike(value: string, currency: AdAccount["currency"], factor: number): string {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric) || numeric === 0) return value.includes("0") ? formatMoney(0, currency) : value;
  return formatMoney(numeric * factor, currency);
}

function formatBudget(value: string, currency: AdAccount["currency"], factor: number): string {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric) || numeric === 0) return value;
  return formatMoney(numeric * factor, currency, " / 日");
}

function scaleDisplayValue(value: string, factor: number, currency: AdAccount["currency"]): string {
  if (factor === 1) return value;
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric) || numeric === 0) return value;
  if (isCurrencyValue(value)) return formatMoney(numeric * factor, currency);
  if (value.includes("%")) return `${(numeric * factor).toFixed(2)}%`;
  if (value.endsWith("M")) return `${(Number(value.replace("M", "")) * factor).toFixed(2)}M`;
  if (value.includes(".")) return (numeric * factor).toFixed(2);
  return Math.round(numeric * factor).toLocaleString("en-US");
}

function isCurrencyValue(value: string): boolean {
  return value.includes("₩") || value.includes("$") || value.includes("鈧");
}

function scaleIntegerDisplay(value: string, factor: number): string {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric) || numeric === 0) return value;
  return Math.max(1, Math.round(numeric * factor)).toLocaleString("en-US");
}

function scaleRoas(value: string, factor: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return (numeric * (factor > 1 ? 1.03 : 0.96)).toFixed(2);
}

function scalePercent(value: string, compareRange?: DemoQueryContext["compareRange"]): string {
  if (compareRange === "不对比") return "—";
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric)) return value;
  const factor = compareRange === "去年同期" ? 0.72 : 1;
  return `${(numeric * factor).toFixed(1)}%`;
}
