import type { Job } from "bullmq";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";
import { prisma } from "@adflow/db";
import { safeCsvCell, safeErrorMessage } from "@adflow/shared";
import { writeAudit } from "./service-context.js";

export function createExportsProcessor() {
  return async (job: Job<unknown, unknown, string>): Promise<{ exportId?: string; rows?: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.exports, job.name, job.data);
    const payload = data.payload as { exportId?: string; reportId?: string; before?: string; expiresAt?: string };
    if (job.name === "expire-export") {
      const before = payload.before ? new Date(payload.before) : new Date();
      const result = await prisma.exportFile.deleteMany({ where: { organizationId: data.organizationId, expiresAt: { lt: before } } });
      await writeAudit({ organizationId: data.organizationId, actorUserId: data.actorUserId, action: "worker.expire-export", resourceType: "ExportFile", outcome: "SUCCESS", requestId: data.requestId, summaryJson: { rows: result.count, before: before.toISOString() } });
      return { rows: result.count };
    }
    if (!payload.exportId || !payload.reportId) throw new Error("exportId and reportId are required.");
    await job.updateProgress(10);
    try {
      const [report, exportFile] = await Promise.all([
        prisma.reportRun.findUniqueOrThrow({ where: { id: payload.reportId } }),
        prisma.exportFile.findUniqueOrThrow({ where: { id: payload.exportId } })
      ]);
      if (report.organizationId !== data.organizationId || exportFile.organizationId !== data.organizationId || exportFile.reportRunId !== report.id) {
        throw new Error("Export does not belong to the requested organization/report.");
      }
      const rows = await prisma.insight.findMany({ where: { organizationId: data.organizationId, adAccountId: report.adAccountId }, orderBy: { dateStart: "asc" }, take: 50_000 });
      await job.updateProgress(60);
      const csv = [
        ["date_start", "date_stop", "level", "entity_meta_id", "currency", "spend", "impressions", "clicks", "reach"].map(safeCsvCell).join(","),
        ...rows.map((row) => [row.dateStart.toISOString().slice(0, 10), row.dateStop.toISOString().slice(0, 10), row.level, row.entityMetaId, row.currency, row.spend?.toString() ?? "", row.impressions?.toString() ?? "", row.clicks?.toString() ?? "", row.reach?.toString() ?? ""].map(safeCsvCell).join(","))
      ].join("\n");
      const exportDir = process.env.EXPORT_STORAGE_DIR || "/tmp/adflow-exports";
      await mkdir(exportDir, { recursive: true });
      const objectKey = `${data.organizationId}/${payload.exportId}.csv`;
      const filePath = path.join(exportDir, `${payload.exportId}.csv`);
      await writeFile(filePath, csv, "utf8");
      await prisma.exportFile.update({
        where: { id: payload.exportId },
        data: {
          objectKey,
          fileName: `report-${payload.reportId}.csv`,
          contentType: "text/csv; charset=utf-8",
          sizeBytes: BigInt(Buffer.byteLength(csv)),
          checksum: createHash("sha256").update(csv).digest("hex"),
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      await job.updateProgress(100);
      await writeAudit({ organizationId: data.organizationId, actorUserId: data.actorUserId, action: "worker.build-csv", resourceType: "ExportFile", resourceId: payload.exportId, outcome: "SUCCESS", requestId: data.requestId, summaryJson: { rows: rows.length, objectKey } });
      return { exportId: payload.exportId, rows: rows.length };
    } catch (error) {
      await writeAudit({ organizationId: data.organizationId, actorUserId: data.actorUserId, action: "worker.build-csv", resourceType: "ExportFile", resourceId: payload.exportId, outcome: "FAILED", requestId: data.requestId, summaryJson: { message: safeErrorMessage(error) } });
      throw error;
    }
  };
}
