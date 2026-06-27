import type { AdAccount, CampaignEntity, KpiMetric, ReportRow, SyncJob } from "./types";

export const defaultAccountId = "act_23840008291";
export const usAccountId = "act_23840007712";

export type SeedCampaignEntity = Omit<CampaignEntity, "accountId">;
export type SeedSyncJob = Omit<SyncJob, "accountId">;

export const demoAccounts: AdAccount[] = [
  {
    id: "act_23840008291",
    name: "首尔美妆演示账户",
    maskedId: "act_•••• 8291",
    currency: "KRW",
    timezone: "Asia/Seoul",
    status: "healthy"
  },
  {
    id: "act_23840007712",
    name: "Glow 美国演示账户",
    maskedId: "act_•••• 7712",
    currency: "USD",
    timezone: "America/Los_Angeles",
    status: "healthy"
  }
];

export const kpiMetrics: KpiMetric[] = [
  { label: "花费", value: "₩4,821,600", delta: "12.4%", direction: "up", note: "vs 上一周期" },
  { label: "转化价值", value: "₩13,609,700", delta: "18.9%", direction: "up", note: "vs 上一周期" },
  { label: "ROAS", value: "2.82", delta: "5.8%", direction: "up", note: "vs 上一周期", accent: true },
  { label: "购买", value: "386", delta: "9.3%", direction: "up", note: "vs 上一周期" },
  { label: "CPA", value: "₩12,491", delta: "2.8%", direction: "down", note: "成本上升" },
  { label: "曝光", value: "1.84M", delta: "7.1%", direction: "up", note: "vs 上一周期" },
  { label: "CTR", value: "2.37%", delta: "0.3%", direction: "down", note: "vs 上一周期" },
  { label: "CPC", value: "₩286", delta: "4.5%", direction: "up", note: "成本下降" }
];

const campaignRows: SeedCampaignEntity[] = [
  { id: "23840001912", level: "campaign", name: "夏季焕亮｜转化", status: "active", effective: "投放中", budget: "₩260,000 / 日", spend: "₩1,284,000", purchases: "122", cpa: "₩10,525", value: "₩4,930,100", roas: "3.84", impressions: "438,206", ctr: "2.88%", cpc: "₩246", updated: "今天 09:42" },
  { id: "23840001923", level: "campaign", name: "再营销｜7 天", status: "active", effective: "投放中", budget: "₩190,000 / 日", spend: "₩968,400", purchases: "88", cpa: "₩11,005", value: "₩3,205,400", roas: "3.31", impressions: "286,410", ctr: "3.42%", cpc: "₩222", updated: "今天 09:38" },
  { id: "23840001937", level: "campaign", name: "新精华推广｜广泛受众", status: "active", effective: "投放中", budget: "₩170,000 / 日", spend: "₩842,700", purchases: "61", cpa: "₩13,815", value: "₩2,073,200", roas: "2.46", impressions: "312,645", ctr: "2.51%", cpc: "₩268", updated: "今天 08:54" },
  { id: "23840001944", level: "campaign", name: "IG Reels｜Awareness", status: "paused", effective: "已暂停", budget: "₩150,000 / 日", spend: "₩694,900", purchases: "32", cpa: "₩21,716", value: "₩1,195,200", roas: "1.72", impressions: "401,208", ctr: "1.94%", cpc: "₩311", updated: "昨天 18:10" },
  { id: "23840001958", level: "campaign", name: "美妆套装｜测试", status: "active", effective: "学习受限", budget: "₩120,000 / 日", spend: "₩511,600", purchases: "18", cpa: "₩28,422", value: "₩593,500", roas: "1.16", impressions: "164,402", ctr: "1.62%", cpc: "₩356", updated: "今天 07:21", warning: true },
  { id: "23840001967", level: "campaign", name: "Lookalike｜Purchasers 3%", status: "active", effective: "投放中", budget: "₩110,000 / 日", spend: "₩286,300", purchases: "24", cpa: "₩11,929", value: "₩797,400", roas: "2.79", impressions: "94,811", ctr: "2.73%", cpc: "₩251", updated: "今天 06:48" },
  { id: "23840001972", level: "campaign", name: "Skincare Routine｜Video", status: "paused", effective: "广告组已暂停", budget: "₩90,000 / 日", spend: "₩142,800", purchases: "7", cpa: "₩20,400", value: "₩218,100", roas: "1.53", impressions: "68,240", ctr: "1.88%", cpc: "₩297", updated: "6月23日" },
  { id: "23840001986", level: "campaign", name: "Existing Customer｜Cross-sell", status: "active", effective: "投放中", budget: "₩85,000 / 日", spend: "₩78,900", purchases: "12", cpa: "₩6,575", value: "₩316,800", roas: "4.02", impressions: "28,930", ctr: "4.16%", cpc: "₩191", updated: "今天 08:02" },
  { id: "23840001995", level: "campaign", name: "Brand Search｜Always-on", status: "active", effective: "投放中", budget: "₩60,000 / 日", spend: "₩12,000", purchases: "3", cpa: "₩4,000", value: "₩67,200", roas: "5.60", impressions: "4,512", ctr: "5.21%", cpc: "₩137", updated: "今天 09:02" },
  { id: "23840002002", level: "campaign", name: "Creative Test｜June 04", status: "paused", effective: "已暂停", budget: "₩50,000 / 日", spend: "₩0", purchases: "—", cpa: "—", value: "—", roas: "—", impressions: "—", ctr: "—", cpc: "—", updated: "6月22日" }
];

const adSetRows: SeedCampaignEntity[] = [
  { id: "23841001101", level: "adset", name: "广泛受众｜韩国｜23–45", status: "active", effective: "投放中", budget: "₩150,000 / 日", spend: "₩728,400", purchases: "71", cpa: "₩10,259", value: "₩2,774,300", roas: "3.81", impressions: "246,118", ctr: "2.92%", cpc: "₩243", updated: "今天 09:41" },
  { id: "23841001102", level: "adset", name: "Interest｜K-Beauty", status: "active", effective: "投放中", budget: "₩110,000 / 日", spend: "₩555,600", purchases: "51", cpa: "₩10,894", value: "₩2,155,800", roas: "3.88", impressions: "192,088", ctr: "2.83%", cpc: "₩250", updated: "今天 09:40" },
  { id: "23841001120", level: "adset", name: "Website Visitors｜7D", status: "active", effective: "投放中", budget: "₩100,000 / 日", spend: "₩508,200", purchases: "49", cpa: "₩10,371", value: "₩1,824,100", roas: "3.59", impressions: "141,208", ctr: "3.62%", cpc: "₩218", updated: "今天 09:36" },
  { id: "23841001121", level: "adset", name: "Add to Cart｜14D", status: "active", effective: "投放中", budget: "₩90,000 / 日", spend: "₩460,200", purchases: "39", cpa: "₩11,800", value: "₩1,381,300", roas: "3.00", impressions: "145,202", ctr: "3.21%", cpc: "₩236", updated: "今天 09:35" },
  { id: "23841001135", level: "adset", name: "广泛受众｜新精华推广", status: "active", effective: "学习中", budget: "₩170,000 / 日", spend: "₩842,700", purchases: "61", cpa: "₩13,815", value: "₩2,073,200", roas: "2.46", impressions: "312,645", ctr: "2.51%", cpc: "₩268", updated: "今天 08:54", warning: true },
  { id: "23841001142", level: "adset", name: "Reels｜Women 18–34", status: "paused", effective: "已暂停", budget: "₩150,000 / 日", spend: "₩694,900", purchases: "32", cpa: "₩21,716", value: "₩1,195,200", roas: "1.72", impressions: "401,208", ctr: "1.94%", cpc: "₩311", updated: "昨天 18:10" }
];

const adRows: SeedCampaignEntity[] = [
  { id: "23842001401", level: "ad", name: "UGC｜Routine｜V3", status: "active", effective: "投放中", budget: "广告组预算", spend: "₩438,200", purchases: "46", cpa: "₩9,526", value: "₩1,841,400", roas: "4.20", impressions: "139,550", ctr: "3.18%", cpc: "₩232", updated: "今天 09:40" },
  { id: "23842001402", level: "ad", name: "静态图｜夏季焕亮｜01", status: "active", effective: "投放中", budget: "广告组预算", spend: "₩390,200", purchases: "37", cpa: "₩10,546", value: "₩1,420,500", roas: "3.64", impressions: "128,248", ctr: "2.79%", cpc: "₩248", updated: "今天 09:39" },
  { id: "23842001408", level: "ad", name: "静态图｜夏季焕亮｜02", status: "active", effective: "投放中", budget: "广告组预算", spend: "₩284,600", purchases: "24", cpa: "₩11,858", value: "₩952,200", roas: "3.35", impressions: "104,112", ctr: "2.49%", cpc: "₩270", updated: "今天 09:35" },
  { id: "23842001416", level: "ad", name: "Video｜Serum Demo｜15s", status: "active", effective: "学习中", budget: "广告组预算", spend: "₩441,900", purchases: "34", cpa: "₩12,997", value: "₩1,123,700", roas: "2.54", impressions: "161,890", ctr: "2.57%", cpc: "₩264", updated: "今天 08:50", warning: true },
  { id: "23842001417", level: "ad", name: "Static｜Serum Benefit｜A", status: "active", effective: "投放中", budget: "广告组预算", spend: "₩400,800", purchases: "27", cpa: "₩14,844", value: "₩949,500", roas: "2.37", impressions: "150,755", ctr: "2.44%", cpc: "₩271", updated: "今天 08:48" },
  { id: "23842001430", level: "ad", name: "Reels｜UGC 03", status: "paused", effective: "已暂停", budget: "广告组预算", spend: "₩318,600", purchases: "12", cpa: "₩26,550", value: "₩475,800", roas: "1.49", impressions: "191,040", ctr: "1.71%", cpc: "₩326", updated: "昨天 18:09" }
];

export const entityRows = {
  campaign: campaignRows,
  adset: adSetRows,
  ad: adRows
} as const;

export const reportRows: ReportRow[] = [
  { date: "2026-06-25", platform: "Facebook", spend: "₩398,400", impressions: "142,830", clicks: "3,418", purchases: "42", roas: "3.14" },
  { date: "2026-06-25", platform: "Instagram", spend: "₩316,200", impressions: "118,406", clicks: "2,926", purchases: "31", roas: "2.67" },
  { date: "2026-06-24", platform: "Facebook", spend: "₩372,100", impressions: "136,244", clicks: "3,201", purchases: "38", roas: "3.02" },
  { date: "2026-06-24", platform: "Instagram", spend: "₩298,800", impressions: "109,870", clicks: "2,704", purchases: "29", roas: "2.51" }
];

export const syncJobs: SeedSyncJob[] = [
  { id: "sync-insights", type: "同步 Insights", scope: "近 7 天 · Ad", status: "running", progress: "68%", startedAt: "10:42:18", elapsed: "1m 12s", requestId: "req_8d91..." },
  { id: "sync-entities", type: "同步广告对象", scope: "Campaign / Ad Set / Ad", status: "success", progress: "100%", startedAt: "10:34:02", elapsed: "48s", requestId: "req_27bc..." },
  { id: "apply-batch", type: "批量暂停", scope: "3 个 Campaign", status: "partial", progress: "2 / 3", startedAt: "09:16:44", elapsed: "9s", requestId: "req_114f..." },
  {
    id: "poll-report",
    type: "异步报表",
    scope: "30 天 · Ad",
    status: "failed",
    progress: "—",
    startedAt: "08:42:10",
    elapsed: "4m 30s",
    requestId: "req_a20e...",
    error: {
      title: "报表任务因限流未完成",
      message: "系统已停止非紧急任务，并将在安全窗口后重试。缓存数据仍可查看。",
      impact: "影响 30 天 Ad 级自定义报表，不影响已同步 Overview。",
      retryable: true,
      code: "META_RATE_LIMITED",
      subcode: "80004",
      fbtraceId: "A1b2••••",
      action: "稍后重试，或减少日期范围和 Breakdown 组合。"
    }
  }
];
