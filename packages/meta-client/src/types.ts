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

export type ReportRow = {
  date: string;
  platform: string;
  spend: string;
  impressions: string;
  clicks: string;
  purchases: string;
  roas: string;
};
