import type { Instrumentation } from "next";
import { isServerErrorTrackingEnabled } from "@/lib/error-tracking/config";
import { captureServerException } from "@/lib/error-tracking/server";
import { isSafeCorrelationId, redactErrorTrackingText } from "@/lib/error-tracking/sanitize";

function routeWithoutQuery(value: string): string | undefined {
  try {
    return new URL(value, "https://request.invalid").pathname;
  } catch {
    return undefined;
  }
}

function requestIdFrom(headers: Record<string, string | string[] | undefined>): string | undefined {
  const value = headers["x-request-id"];
  return typeof value === "string" && isSafeCorrelationId(value) ? value : undefined;
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && isServerErrorTrackingEnabled()) {
    await import("../sentry.server.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (!isServerErrorTrackingEnabled()) return;

  const digest = error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
    ? redactErrorTrackingText(error.digest)
    : undefined;
  const route = routeWithoutQuery(context.routePath) ?? routeWithoutQuery(request.path);
  const requestId = requestIdFrom(request.headers);

  captureServerException(error, {
    ...(route ? { route } : {}),
    ...(digest ? { digest } : {}),
    ...(requestId ? { requestId } : {}),
    method: redactErrorTrackingText(request.method),
    routeType: redactErrorTrackingText(context.routeType),
    runtime: "nodejs",
  });
};
