import { NextResponse } from "next/server";
import { relativeRedirect } from "@/lib/http/redirect";
import { getRequestUser, userScopedClient } from "@/lib/auth/request-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { persistEvidence } from "@/lib/evidence/persist";
import {
  PersistForbiddenError,
  PersistNotFoundError,
  PersistRpcError,
  PersistStorageError,
  PersistValidationError,
  isBlobLike,
} from "@/lib/evidence/mime";
import { MAX_EVIDENCE_BYTES } from "@/lib/constants";
import {
  TECHNICAL_API_OPERATIONS,
  getRequestLogContext,
  logTechnicalError,
  type ServerLogContext,
  withTechnicalApiMetric,
} from "@/lib/observability";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusFor(error: unknown): number {
  if (error instanceof PersistValidationError) return 400;
  if (error instanceof PersistForbiddenError) return 403;
  if (error instanceof PersistNotFoundError) return 404;
  return 500;
}

function isBrowserFormPost(request: Request): boolean {
  const mode = request.headers.get("sec-fetch-mode");
  const accept = request.headers.get("accept") ?? "";
  return mode === "navigate" || accept.includes("text/html");
}

function safeNextPath(value: string, fallback: string): string {
  if (value.startsWith("/picking/") && !value.startsWith("//")) return value;
  return fallback;
}

function uploadAttempt(request: Request): 1 | 2 | 3 | undefined {
  const value = request.headers.get("x-upload-attempt");
  return value === "1" || value === "2" || value === "3" ? Number(value) as 1 | 2 | 3 : undefined;
}

function uploadMetricContext(request: Request): ServerLogContext {
  const attempt = uploadAttempt(request);
  return {
    operationId: request.headers.get("x-upload-operation-id") ?? undefined,
    ...(attempt ? { metadata: { uploadAttempt: attempt } } : {}),
  };
}

function uploadFailureCode(error: unknown): { category: "api" | "rpc"; code: string } {
  if (error instanceof PersistStorageError) return { category: "api", code: "evidence.storage_upload_failed" };
  if (error instanceof PersistRpcError) return { category: "rpc", code: "evidence.register_rpc_failed" };
  return { category: "api", code: "evidence.upload_failed" };
}

export async function POST(request: Request) {
  const metricContext = uploadMetricContext(request);
  return withTechnicalApiMetric(
    request,
    TECHNICAL_API_OPERATIONS.evidenceUpload,
    () => postEvidence(request, metricContext),
    metricContext,
  );
}

async function postEvidence(request: Request, metricContext: ServerLogContext) {
  const startedAt = performance.now();
  const logContext = getRequestLogContext(request);
  const uploadLogContext = {
    ...logContext,
    ...metricContext,
  };
  const formPost = isBrowserFormPost(request);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_EVIDENCE_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "La foto supera el tamaño máximo de 8 MB" }, { status: 413 });
  }
  const user = await getRequestUser(request);
  if (!user) {
    if (formPost) {
      return relativeRedirect("/login?next=%2Fpicking", 303);
    }
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    if (formPost) {
      return relativeRedirect("/picking?error=foto", 303);
    }
    return NextResponse.json({ error: "No se pudo leer la foto" }, { status: 400 });
  }

  const requirementId = String(form.get("requirementId") ?? "");
  const comment = String(form.get("comment") ?? "").trim();
  const filenameHint = String(form.get("filename") ?? "");
  const nextPath = safeNextPath(String(form.get("next") ?? ""), "/picking");
  const returnTo = safeNextPath(String(form.get("returnTo") ?? nextPath), nextPath);
  const file = form.get("file");

  const fail = (message: string, status = 400) => {
    if (formPost) {
      const target = new URL(returnTo, "http://local.invalid");
      target.searchParams.set("error", message);
      return relativeRedirect(`${target.pathname}${target.search}`, 303);
    }
    return NextResponse.json({ error: message }, { status });
  };

  if (!isBlobLike(file) || file.size === 0) {
    return fail("Elegí una foto y después tocá Subir foto");
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return fail("La foto supera el tamaño máximo de 8 MB", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const declaredMime = "type" in file && typeof file.type === "string" ? file.type : null;
  const filename =
    ("name" in file && typeof file.name === "string" && file.name) || filenameHint || "evidencia.jpg";

  const header = request.headers.get("authorization");
  const supabase = header?.toLowerCase().startsWith("bearer ")
    ? userScopedClient(header.slice(7).trim())
    : await createServerSupabase();

  try {
    const result = await persistEvidence(supabase, {
      actorId: user.id,
      actorRole: user.role,
      requestId: logContext.requestId,
      requirementId,
      bytes,
      declaredMime,
      filename,
      width: Number(form.get("width")) || null,
      height: Number(form.get("height")) || null,
      comment,
    });
    if (formPost) {
      const next =
        result.nextRequirementId
          ? `${pickingDeliveryPath(result.deliveryNumber, result.nextRequirementId)}?uploaded=1`
          : `${pickingDeliveryPath(result.deliveryNumber)}?uploaded=1`;
      return relativeRedirect(next, 303);
    }
    return NextResponse.json({
      ok: true,
      evidenceId: result.evidenceId,
      deliveryId: result.deliveryId,
      deliveryNumber: result.deliveryNumber,
      nextRequirementId: result.nextRequirementId,
    });
  } catch (error) {
    const classification = uploadFailureCode(error);
    logTechnicalError(classification.category, classification.code, error, {
      ...uploadLogContext,
      operation: "evidence.upload",
      durationMs: performance.now() - startedAt,
      statusCode: statusFor(error),
    });
    const message = error instanceof Error ? error.message : "No se pudo guardar la evidencia";
    return fail(message, statusFor(error));
  }
}
