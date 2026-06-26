import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adflow/db";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { enqueueWorkerJob } from "@/lib/queue";
import { toNullablePrismaJson, toPrismaJson } from "@/lib/prisma-json";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTypes = new Set(["create-bundle", "create-campaign", "create-adset", "create-creative", "create-ad", "pause", "enable", "update-budget", "duplicate"]);

export async function POST(request: NextRequest) {
  const requestId = createRequestId("op");
  try {
    const token = resolveSessionToken(request);
    if (!token) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", requestId }, { status: 401 });
    const session = await databaseAuthRepository.getSessionByToken(token);
    if (!session) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", requestId }, { status: 401 });
    const body = (await request.json()) as { adAccountId?: string; type?: string; payload?: Record<string, unknown>; confirmed?: boolean };
    if (!body.confirmed) return NextResponse.json({ ok: false, error: "SECOND_CONFIRMATION_REQUIRED", requestId }, { status: 400 });
    if (!body.type || !allowedTypes.has(body.type)) return NextResponse.json({ ok: false, error: "UNSUPPORTED_OPERATION", requestId }, { status: 400 });
    if (!body.adAccountId) return NextResponse.json({ ok: false, error: "AD_ACCOUNT_REQUIRED", requestId }, { status: 400 });

    const membership = await prisma.membership.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
    if (!membership) return NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED", requestId }, { status: 403 });
    const adAccount = await prisma.adAccount.findFirst({
      where: {
        organizationId: membership.organizationId,
        OR: [{ id: body.adAccountId }, { metaId: body.adAccountId }]
      }
    });
    if (!adAccount) return NextResponse.json({ ok: false, error: "AD_ACCOUNT_NOT_FOUND", requestId }, { status: 404 });

    const operationPayload = body.payload ?? {};
    const payloadHash = createHash("sha256").update(JSON.stringify(operationPayload)).digest("hex");
    const idempotencyKey = `${body.type}:${adAccount.id}:${payloadHash}:${Date.now()}`;
    const operation = await prisma.operation.create({
      data: {
        type: body.type,
        status: "PENDING",
        requestId,
        idempotencyKey,
        payloadHash,
        payloadJson: toPrismaJson(operationPayload),
        organizationId: membership.organizationId,
        connectionId: adAccount.connectionId,
        adAccountId: adAccount.id,
        actorUserId: session.user.id
      }
    });
    await enqueueWorkerJob(
      "meta-mutations",
      "apply-single",
      {
        jobVersion: 1,
        organizationId: membership.organizationId,
        actorUserId: session.user.id,
        connectionId: adAccount.connectionId,
        adAccountId: adAccount.id,
        requestId,
        idempotencyKey,
        payload: {
          mutationRequestId: operation.id,
          mutationType: body.type,
          payload: operationPayload,
          requiresRecentConfirmation: true
        }
      },
      idempotencyKey
    );
    await prisma.auditLog.create({
      data: {
        organizationId: membership.organizationId,
        actorUserId: session.user.id,
        action: `operation.queued.${body.type}`,
        resourceType: "Operation",
        resourceId: operation.id,
        outcome: "SUCCESS",
        requestId,
        beforeJson: toNullablePrismaJson(null),
        afterJson: toPrismaJson(operationPayload),
        summaryJson: toPrismaJson({ confirmed: true })
      }
    });
    return NextResponse.json({ ok: true, data: { operationId: operation.id, requestId, status: "PENDING" } }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), requestId }, { status: 500 });
  }
}
