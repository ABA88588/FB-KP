import { createHmac } from "node:crypto";
import { z } from "zod";
import { createRequestId, redactSensitiveText } from "@adflow/shared";
import { MetaApiError, normalizeMetaError } from "./errors";
import { pagedResponseSchema } from "./schemas";
import { parseMetaCursorPage, type ParsedMetaCursorPage } from "./cursor";

export type MetaHttpParam = string | number | boolean | readonly string[] | undefined;
export type MetaHttpParams = Record<string, MetaHttpParam>;
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type MetaHttpPage<T> = {
  data: T[];
  cursor: ParsedMetaCursorPage;
};

export type MetaHttpClientConfig = {
  appSecret: string;
  graphApiVersion: string;
  graphBaseUrl?: string;
  fetchImpl?: FetchLike;
};

export type MetaHttpRequest = {
  accessToken: string;
  requestId?: string;
};

export class MetaHttpClient {
  readonly #appSecret: string;
  readonly #graphApiVersion: string;
  readonly #graphBaseUrl: string;
  readonly #fetchImpl: FetchLike;

  constructor(config: MetaHttpClientConfig) {
    this.#appSecret = config.appSecret;
    this.#graphApiVersion = config.graphApiVersion;
    this.#graphBaseUrl = config.graphBaseUrl ?? "https://graph.facebook.com";
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  async get<T>(request: MetaHttpRequest, path: string, params: MetaHttpParams, schema: z.ZodType<T>): Promise<T> {
    return this.#request(request, "GET", path, params, undefined, schema);
  }

  async post<T>(request: MetaHttpRequest, path: string, body: MetaHttpParams, schema: z.ZodType<T>): Promise<T> {
    return this.#request(request, "POST", path, {}, body, schema);
  }

  async getPage<T>(request: MetaHttpRequest, path: string, params: MetaHttpParams, itemSchema: z.ZodType<T>): Promise<MetaHttpPage<T>> {
    const response = await this.get(request, path, { ...params, limit: params.limit ?? 50 }, pagedResponseSchema(itemSchema));
    return {
      data: response.data,
      cursor: parseMetaCursorPage(response.paging)
    };
  }

  async getPaged<T>(request: MetaHttpRequest, path: string, params: MetaHttpParams, itemSchema: z.ZodType<T>, maxPages = 50): Promise<T[]> {
    const rows: T[] = [];
    let after: string | undefined;
    for (let page = 0; page < maxPages; page += 1) {
      const response = await this.getPage(request, path, { ...params, after }, itemSchema);
      rows.push(...response.data);
      after = response.cursor.nextAfter ?? response.cursor.after;
      if (!after || !response.cursor.hasNextPage) break;
    }
    return rows;
  }

  appSecretProof(accessToken: string): string {
    return createHmac("sha256", this.#appSecret).update(accessToken).digest("hex");
  }

  async #request<T>(
    request: MetaHttpRequest,
    method: "GET" | "POST",
    path: string,
    params: MetaHttpParams,
    body: MetaHttpParams | undefined,
    schema: z.ZodType<T>
  ): Promise<T> {
    const requestId = request.requestId ?? createRequestId("meta");
    const url = this.#url(path, {
      ...params,
      access_token: request.accessToken,
      appsecret_proof: this.appSecretProof(request.accessToken)
    });
    const init: RequestInit = {
      method,
      headers: {
        "x-adflow-request-id": requestId
      }
    };
    if (body) {
      init.headers = {
        ...init.headers,
        "content-type": "application/x-www-form-urlencoded"
      };
      init.body = this.#encodedBody(body);
    }

    const response = await this.#fetchImpl(url, init);
    const payload = await readJson(response);
    if (!response.ok) {
      throw new MetaApiError(response.status, requestId, normalizeMetaError(payload, response.status));
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(redactSensitiveText(`Meta API response validation failed for ${path}: ${parsed.error.message}`));
    }
    return parsed.data;
  }

  #url(path: string, params: MetaHttpParams): URL {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.#graphBaseUrl}/${this.#graphApiVersion}${normalizedPath}`);
    appendParams(url.searchParams, params);
    return url;
  }

  #encodedBody(body: MetaHttpParams): URLSearchParams {
    const params = new URLSearchParams();
    appendParams(params, body);
    return params;
  }
}

function appendParams(params: URLSearchParams, values: MetaHttpParams): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { message: text } };
  }
}
