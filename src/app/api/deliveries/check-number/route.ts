import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const number = (searchParams.get("number") ?? "").trim();
  const excludeId = searchParams.get("excludeId");

  if (!number || number.length < 2) {
    return NextResponse.json({ exists: false });
  }

  const supabase = await createServerSupabase();
  let query = supabase
    .from("deliveries")
    .select("id, number, status, destination, created_at, closed_at")
    .ilike("number", number)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data && data.length > 0) {
    return NextResponse.json({
      exists: true,
      delivery: data[0],
    });
  }

  return NextResponse.json({ exists: false });
}
