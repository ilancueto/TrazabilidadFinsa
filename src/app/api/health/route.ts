import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("requirement_types").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      database: "reachable",
      service: "cat-trazabilidad",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        service: "cat-trazabilidad",
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
