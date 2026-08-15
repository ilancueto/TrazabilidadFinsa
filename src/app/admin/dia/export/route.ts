import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { listDeliveries } from "@/lib/deliveries/queries";
import { argentinaDayBounds, isValidYmd, toArgentinaParts, todayYmdAR } from "@/lib/time";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function excelArgentinaDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parts = toArgentinaParts(value instanceof Date ? value : new Date(value));
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
}

export async function GET(request: Request) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("desde") || todayYmdAR();
  const to = url.searchParams.get("hasta") || from;
  if (!isValidYmd(from) || !isValidYmd(to) || from > to) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const start = argentinaDayBounds(from).start.getTime();
  const end = argentinaDayBounds(to).end.getTime();
  const supabase = await createServerSupabase();
  const { data: events, error: eventError } = await supabase
    .from("audit_events")
    .select("delivery_id, action, created_at")
    .gte("created_at", new Date(start).toISOString())
    .lt("created_at", new Date(end).toISOString());
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  const ids = [...new Set((events ?? []).map((event) => event.delivery_id))];
  const rows = await listDeliveries({ ids, hideClosed: false, limit: ids.length || 1, includeArchived: true });
  const activity = new Map<string, { published?: Date; ready?: Date; closed?: Date }>();
  for (const event of events ?? []) {
    const current = activity.get(event.delivery_id) ?? {};
    if (event.action === "PUBLISHED" && !current.published) current.published = new Date(event.created_at);
    if (event.action === "READY" && !current.ready) current.ready = new Date(event.created_at);
    if (event.action === "CLOSED" && !current.closed) current.closed = new Date(event.created_at);
    activity.set(event.delivery_id, current);
  }

  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  book.creator = "Finning CAT";
  const sheet = book.addWorksheet("Entregas");
  sheet.columns = [
    { header: "Número", key: "number", width: 16 },
    { header: "Modalidad", key: "modality", width: 16 },
    { header: "Destino", key: "destination", width: 28 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Prioridad", key: "priority", width: 12 },
    { header: "Responsable", key: "assignee", width: 22 },
    { header: "Progreso", key: "progress", width: 12 },
    { header: "Publicada", key: "published", width: 22 },
    { header: "Lista", key: "ready", width: 22 },
    { header: "Cerrada", key: "closed", width: 22 },
    { header: "Sale", key: "due", width: 22 },
    { header: "Observación", key: "obs", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const key of ["published", "ready", "closed", "due"]) {
    sheet.getColumn(key).numFmt = "dd/mm/yyyy hh:mm";
  }

  for (const row of rows) {
    const rowActivity = activity.get(row.id) ?? {};
    sheet.addRow({
      number: row.number,
      modality: MODALITY_LABEL[row.modality],
      destination: row.destination,
      status: STATUS_LABEL[row.status],
      priority: PRIORITY_LABEL[row.priority],
      assignee: row.assignee_name ?? "",
      progress: `${row.progress.complete}/${row.progress.total}`,
      published: excelArgentinaDate(rowActivity.published),
      ready: excelArgentinaDate(rowActivity.ready),
      closed: excelArgentinaDate(rowActivity.closed),
      due: excelArgentinaDate(row.due_at),
      obs: row.has_open_observation ? "Sí" : "No",
    });
  }

  const buffer = await book.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="entregas-${from}-a-${to}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
