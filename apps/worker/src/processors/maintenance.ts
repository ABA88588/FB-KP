import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";
import { prisma } from "@adflow/db";
import { safeErrorMessage } from "@adflow/shared";
import { createProvider, getAccessToken, writeAudit } from "./service-context.js";

export function createMaintenanceProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<{ changed: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.maintenance, job.name, job.data);
    const payload = data.payload as { before?: string; connectionIds?: string[]; statuses?: string[] };
    if (job.name === "cleanup-jobs") {
      const result = await prisma.syncJob.deleteMany({
        where: {
          organizationId: data.organizationId,
          createdAt: { lt: new Date(payload.before ?? Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: { in: (payload.statuses as Array<"SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN_OUTCOME"> | undefined) ?? ["SUCCEEDED", "FAILED", "CANCELLED"] }
        }
      });
      return { changed: result.count };
    }
    if (job.name === "validate-tokens") {
      const connections = await prisma.metaConnection.findMany({
        where: {
          organizationId: data.organizationId,
          ...(payload.connectionIds ? { id: { in: payload.connectionIds } } : {})
        }
      });
      let changed = 0;
      const provider = createProvider();
      for (const connection of connections) {
        try {
          const accessToken = await getAccessToken(connection.id);
          await provider.getMe({ accessToken, requestId: data.requestId });
          await prisma.metaConnection.update({ where: { id: connection.id }, data: { status: "HEALTHY", lastValidatedAt: new Date(), lastErrorCode: null, lastErrorSummary: null } });
        } catch (error) {
          context.logger.warn("token validation failed", { connectionId: connection.id, error: safeErrorMessage(error) });
          await prisma.metaConnection.update({ where: { id: connection.id }, data: { status: "ERROR", lastValidatedAt: new Date(), lastErrorSummary: error instanceof Error ? error.message : "Unknown error" } });
        }
        changed += 1;
      }
      await writeAudit({ organizationId: data.organizationId, actorUserId: data.actorUserId, action: "worker.validate-tokens", resourceType: "MetaConnection", outcome: "SUCCESS", requestId: data.requestId, summaryJson: { changed } });
      return { changed };
    }
    return { changed: 0 };
  };
}
