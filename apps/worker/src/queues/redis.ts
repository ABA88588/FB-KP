import { Redis } from "ioredis";

import type { RedisConfig } from "../config.js";

export function createRedisConnection(redis: RedisConfig): Redis {
  if (redis.url === null) {
    throw new Error("Cannot create Redis connection without REDIS_URL.");
  }

  return new Redis(redis.url, {
    connectTimeout: redis.connectTimeoutMs,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      return Math.min(times * 250, 5_000);
    }
  });
}
