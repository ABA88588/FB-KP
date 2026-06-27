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
  MetaCursorPage,
  MetaDuplicateObjectInput,
  MetaMutationResult,
  MetaPageParams,
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
    return collectPages((after) => this.listAdAccountsPage(request, cursorParams(after)));
  }

  async listAdAccountsPage(request: LiveMetaRequest, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAdAccount>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), "/me/adaccounts", {
      fields: metaFieldRegistry.adAccount,
      ...pageParams(params)
    }, liveAdAccountSchema);
    return {
      data: page.data.map((row) => {
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
      }),
      cursor: page.cursor
    };
  }

  async listCampaigns(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCampaign[]> {
    return collectPages((after) => this.listCampaignsPage(request, adAccountMetaId, cursorParams(after)));
  }

  async listCampaignsPage(request: LiveMetaRequest, adAccountMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveCampaign>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/campaigns`, {
      fields: metaFieldRegistry.campaign,
      ...pageParams(params),
      filtering: updatedSinceFiltering(params.updatedSince)
    }, liveCampaignSchema);
    return {
      data: page.data.map((row) => {
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
      }),
      cursor: page.cursor
    };
  }

  async listAdSets(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAdSet[]> {
    return collectPages((after) => this.listAdSetsPage(request, adAccountMetaId, cursorParams(after)));
  }

  async listAdSetsPage(request: LiveMetaRequest, adAccountMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAdSet>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/adsets`, {
      fields: "id,campaign_id,name,configured_status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting,promoted_object,updated_time",
      ...pageParams(params),
      filtering: updatedSinceFiltering(params.updatedSince)
    }, liveAdSetSchema);
    return {
      data: page.data.map((row) => {
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
      }),
      cursor: page.cursor
    };
  }

  async listAds(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAd[]> {
    return collectPages((after) => this.listAdsPage(request, adAccountMetaId, cursorParams(after)));
  }

  async listAdsPage(request: LiveMetaRequest, adAccountMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAd>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/ads`, {
      fields: "id,campaign_id,adset_id,creative{id},name,configured_status,effective_status,updated_time",
      ...pageParams(params),
      filtering: updatedSinceFiltering(params.updatedSince)
    }, liveAdSchema);
    return {
      data: page.data.map((row) => {
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
      }),
      cursor: page.cursor
    };
  }

  async listCreatives(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveCreative[]> {
    return collectPages((after) => this.listCreativesPage(request, adAccountMetaId, cursorParams(after)));
  }

  async listCreativesPage(request: LiveMetaRequest, adAccountMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveCreative>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/adcreatives`, {
      fields: "id,name,title,body,image_hash,image_url,thumbnail_url,status,object_story_spec,asset_feed_spec",
      ...pageParams(params)
    }, liveCreativeSchema);
    return {
      data: page.data.map((row) => {
        const creative: LiveCreative = { metaId: row.id, raw: row };
        if (row.name !== undefined) creative.name = row.name;
        if (row.title !== undefined) creative.title = row.title;
        if (row.body !== undefined) creative.body = row.body;
        if (row.image_hash !== undefined) creative.imageHash = row.image_hash;
        if (row.image_url !== undefined) creative.imageUrl = row.image_url;
        if (row.thumbnail_url !== undefined) creative.thumbnailUrl = row.thumbnail_url;
        if (row.status !== undefined) creative.status = row.status;
        return creative;
      }),
      cursor: page.cursor
    };
  }

  async listInsights(request: LiveMetaRequest, adAccountMetaId: string, params: { level: "account" | "campaign" | "adset" | "ad"; since: string; until: string; breakdowns?: readonly string[]; attributionWindows?: readonly string[] }): Promise<LiveInsight[]> {
    return collectPages((after) => this.listInsightsPage(request, adAccountMetaId, { ...params, ...cursorParams(after) }));
  }

  async listInsightsPage(request: LiveMetaRequest, adAccountMetaId: string, params: { level: "account" | "campaign" | "adset" | "ad"; since: string; until: string; breakdowns?: readonly string[]; attributionWindows?: readonly string[]; after?: string; limit?: number }): Promise<MetaCursorPage<LiveInsight>> {
    const client = this.#requireClient();
    return client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/insights`, {
      fields: "account_id,campaign_id,adset_id,ad_id,date_start,date_stop,spend,impressions,reach,clicks,actions,action_values,ctr,cpc,cpm",
      level: params.level,
      time_range: JSON.stringify({ since: params.since, until: params.until }),
      breakdowns: params.breakdowns?.join(","),
      action_attribution_windows: params.attributionWindows?.join(","),
      after: params.after,
      limit: params.limit ?? 50
    }, liveInsightSchema);
  }

  async listPages(request: LiveMetaRequest): Promise<LiveAsset[]> {
    return collectPages((after) => this.listPagesPage(request, cursorParams(after)));
  }

  async listPagesPage(request: LiveMetaRequest, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAsset>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), "/me/accounts", { fields: "id,name,category,tasks", ...pageParams(params) }, liveAssetSchema);
    return { data: page.data.map(assetFromRow), cursor: page.cursor };
  }

  async listInstagramAccounts(request: LiveMetaRequest, businessMetaId: string): Promise<LiveAsset[]> {
    return collectPages((after) => this.listInstagramAccountsPage(request, businessMetaId, cursorParams(after)));
  }

  async listInstagramAccountsPage(request: LiveMetaRequest, businessMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAsset>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `/${businessMetaId}/instagram_accounts`, { fields: "id,username,name", ...pageParams(params) }, liveAssetSchema);
    return { data: page.data.map(assetFromRow), cursor: page.cursor };
  }

  async listPixels(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAsset[]> {
    return collectPages((after) => this.listPixelsPage(request, adAccountMetaId, cursorParams(after)));
  }

  async listPixelsPage(request: LiveMetaRequest, adAccountMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAsset>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/adspixels`, { fields: "id,name,code", ...pageParams(params) }, liveAssetSchema);
    return { data: page.data.map(assetFromRow), cursor: page.cursor };
  }

  async listCustomAudiences(request: LiveMetaRequest, adAccountMetaId: string): Promise<LiveAsset[]> {
    return collectPages((after) => this.listCustomAudiencesPage(request, adAccountMetaId, cursorParams(after)));
  }

  async listCustomAudiencesPage(request: LiveMetaRequest, adAccountMetaId: string, params: MetaPageParams = {}): Promise<MetaCursorPage<LiveAsset>> {
    const client = this.#requireClient();
    const page = await client.getPage(this.#request(request), `${normalizeAdAccountPath(adAccountMetaId)}/customaudiences`, { fields: "id,name,subtype,approximate_count,delivery_status,operation_status", ...pageParams(params) }, liveAssetSchema);
    return { data: page.data.map(assetFromRow), cursor: page.cursor };
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

async function collectPages<T>(loadPage: (after?: string) => Promise<MetaCursorPage<T>>, maxPages = 50): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const page = await loadPage(after);
    rows.push(...page.data);
    after = page.cursor.nextAfter ?? page.cursor.after;
    if (!after || !page.cursor.hasNextPage) break;
  }
  return rows;
}

function pageParams(params: MetaPageParams): { after?: string; limit: number } {
  return {
    ...(params.after !== undefined ? { after: params.after } : {}),
    limit: params.limit ?? 50
  };
}

function cursorParams(after: string | undefined): MetaPageParams {
  return after === undefined ? {} : { after };
}

function updatedSinceFiltering(updatedSince: string | undefined): string | undefined {
  if (updatedSince === undefined) return undefined;
  const date = new Date(updatedSince);
  if (Number.isNaN(date.getTime())) return undefined;
  return JSON.stringify([{ field: "updated_time", operator: "GREATER_THAN", value: Math.floor(date.getTime() / 1000) }]);
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
