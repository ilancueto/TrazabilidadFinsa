import { AuditPanel } from "@/components/admin/audit-panel";
import { AuditFilterError, listAuditEvents, listAuditProfiles, resolveAuditFilters, type AuditFilters } from "@/lib/audit/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata = { title: "Auditoría" };

function value(params: Record<string, string | string[] | undefined>, key: keyof AuditFilters) {
  const item = params[key];
  return typeof item === "string" ? item : undefined;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  const params = await searchParams;
  const input: AuditFilters = { from: value(params, "from"), to: value(params, "to"), actorId: value(params, "actorId"), delivery: value(params, "delivery"), action: value(params, "action") as AuditFilters["action"], reason: value(params, "reason"), pageSize: value(params, "pageSize") ? Number(value(params, "pageSize")) : undefined, cursor: value(params, "cursor") };
  const profiles = await listAuditProfiles();
  let result: Awaited<ReturnType<typeof listAuditEvents>> | null = null;
  let error: string | undefined;
  try {
    result = await listAuditEvents(input);
  } catch (caught) {
    error = caught instanceof AuditFilterError ? caught.message : "No se pudo cargar la auditoría.";
  }
  const panel = result ?? { events: [], filters: resolveAuditFilters({}), nextCursor: null, hasMore: false };
  return <div className="space-y-5"><div className="page-head"><div><p className="page-kicker">Control de operaciones</p><h1 className="page-title">Auditoría</h1><p className="page-sub">Eventos de entregas, con filtros y paginación segura.</p></div></div><AuditPanel {...panel} profiles={profiles} error={error} /></div>;
}
