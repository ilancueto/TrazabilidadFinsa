import { createHash, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { isServerErrorTrackingEnabled } from "@/lib/error-tracking/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = { status: 404 } as const;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function hasValidNonce(request: Request): boolean {
  const expected = process.env.SENTRY_CONTROLLED_TEST_NONCE;
  const provided = request.headers.get("x-sentry-controlled-test-nonce");
  if (!expected || !provided) return false;

  return timingSafeEqual(digest(expected), digest(provided));
}

function hasBody(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  return request.body !== null ||
    request.headers.has("transfer-encoding") ||
    (contentLength !== null && contentLength !== "0");
}

export function HEAD(request: Request): Response {
  if (hasBody(request) || !hasValidNonce(request)) return new Response(null, NOT_FOUND);

  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "x-sentry-probe-client": Sentry.getClient() ? "ready" : "missing",
      "x-sentry-probe-gate": isServerErrorTrackingEnabled() ? "enabled" : "disabled",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!isServerErrorTrackingEnabled() || hasBody(request) || !hasValidNonce(request)) {
    return new Response(null, NOT_FOUND);
  }

  if (!Sentry.getClient()) return new Response(null, NOT_FOUND);

  try {
    Sentry.captureException(new Error("Controlled Sentry STAGING validation"), {
      tags: {
        code: "error_tracking.controlled_test",
        method: "POST",
        routeType: "route",
        runtime: "nodejs",
      },
    });
    const flushed = await Sentry.flush(2_000);
    return new Response(null, { status: flushed ? 204 : 503 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
