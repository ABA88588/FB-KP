export const supportedMetaGraphVersions = ["v25.0"] as const;

export type SupportedMetaGraphVersion = (typeof supportedMetaGraphVersions)[number];

export const metaFieldRegistry = {
  adAccount: ["id", "account_id", "name", "currency", "timezone_name", "account_status", "disable_reason"] as const,
  campaign: ["id", "name", "objective", "configured_status", "effective_status", "daily_budget", "updated_time"] as const,
  insight: ["date_start", "date_stop", "spend", "impressions", "clicks", "actions", "action_values", "purchase_roas"] as const,
  breakdownCompatibility: {
    breakdowns: ["age", "gender", "country", "region", "publisher_platform", "platform_position", "device_platform", "impression_device", "product_id"] as const,
    actionBreakdowns: ["action_type", "action_device", "conversion_destination"] as const
  }
};

export type MetaBreakdown = (typeof metaFieldRegistry.breakdownCompatibility.breakdowns)[number];
export type MetaActionBreakdown = (typeof metaFieldRegistry.breakdownCompatibility.actionBreakdowns)[number];

export type BreakdownCompatibilityInput = {
  breakdowns?: readonly string[];
  actionBreakdowns?: readonly string[];
};

export type BreakdownCompatibilityResult = {
  compatible: boolean;
  breakdowns: readonly MetaBreakdown[];
  actionBreakdowns: readonly MetaActionBreakdown[];
  reasons: readonly string[];
};

const supportedBreakdownCombinations = new Set([
  "",
  "age",
  "country",
  "device_platform",
  "gender",
  "impression_device",
  "product_id",
  "publisher_platform",
  "region",
  "age|gender",
  "age|gender|country",
  "country|region",
  "device_platform|publisher_platform",
  "impression_device|publisher_platform",
  "platform_position|publisher_platform"
]);

const supportedActionBreakdownCombinations = new Set([
  "",
  "action_device",
  "action_type",
  "conversion_destination",
  "action_device|action_type",
  "action_type|conversion_destination"
]);

export function assertSupportedMetaGraphVersion(version: string): SupportedMetaGraphVersion {
  if (supportedMetaGraphVersions.includes(version as SupportedMetaGraphVersion)) {
    return version as SupportedMetaGraphVersion;
  }
  throw new Error(`Unsupported Meta Graph API version: ${version}`);
}

export function evaluateBreakdownCompatibility(input: BreakdownCompatibilityInput): BreakdownCompatibilityResult {
  const reasons: string[] = [];
  const breakdowns = normalizeList(input.breakdowns, isMetaBreakdown, "BREAKDOWN", reasons);
  const actionBreakdowns = normalizeList(input.actionBreakdowns, isMetaActionBreakdown, "ACTION_BREAKDOWN", reasons);
  const breakdownKey = toCompatibilityKey(breakdowns);
  const actionKey = toCompatibilityKey(actionBreakdowns);

  if (hasDuplicates(input.breakdowns)) reasons.push("DUPLICATE_BREAKDOWN");
  if (hasDuplicates(input.actionBreakdowns)) reasons.push("DUPLICATE_ACTION_BREAKDOWN");
  if (!supportedBreakdownCombinations.has(breakdownKey)) reasons.push(`UNSUPPORTED_BREAKDOWN_COMBINATION:${breakdownKey || "<none>"}`);
  if (!supportedActionBreakdownCombinations.has(actionKey)) reasons.push(`UNSUPPORTED_ACTION_BREAKDOWN_COMBINATION:${actionKey || "<none>"}`);
  if (breakdowns.includes("platform_position") && !breakdowns.includes("publisher_platform")) reasons.push("PLATFORM_POSITION_REQUIRES_PUBLISHER_PLATFORM");
  if (breakdowns.includes("product_id") && breakdowns.length > 1) reasons.push("PRODUCT_ID_CANNOT_BE_COMBINED_WITH_OTHER_BREAKDOWNS");

  return {
    compatible: reasons.length === 0,
    breakdowns,
    actionBreakdowns,
    reasons
  };
}

export function isSupportedBreakdownCombination(breakdowns: readonly string[], actionBreakdowns: readonly string[] = []): boolean {
  return evaluateBreakdownCompatibility({ breakdowns, actionBreakdowns }).compatible;
}

export function isMetaBreakdown(value: string): value is MetaBreakdown {
  return (metaFieldRegistry.breakdownCompatibility.breakdowns as readonly string[]).includes(value);
}

export function isMetaActionBreakdown(value: string): value is MetaActionBreakdown {
  return (metaFieldRegistry.breakdownCompatibility.actionBreakdowns as readonly string[]).includes(value);
}

function normalizeList<T extends string>(
  input: readonly string[] | undefined,
  guard: (value: string) => value is T,
  label: string,
  reasons: string[]
): T[] {
  const values: T[] = [];
  for (const value of input ?? []) {
    if (guard(value)) values.push(value);
    else reasons.push(`UNKNOWN_${label}:${value}`);
  }
  return values;
}

function hasDuplicates(input: readonly string[] | undefined): boolean {
  if (input === undefined) return false;
  return new Set(input).size !== input.length;
}

function toCompatibilityKey(values: readonly string[]): string {
  return [...values].sort().join("|");
}
