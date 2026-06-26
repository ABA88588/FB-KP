import { assertSupportedMetaGraphVersion, metaFieldRegistry, supportedMetaGraphVersions } from "../schemas/version-registry";
import { DEFAULT_META_MUTATION_STATUS } from "../provider";
import type {
  LiveAdAccount,
  LiveAd,
  LiveAdSet,
  LiveAsset,
  LiveCreative,
  LiveInsight,
  LiveCampaign,
  LiveMetaAdsProviderContract,
  LiveMetaRequest,
  MetaCreateAdCreativeInput,
  MetaCreateAdInput,
  MetaCreateAdSetInput,
  MetaCreateCampaignInput,
  MetaDuplicateObjectInput,
  MetaMutationResult,
  MetaProviderAvailability,
  MetaUpdateObjectInput
} from "../provider";
import { MetaHttpClient, type FetchLike } from "./http-client";
import { MetaProviderConfigurationError } from "./errors";
import { idResponseSchema, liveAdAccountSchema, liveAdSchema, liveAdSetSchema, liveAssetSchema, liveCampaignSchema, liveCreativeSchema, liveInsightSchema, liveMeSchema } from "./schemas";

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

  async getMe(request: LiveMetaRequest): Promise<{ id: string; name?: string }> {
    const client = this.#requireClient();
    const row = await client.get(this.#request(request), "/me", { fields: "id,name" }, liveMeSchema);
    const me: { id: string; name?: string } = { id: row.id };
    if (row.name !== undefined) me.name = row.name;
    return me;
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

  async listAdSets(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAdSet[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/adsets`, {
      fields: "id,campaign_id,name,configured_status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting,promoted_object,updated_time",
      limit: 50
    }, liveAdSetSchema);
    return rows.map((row) => {
      const adSet: LiveAdSet = {
        metaId: row.id,
        campaignMetaId: row.campaign_id,
        name: row.name,
        configuredStatus: row.configured_status ?? "UNKNOWN",
        effectiveStatus: row.effective_status ?? "UNKNOWN"
      };
      if (row.daily_budget !== undefined) adSet.dailyBudgetMinor = row.daily_budget;
      if (row.lifetime_budget !== undefined) adSet.lifetimeBudgetMinor = row.lifetime_budget;
      if (row.optimization_goal !== undefined) adSet.optimizationGoal = row.optimization_goal;
      if (row.billing_event !== undefined) adSet.billingEvent = row.billing_event;
      if (row.targeting !== undefined) adSet.targetingJson = row.targeting;
      if (row.promoted_object !== undefined) adSet.promotedObjectJson = row.promoted_object;
      if (row.updated_time !== undefined) adSet.updatedTime = row.updated_time;
      return adSet;
    });
  }

  async listAds(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAd[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/ads`, {
      fields: "id,campaign_id,adset_id,creative{id},name,configured_status,effective_status,updated_time",
      limit: 50
    }, liveAdSchema);
    return rows.map((row) => {
      const ad: LiveAd = {
        metaId: row.id,
        campaignMetaId: row.campaign_id,
        adSetMetaId: row.adset_id,
        name: row.name,
        configuredStatus: row.configured_status ?? "UNKNOWN",
        effectiveStatus: row.effective_status ?? "UNKNOWN"
      };
      if (row.creative?.id !== undefined) ad.creativeMetaId = row.creative.id;
      if (row.updated_time !== undefined) ad.updatedTime = row.updated_time;
      return ad;
    });
  }

  async listCreatives(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCreative[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/adcreatives`, {
      fields: "id,name,title,body,image_hash,image_url,thumbnail_url,status,object_story_spec,asset_feed_spec",
      limit: 50
    }, liveCreativeSchema);
    return rows.map((row) => {
      const creative: LiveCreative = { metaId: row.id, raw: row };
      if (row.name !== undefined) creative.name = row.name;
      if (row.title !== undefined) creative.title = row.title;
      if (row.body !== undefined) creative.body = row.body;
      if (row.image_hash !== undefined) creative.imageHash = row.image_hash;
      if (row.image_url !== undefined) creative.imageUrl = row.image_url;
      if (row.thumbnail_url !== undefined) creative.thumbnailUrl = row.thumbnail_url;
      if (row.status !== undefined) creative.status = row.status;
      return creative;
    });
  }

  async listInsights(request: LiveMetaRequest, adAccountMetaId: string, params: { level: "account" | "campaign" | "adset" | "ad"; since: string; until: string; breakdowns?: readonly string[]; attributionWindows?: readonly string[] }): Promise<LiveInsight[]> {
    const client = this.#requireClient();
    return client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/insights`, {
      fields: "account_id,campaign_id,adset_id,ad_id,date_start,date_stop,spend,impressions,reach,clicks,actions,action_values,ctr,cpc,cpm",
      level: params.level,
      time_range: JSON.stringify({ since: params.since, until: params.until }),
      breakdowns: params.breakdowns?.join(","),
      action_attribution_windows: params.attributionWindows?.join(","),
      limit: 50
    }, liveInsightSchema);
  }

  async listPages(request: LiveMetaRequest): Promise<LiveAsset[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), "/me/accounts", { fields: "id,name,category,tasks", limit: 50 }, liveAssetSchema);
    return rows.map(assetFromRow);
  }

  async listInstagramAccounts(request: LiveMetaRequest, businessMetaId: string): Promise<LiveAsset[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `/${businessMetaId}/instagram_accounts`, { fields: "id,username,name", limit: 50 }, liveAssetSchema);
    return rows.map(assetFromRow);
  }

  async listPixels(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAsset[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/adspixels`, { fields: "id,name,code", limit: 50 }, liveAssetSchema);
    return rows.map(assetFromRow);
  }

  async listCustomAudiences(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAsset[]> {
    const client = this.#requireClient();
    const rows = await client.getPaged(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/customaudiences`, { fields: "id,name,subtype,approximate_count,delivery_status,operation_status", limit: 50 }, liveAssetSchema);
    return rows.map(assetFromRow);
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

  async updateObject(request: LiveMetaRequest, input: MetaUpdateObjectInput): Promise<MetaMutationResult> {
    assertWriteGate(input.guard, input.operationId);
    const client = this.#requireClient();
    const body: Record<string, string | number | undefined> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.status !== undefined) body.status = input.status;
    if (input.dailyBudgetMinor !== undefined) body.daily_budget = input.dailyBudgetMinor;
    await client.post(this.#request(request), `/${input.objectMetaId}`, body, idResponseSchema.optional().default({ id: input.objectMetaId }));
    return { metaId: input.objectMetaId, operationId: input.operationId, status: "UPDATED" };
  }

  async duplicateObject(request: LiveMetaRequest, input: MetaDuplicateObjectInput): Promise<MetaMutationResult> {
    assertWriteGate(input.guard, input.operationId);
    const client = this.#requireClient();
    const response = await client.post(this.#request(request), `/${input.objectMetaId}/copies`, {
      status_option: "PAUSED"
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

function assetFromRow(row: { id: string; name?: string | undefined } & Record<string, unknown>): LiveAsset {
  const asset: LiveAsset = { metaId: row.id, raw: row };
  if (row.name !== undefined) asset.name = row.name;
  return asset;
}
