import { NextResponse } from "next/server";
import { checkApplicationHealth } from "@/lib/health";
import { getRequestLogContext, logServerError } from "@/lib/observability";

const CACHE_CONTROL = "no-store, no-cache, must-revalidate";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const logContext = getRequestLogContext(request);
  const health = await checkApplicationHealth();

  if (!health.ok) {
    logServerError("health.check_failed", new Error("Critical health dependency unavailable"), {
      ...logContext,
      operation: "health.check",
      durationMs: performance.now() - startedAt,
      metadata: { healthDependency: health.failedDependency },
    });
  }

  return NextResponse.json(
    {
      ok: health.ok,
      database: health.database,
      auth: health.auth,
      storage: health.storage,
      service: "cat-trazabilidad",
      region: process.env.VERCEL_REGION ?? "local",
      databaseLatencyMs: health.databaseLatencyMs,
      time: new Date().toISOString(),
    },
    {
      status: health.ok ? 200 : 503,
      headers: { "Cache-Control": CACHE_CONTROL },
    },
  );
}
