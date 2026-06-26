import { assertSupportedMetaGraphVersion, metaFieldRegistry, supportedMetaGraphVersions } from "../schemas/version-registry";
import { DEFAULT_META_MUTATION_STATUS } from "../provider";
import type {
  LiveAdAccount,
  LiveCampaign,
  LiveMetaAdsProviderContract,
  LiveMetaRequest,
  MetaCreateAdCreativeInput,
  MetaCreateAdInput,
  MetaCreateAdSetInput,
  MetaCreateCampaignInput,
  MetaMutationResult,
  MetaProviderAvailability
} from "../provider";
import { MetaHttpClient, type FetchLike } from "./http-client";
import { MetaProviderConfigurationError } from "./errors";
import { idResponseSchema, liveAdAccountSchema, liveCampaignSchema } from "./schemas";

export type LiveMetaAdsProviderConfig = {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  graphApiVersion: string;
  graphBaseUrl?: string;
  fetchImpl?: FetchLike;
};

export type LiveMetaAdsProviderEnv = {
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_ACCESS_TOKEN?: string;
  META_TOKEN?: string;
  META_GRAPH_API_VERSION?: string;
};

export class LiveMetaAdsProvider implements LiveMetaAdsProviderContract {
  readonly mode = "live" as const;
  readonly #defaultAccessToken: string | undefined;
  readonly #availability: MetaProviderAvailability;
  readonly #client: MetaHttpClient | undefined;

  constructor(config: LiveMetaAdsProviderConfig) {
    const graphApiVersion = assertSupportedMetaGraphVersion(config.graphApiVersion);
    this.#defaultAccessToken = readConfiguredString(config.accessToken);
    this.#availability = buildAvailability(config, graphApiVersion);
    if (this.#availability.configured) {
      const clientConfig: LiveMetaAdsProviderConfig & { appSecret: string; graphApiVersion: string } = {
        appSecret: config.appSecret ?? "",
        graphApiVersion
      };
      if (config.graphBaseUrl !== undefined) clientConfig.graphBaseUrl = config.graphBaseUrl;
      if (config.fetchImpl !== undefined) clientConfig.fetchImpl = config.fetchImpl;
      this.#client = new MetaHttpClient(clientConfig);
    }
  }

  getAvailability(): MetaProviderAvailability {
    if (this.#availability.configured) return this.#availability;
    return {
      ...this.#availability,
      missing: [...this.#availability.missing]
    };
  }

  async listAdAccounts(request: LiveMetaRequest): Promise<LiveAdAccount[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), "/me/adaccounts", {
      fields: metaFieldRegistry.adAccount,
      limit: 50
    }, liveAdAccountSchema);
    return rows.map((row) => {
      const account: LiveAdAccount = {
        metaId: row.id,
        accountId: row.account_id ?? row.id.replace(/^act_/, ""),
        name: row.name ?? row.id,
        currency: row.currency ?? "USD",
        timezoneName: row.timezone_name ?? "UTC",
        status: String(row.account_status ?? "UNKNOWN"),
        isReadOnly: row.account_status !== undefined && String(row.account_status) !== "1"
      };
      if (row.disable_reason !== undefined) account.disableReason = String(row.disable_reason);
      return account;
    });
  }

  async listCampaigns(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCampaign[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/campaigns`, {
      fields: metaFieldRegistry.campaign,
      limit: 50
    }, liveCampaignSchema);
    return rows.map((row) => {
      const campaign: LiveCampaign = {
        metaId: row.id,
        name: row.name,
        configuredStatus: row.configured_status ?? "UNKNOWN",
        effectiveStatus: row.effective_status ?? "UNKNOWN"
      };
      if (row.objective !== undefined) campaign.objective = row.objective;
      if (row.daily_budget !== undefined) campaign.dailyBudgetMinor = row.daily_budget;
      if (row.updated_time !== undefined) campaign.updatedTime = row.updated_time;
      return campaign;
    });
  }

  async createCampaign(request: LiveMetaRequest, input: MetaCreateCampaignInput): Promise<MetaMutationResult> {
    assertWriteGate(input.guard, input.operationId);
    const client = this.#requireClient();
    const response = await client.post(this.#request(request), `${normalizeAdAccountPath(input.adAccountMetaId)}/campaigns`, {
      name: input.name,
      objective: input.objective,
      buying_type: input.buyingType ?? "AUCTION",
      status: DEFAULT_META_MUTATION_STATUS,
      special_ad_categories: JSON.stringify(input.specialAdCategories ?? []),
      daily_budget: input.dailyBudgetMinor
    }, idResponseSchema);
    return { metaId: response.id, operationId: input.operationId, status: DEFAULT_META_MUTATION_STATUS };
  }

  async createAdSet(request: LiveMetaRequest, input: MetaCreateAdSetInput): Promise<MetaMutationResult> {
    assertWriteGate(input.guard, input.operationId);
    const client = this.#requireClient();
    const response = await client.post(this.#request(request), `${normalizeAdAccountPath(input.adAccountMetaId)}/adsets`, {
      campaign_id: input.campaignMetaId,
      name: input.name,
      status: DEFAULT_META_MUTATION_STATUS,
      daily_budget: input.dailyBudgetMinor,
      optimization_goal: input.optimizationGoal,
      billing_event: input.billingEvent,
      targeting: input.targetingJson,
      promoted_object: input.promotedObjectJson
    }, idResponseSchema);
    return { metaId: response.id, operationId: input.operationId, status: DEFAULT_META_MUTATION_STATUS };
  }

  async createAdCreative(request: LiveMetaRequest, input: MetaCreateAdCreativeInput): Promise<MetaMutationResult> {
    assertWriteGate(input.guard, input.operationId);
    const client = this.#requireClient();
    const response = await client.post(this.#request(request), `${normalizeAdAccountPath(input.adAccountMetaId)}/adcreatives`, {
      name: input.name,
      object_story_spec: input.objectStorySpecJson,
      asset_feed_spec: input.assetFeedSpecJson
    }, idResponseSchema);
    return { metaId: response.id, operationId: input.operationId, status: DEFAULT_META_MUTATION_STATUS };
  }

  async createAd(request: LiveMetaRequest, input: MetaCreateAdInput): Promise<MetaMutationResult> {
    assertWriteGate(input.guard, input.operationId);
    const client = this.#requireClient();
    const response = await client.post(this.#request(request), `${normalizeAdAccountPath(input.adAccountMetaId)}/ads`, {
      name: input.name,
      adset_id: input.adSetMetaId,
      creative: JSON.stringify({ creative_id: input.creativeMetaId }),
      status: DEFAULT_META_MUTATION_STATUS
    }, idResponseSchema);
    return { metaId: response.id, operationId: input.operationId, status: DEFAULT_META_MUTATION_STATUS };
  }

  #requireClient(): MetaHttpClient {
    if (!this.#availability.configured || this.#client === undefined) {
      const missing = this.#availability.configured ? [] : this.#availability.missing;
      throw new MetaProviderConfigurationError(missing);
    }
    return this.#client;
  }

  #request(request: LiveMetaRequest): LiveMetaRequest & { accessToken: string } {
    const accessToken = readConfiguredString(request.accessToken) ?? this.#defaultAccessToken;
    if (accessToken === undefined) throw new MetaProviderConfigurationError(["META_ACCESS_TOKEN"]);
    return { ...request, accessToken };
  }
}

export function createLiveMetaAdsProviderFromEnv(env: LiveMetaAdsProviderEnv, options: { graphBaseUrl?: string; fetchImpl?: FetchLike } = {}): LiveMetaAdsProvider {
  const config: LiveMetaAdsProviderConfig = {
    graphApiVersion: readConfiguredString(env.META_GRAPH_API_VERSION) ?? supportedMetaGraphVersions[0]
  };
  const appId = readConfiguredString(env.META_APP_ID);
  const appSecret = readConfiguredString(env.META_APP_SECRET);
  const accessToken = readConfiguredString(env.META_ACCESS_TOKEN) ?? readConfiguredString(env.META_TOKEN);
  if (appId !== undefined) config.appId = appId;
  if (appSecret !== undefined) config.appSecret = appSecret;
  if (accessToken !== undefined) config.accessToken = accessToken;
  if (options.graphBaseUrl !== undefined) config.graphBaseUrl = options.graphBaseUrl;
  if (options.fetchImpl !== undefined) config.fetchImpl = options.fetchImpl;
  return new LiveMetaAdsProvider(config);
}

function normalizeAdAccountPath(adAccountMetaId: string): string {
  return adAccountMetaId.startsWith("/act_") ? adAccountMetaId : `/${adAccountMetaId.startsWith("act_") ? adAccountMetaId : `act_${adAccountMetaId}`}`;
}

function assertWriteGate(guard: MetaCreateCampaignInput["guard"], operationId: string): void {
  if (!guard.allowed) {
    throw new Error(`Meta write denied for ${operationId}: ${guard.reasons.join(", ")}`);
  }
  if (guard.operationId !== operationId) {
    throw new Error("Meta write denied: operationId mismatch");
  }
}

function buildAvailability(config: LiveMetaAdsProviderConfig, graphApiVersion: string): MetaProviderAvailability {
  const missing: string[] = [];
  if (readConfiguredString(config.appId) === undefined) missing.push("META_APP_ID");
  if (readConfiguredString(config.appSecret) === undefined) missing.push("META_APP_SECRET");
  if (readConfiguredString(config.accessToken) === undefined) missing.push("META_ACCESS_TOKEN");
  if (missing.length > 0) {
    return {
      mode: "live",
      configured: false,
      disabled: true,
      status: "unconfigured",
      graphApiVersion,
      missing,
      reason: "MISSING_CREDENTIALS",
      message: `Live Meta provider disabled: missing ${missing.join(", ")}`
    };
  }
  return {
    mode: "live",
    configured: true,
    disabled: false,
    status: "configured",
    graphApiVersion
  };
}

function readConfiguredString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
