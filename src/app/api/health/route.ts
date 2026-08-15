import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const startedAt = performance.now();
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
  } catch {
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
