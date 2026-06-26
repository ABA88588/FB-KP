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

export const idResponseSchema = z.object({
  id: z.string()
}).passthrough();
