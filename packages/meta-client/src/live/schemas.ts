import { z } from "zod";

export const pagingSchema = z.object({
  cursors: z.object({
    before: z.string().optional(),
    after: z.string().optional()
  }).optional(),
  next: z.string().optional()
}).optional();

export function pagedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    paging: pagingSchema
  }).passthrough();
}

export const liveAdAccountSchema = z.object({
  id: z.string(),
  account_id: z.string().optional(),
  name: z.string().optional(),
  currency: z.string().optional(),
  timezone_name: z.string().optional(),
  account_status: z.union([z.string(), z.number()]).optional(),
  disable_reason: z.union([z.string(), z.number()]).optional()
}).passthrough();

export const liveCampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string().optional(),
  configured_status: z.string().optional(),
  effective_status: z.string().optional(),
  daily_budget: z.string().optional(),
  updated_time: z.string().optional()
}).passthrough();

export const liveAdSetSchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  name: z.string(),
  configured_status: z.string().optional(),
  effective_status: z.string().optional(),
  daily_budget: z.string().optional(),
  lifetime_budget: z.string().optional(),
  optimization_goal: z.string().optional(),
  billing_event: z.string().optional(),
  targeting: z.unknown().optional(),
  promoted_object: z.unknown().optional(),
  updated_time: z.string().optional()
}).passthrough();

export const liveAdSchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  adset_id: z.string(),
  creative: z.object({ id: z.string().optional() }).passthrough().optional(),
  name: z.string(),
  configured_status: z.string().optional(),
  effective_status: z.string().optional(),
  updated_time: z.string().optional()
}).passthrough();

export const liveCreativeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  image_hash: z.string().optional(),
  image_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  status: z.string().optional()
}).passthrough();

export const liveInsightSchema = z.record(z.string(), z.unknown());

export const liveAssetSchema = z.object({
  id: z.string(),
  name: z.string().optional()
}).passthrough();

export const liveMeSchema = z.object({
  id: z.string(),
  name: z.string().optional()
}).passthrough();

export const idResponseSchema = z.object({
  id: z.string()
}).passthrough();
