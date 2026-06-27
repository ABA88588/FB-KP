import { evaluateMetaWriteGate, type OrganizationRole, type WriteGateInput, type WriteGateResult } from "@adflow/shared";
import type { ParsedMetaCursorPage } from "./live/cursor";

export type MetaProviderMode = "demo" | "live";
export const DEFAULT_META_MUTATION_STATUS = "PAUSED";

export type MetaProviderAvailability =
  | {
      mode: "demo";
      configured: true;
      disabled: false;
      status: "configured";
    }
  | {
      mode: "live";
      configured: true;
      disabled: false;
      status: "configured";
      graphApiVersion: string;
    }
  | {
      mode: "live";
      configured: false;
      disabled: true;
      status: "unconfigured";
      graphApiVersion: string;
      missing: readonly string[];
      reason: "MISSING_CREDENTIALS";
      message: string;
    };

export interface MetaAdsProvider {
  readonly mode: MetaProviderMode;
  getAvailability(): MetaProviderAvailability;
}

export type LiveMetaRequest = {
  accessToken?: string;
  requestId?: string;
};

export type LiveAdAccount = {
  metaId: string;
  accountId: string;
  name: string;
  currency: string;
  timezoneName: string;
  status: string;
  disableReason?: string;
  isReadOnly: boolean;
};

export type LiveCampaign = {
  metaId: string;
  name: string;
  objective?: string;
  configuredStatus: string;
  effectiveStatus: string;
  dailyBudgetMinor?: string;
  updatedTime?: string;
};

export type LiveAdSet = {
  metaId: string;
  campaignMetaId: string;
  name: string;
  configuredStatus: string;
  effectiveStatus: string;
  dailyBudgetMinor?: string;
  lifetimeBudgetMinor?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  targetingJson?: unknown;
  promotedObjectJson?: unknown;
  updatedTime?: string;
};

export type LiveAd = {
  metaId: string;
  campaignMetaId: string;
  adSetMetaId: string;
  creativeMetaId?: string;
  name: string;
  configuredStatus: string;
  effectiveStatus: string;
  updatedTime?: string;
};

export type LiveCreative = {
  metaId: string;
  name?: string;
  title?: string;
  body?: string;
  imageHash?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  status?: string;
  raw: unknown;
};

export type LiveInsight = Record<string, unknown> & {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
};

export type LiveAsset = {
  metaId: string;
  name?: string;
  raw: unknown;
};

export type MetaCursorPage<T> = {
  data: T[];
  cursor: ParsedMetaCursorPage;
};

export type MetaPageParams = {
  after?: string;
  limit?: number;
  updatedSince?: string;
};

export type MetaCreateCampaignInput = {
  adAccountMetaId: string;
  name: string;
  objective: string;
  buyingType?: string;
  specialAdCategories?: readonly string[];
  dailyBudgetMinor?: number;
  operationId: string;
  guard: WriteGateResult;
};

export type MetaCreateAdSetInput = {
  adAccountMetaId: string;
  campaignMetaId: string;
  name: string;
  dailyBudgetMinor?: number;
  optimizationGoal: string;
  billingEvent: string;
  targetingJson: string;
  promotedObjectJson?: string;
  operationId: string;
  guard: WriteGateResult;
};

export type MetaCreateAdCreativeInput = {
  adAccountMetaId: string;
  name: string;
  objectStorySpecJson: string;
  assetFeedSpecJson?: string;
  operationId: string;
  guard: WriteGateResult;
};

export type MetaCreateAdInput = {
  adAccountMetaId: string;
  adSetMetaId: string;
  creativeMetaId: string;
  name: string;
  operationId: string;
  guard: WriteGateResult;
};

export type MetaMutationResult = {
  metaId: string;
  operationId: string;
  status: typeof DEFAULT_META_MUTATION_STATUS | "UPDATED";
};

export type MetaUpdateObjectInput = {
  objectMetaId: string;
  objectType: "campaign" | "adset" | "ad";
  name?: string;
  status?: "ACTIVE" | "PAUSED";
  dailyBudgetMinor?: number;
  operationId: string;
  guard: WriteGateResult;
};

export type MetaDuplicateObjectInput = {
  objectMetaId: string;
  objectType: "campaign" | "adset" | "ad";
  operationId: string;
  guard: WriteGateResult;
};

export type MetaMutationGuardInput = {
  adAccountMetaId: string;
  enableMetaWrites?: boolean;
  emergencyReadonly?: boolean;
  role?: OrganizationRole;
  scopes?: readonly string[];
  allowedMetaAdAccountIds?: readonly string[];
  accountReadOnly?: boolean;
  connectionHealthy?: boolean;
};

export function buildMetaMutationGuardInput(input: MetaMutationGuardInput): WriteGateInput {
  return {
    enableMetaWrites: input.enableMetaWrites ?? false,
    emergencyReadonly: input.emergencyReadonly ?? false,
    role: input.role ?? "VIEWER",
    scopes: input.scopes ?? [],
    adAccountMetaId: input.adAccountMetaId,
    allowedMetaAdAccountIds: input.allowedMetaAdAccountIds ?? [],
    accountReadOnly: input.accountReadOnly ?? true,
    connectionHealthy: input.connectionHealthy ?? false
  };
}

export function evaluateMetaMutationGuard(input: MetaMutationGuardInput, operationId?: string): WriteGateResult {
  return evaluateMetaWriteGate(buildMetaMutationGuardInput(input), operationId);
}

export interface LiveMetaAdsProviderContract extends MetaAdsProvider {
  readonly mode: "live";
  getMe(request: LiveMetaRequest): Promise<{ id: string; name?: string }>;
  listAdAccountsPage(request: LiveMetaRequest, params?: MetaPageParams): Promise<MetaCursorPage<LiveAdAccount>>;
  listAdAccounts(request: LiveMetaRequest): Promise<LiveAdAccount[]>;
  listCampaignsPage(request: LiveMetaRequest, adAccountMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveCampaign>>;
  listCampaigns(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCampaign[]>;
  listAdSetsPage(request: LiveMetaRequest, adAccountMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveAdSet>>;
  listAdSets(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAdSet[]>;
  listAdsPage(request: LiveMetaRequest, adAccountMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveAd>>;
  listAds(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAd[]>;
  listCreativesPage(request: LiveMetaRequest, adAccountMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveCreative>>;
  listCreatives(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCreative[]>;
  listInsightsPage(request: LiveMetaRequest, adAccountMetaId: string, params: { level: "account" | "campaign" | "adset" | "ad"; since: string; until: string; breakdowns?: readonly string[]; attributionWindows?: readonly string[]; after?: string; limit?: number }): Promise<MetaCursorPage<LiveInsight>>;
  listInsights(request: LiveMetaRequest, adAccountMetaId: string, params: { level: "account" | "campaign" | "adset" | "ad"; since: string; until: string; breakdowns?: readonly string[]; attributionWindows?: readonly string[] }): Promise<LiveInsight[]>;
  listPagesPage(request: LiveMetaRequest, params?: MetaPageParams): Promise<MetaCursorPage<LiveAsset>>;
  listPages(request: LiveMetaRequest): Promise<LiveAsset[]>;
  listInstagramAccountsPage(request: LiveMetaRequest, businessMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveAsset>>;
  listInstagramAccounts(request: LiveMetaRequest, businessMetaId: string): Promise<LiveAsset[]>;
  listPixelsPage(request: LiveMetaRequest, adAccountMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveAsset>>;
  listPixels(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAsset[]>;
  listCustomAudiencesPage(request: LiveMetaRequest, adAccountMetaId: string, params?: MetaPageParams): Promise<MetaCursorPage<LiveAsset>>;
  listCustomAudiences(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAsset[]>;
  createCampaign(request: LiveMetaRequest, input: MetaCreateCampaignInput): Promise<MetaMutationResult>;
  createAdSet(request: LiveMetaRequest, input: MetaCreateAdSetInput): Promise<MetaMutationResult>;
  createAdCreative(request: LiveMetaRequest, input: MetaCreateAdCreativeInput): Promise<MetaMutationResult>;
  createAd(request: LiveMetaRequest, input: MetaCreateAdInput): Promise<MetaMutationResult>;
  updateObject(request: LiveMetaRequest, input: MetaUpdateObjectInput): Promise<MetaMutationResult>;
  duplicateObject(request: LiveMetaRequest, input: MetaDuplicateObjectInput): Promise<MetaMutationResult>;
}
