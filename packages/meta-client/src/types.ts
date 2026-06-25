export type EntityLevel = "campaign" | "adset" | "ad";
export type ConfiguredStatus = "active" | "paused";
export type EffectiveStatus = "投放中" | "已暂停" | "学习中" | "学习受限" | "广告组已暂停" | "未投放";

export type AdAccount = {
  id: string;
  name: string;
  maskedId: string;
  currency: "KRW" | "USD";
  timezone: string;
  status: "healthy" | "token-expired" | "permission-denied";
};

export type CampaignEntity = {
  accountId: string;
  id: string;
  level: EntityLevel;
  name: string;
  status: ConfiguredStatus;
  effective: EffectiveStatus;
  budget: string;
  spend: string;
  purchases: string;
  cpa: string;
  value: string;
  roas: string;
  impressions: string;
  ctr: string;
  cpc: string;
  updated: string;
  warning?: boolean;
};

export type KpiMetric = {
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down";
  note: string;
  accent?: boolean;
};

export type SyncJob = {
  accountId: string;
  id: string;
  type: string;
  scope: string;
  status: "running" | "success" | "partial" | "failed" | "queued";
  progress: string;
  startedAt: string;
  elapsed: string;
  requestId: string;
  error?: {
    title: string;
    message: string;
    impact: string;
    retryable: boolean;
    code: string;
    subcode: string;
    fbtraceId: string;
    action: string;
  };
};

export type CreativeAsset = {
  accountId: string;
  id: string;
  title: string;
  file: string;
  type: "图片" | "视频";
  usage: number;
  recent: number;
  thumb: number;
  status: "active" | "paused" | "archived";
};

export type ReportRow = {
  date: string;
  platform: string;
  spend: string;
  impressions: string;
  clicks: string;
  purchases: string;
  roas: string;
};

export type DemoQueryContext = {
  accountId?: string;
  dateRange?: "近 7 天" | "近 14 天" | "近 30 天";
  compareRange?: "上一周期" | "去年同期" | "不对比";
};

export type CreateAdDraftInput = {
  campaignName: string;
  objective: string;
  budget: string;
  audience: string;
  event: string;
  title: string;
  assetFile: string;
};

export type CreatedAdBundle = {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
};

export type UpdateEntityInput = {
  name: string;
  status: ConfiguredStatus;
  budget: string;
};
