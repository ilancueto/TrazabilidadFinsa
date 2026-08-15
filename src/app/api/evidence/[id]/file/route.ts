import { NextResponse } from "next/server";
import { getRequestUser, userScopedClient } from "@/lib/auth/request-user";
import { getEvidenceStorage } from "@/lib/storage";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const header = request.headers.get("authorization");
  const supabase = header?.toLowerCase().startsWith("bearer ")
    ? userScopedClient(header.slice(7).trim())
    : await createServerSupabase();
  const { data, error } = await supabase
    .from("evidences")
    .select("id, storage_key, thumbnail_storage_key, thumbnail_mime_type, mime_type, filename, voided_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Evidencia no encontrada" }, { status: 404 });
  }
  if (data.voided_at) {
    return NextResponse.json({ error: "Evidencia anulada" }, { status: 410 });
  }

  try {
    const wantsThumbnail = new URL(request.url).searchParams.get("variant") === "thumb";
    const key = wantsThumbnail && data.thumbnail_storage_key ? data.thumbnail_storage_key : data.storage_key;
    const mime = wantsThumbnail && data.thumbnail_mime_type ? data.thumbnail_mime_type : data.mime_type;
    const bytes = await getEvidenceStorage().download(key);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${data.filename}"`,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }
}
