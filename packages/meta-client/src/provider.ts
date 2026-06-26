import { evaluateMetaWriteGate, type OrganizationRole, type WriteGateInput, type WriteGateResult } from "@adflow/shared";

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
  listAdAccounts(request: LiveMetaRequest): Promise<LiveAdAccount[]>;
  listCampaigns(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCampaign[]>;
  createCampaign(request: LiveMetaRequest, input: MetaCreateCampaignInput): Promise<MetaMutationResult>;
  createAdSet(request: LiveMetaRequest, input: MetaCreateAdSetInput): Promise<MetaMutationResult>;
  createAdCreative(request: LiveMetaRequest, input: MetaCreateAdCreativeInput): Promise<MetaMutationResult>;
  createAd(request: LiveMetaRequest, input: MetaCreateAdInput): Promise<MetaMutationResult>;
}
