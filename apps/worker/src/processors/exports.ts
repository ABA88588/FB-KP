import type { Job } from "bullmq";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { QUEUE_NAMES } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";
import { prisma } from "@adflow/db";

export function createExportsProcessor() {
  return async (job: Job<unknown, unknown, string>): Promise<{ exportId?: string; rows?: number }> => {
    const data = parseWorkerJobData(QUEUE_NAMES.exports, job.name, job.data);
    const payload = data.payload as { exportId?: string; reportId?: string; before?: string; expiresAt?: string };
    if (job.name === "expire-export") {
      const before = payload.before ? new Date(payload.before) : new Date();
      const result = await prisma.exportFile.deleteMany({ where: { organizationId: data.organizationId, expiresAt: { lt: before } } });
      return { rows: result.count };
    }
    if (!payload.exportId || !payload.reportId) throw new Error("exportId and reportId are required.");
    const report = await prisma.reportRun.findUniqueOrThrow({ where: { id: payload.reportId } });
    const rows = await prisma.insight.findMany({ where: { organizationId: data.organizationId, adAccountId: report.adAccountId }, orderBy: { dateStart: "asc" }, take: 50_000 });
    const csv = [
      "date_start,date_stop,level,entity_meta_id,currency,spend,impressions,clicks,reach",
      ...rows.map((row) => [row.dateStart.toISOString().slice(0, 10), row.dateStop.toISOString().slice(0, 10), row.level, row.entityMetaId, row.currency, row.spend?.toString() ?? "", row.impressions?.toString() ?? "", row.clicks?.toString() ?? "", row.reach?.toString() ?? ""].map(csvCell).join(","))
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
    return { exportId: payload.exportId, rows: rows.length };
  };
}

function csvCell(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
