import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adflow/db";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { enqueueWorkerJob } from "@/lib/queue";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ adAccountId: string }> }) {
  const requestId = createRequestId("sync");
  try {
    const token = resolveSessionToken(request);
    if (!token) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", requestId }, { status: 401 });
    const session = await databaseAuthRepository.getSessionByToken(token);
    if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", requestId }, { status: 401 });
    const { adAccountId } = await params;
    const membership = await prisma.membership.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
    if (!membership) return NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED", requestId }, { status: 403 });
    const adAccount = await prisma.adAccount.findFirst({
      where: {
        organizationId: membership.organizationId,
        OR: [{ id: adAccountId }, { metaId: adAccountId }]
      }
    });
    if (!adAccount) return NextResponse.json({ ok: false, error: "AD_ACCOUNT_NOT_FOUND", requestId }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { type?: string };
    const type = body.type ?? "sync-entities";
    const queueName = "meta-sync";
    const idempotencyKey = `${type}:${adAccount.id}:${Date.now()}`;
    const payload =
      type === "sync-insights"
        ? { level: "ACCOUNT", dateRange: { since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), until: new Date().toISOString().slice(0, 10) }, breakdowns: [], attributionWindows: [] }
        : type === "sync-account-assets"
          ? { forceFullSync: true }
          : { entityTypes: ["campaign", "adset", "creative", "ad"] };
    const jobData = {
      jobVersion: 1,
      organizationId: membership.organizationId,
      actorUserId: session.user.id,
      connectionId: adAccount.connectionId,
      adAccountId: adAccount.id,
      requestId,
      idempotencyKey,
      payload
    };
    const syncJob = await prisma.syncJob.create({
      data: {
        queueName,
        type,
        status: "QUEUED",
        progress: 0,
        requestId,
        idempotencyKey,
        payloadJson: payload,
        organizationId: membership.organizationId,
        connectionId: adAccount.connectionId,
        adAccountId: adAccount.id
      }
    });
    await enqueueWorkerJob(queueName, type, jobData, idempotencyKey);
    return NextResponse.json({ ok: true, data: { id: syncJob.id, requestId, status: "QUEUED" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), requestId }, { status: 500 });
  }
}
