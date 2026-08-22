import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestLogContext, logServerError } from "@/lib/observability";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const logContext = getRequestLogContext(request);
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("requirement_types").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      database: "reachable",
      service: "cat-trazabilidad",
      region: process.env.VERCEL_REGION ?? "local",
      databaseLatencyMs: Math.round(performance.now() - startedAt),
      time: new Date().toISOString(),
    });
  } catch (error) {
    logServerError("health.check_failed", error, {
      ...logContext,
      operation: "health.check",
      durationMs: performance.now() - startedAt,
    });
    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        service: "cat-trazabilidad",
        region: process.env.VERCEL_REGION ?? "local",
        databaseLatencyMs: Math.round(performance.now() - startedAt),
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
