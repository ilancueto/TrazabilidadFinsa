import Link from "next/link";
import { AUDIT_FILTER_ACTIONS, presentAuditEvent } from "@/lib/audit/presentation";
import type { AuditPanelEvent, ResolvedAuditFilters } from "@/lib/audit/queries";
import { formatDateTime } from "@/lib/utils";

type Props = {
  events: AuditPanelEvent[];
  filters: ResolvedAuditFilters;
  profiles: Array<{ id: string; full_name: string; deleted_at: string | null }>;
  nextCursor: string | null;
  hasMore: boolean;
  error?: string;
};

function href(filters: ResolvedAuditFilters, cursor?: string | null) {
  const params = new URLSearchParams();
  const from = filters.from.slice(0, 10);
  const to = new Date(new Date(filters.to).getTime() - 86_400_000).toISOString().slice(0, 10);
  params.set("from", from); params.set("to", to);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.delivery) params.set("delivery", filters.delivery);
  if (filters.action) params.set("action", filters.action);
  if (filters.reason) params.set("reason", filters.reason);
  if (filters.pageSize !== 50) params.set("pageSize", String(filters.pageSize));
  if (cursor) params.set("cursor", cursor);
  return `/admin/auditoria?${params.toString()}`;
}

export function AuditPanel({ events, filters, profiles, nextCursor, hasMore, error }: Props) {
  const from = filters.from.slice(0, 10);
  const to = new Date(new Date(filters.to).getTime() - 86_400_000).toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <form action="/admin/auditoria" className="panel grid gap-2 p-3 md:grid-cols-3">
        <label className="text-sm">Desde<input className="field mt-1 w-full" name="from" type="date" defaultValue={from} /></label>
        <label className="text-sm">Hasta<input className="field mt-1 w-full" name="to" type="date" defaultValue={to} /></label>
        <label className="text-sm">Usuario<select className="field mt-1 w-full" name="actorId" defaultValue={filters.actorId ?? ""}><option value="">Todos</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}{profile.deleted_at ? " (eliminado)" : ""}</option>)}</select></label>
        <label className="text-sm">Entrega<input className="field mt-1 w-full" name="delivery" maxLength={100} defaultValue={filters.delivery ?? ""} /></label>
        <label className="text-sm">Acción<select className="field mt-1 w-full" name="action" defaultValue={filters.action ?? ""}><option value="">Todas</option>{AUDIT_FILTER_ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}</select></label>
        <label className="text-sm">Motivo<input className="field mt-1 w-full" name="reason" maxLength={200} defaultValue={filters.reason ?? ""} /></label>
        <div className="flex items-end gap-2"><button className="btn btn-primary" type="submit">Filtrar</button><Link className="btn btn-ghost" href="/admin/auditoria">Limpiar</Link></div>
      </form>
      {error ? <p className="banner banner-danger">{error}</p> : null}
      <section className="panel overflow-hidden">
        {events.length === 0 ? <p className="empty">No hay eventos para esos filtros.</p> : <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Fecha y hora</th><th>Entrega</th><th>Acción</th><th>Actor</th><th>Motivo / resumen</th></tr></thead><tbody>{events.map((event) => {
          const presentation = presentAuditEvent({ ...event, actor_name: event.actor?.full_name ?? (event.actor_id ? "Usuario no disponible" : null), actor: event.actor });
          return <tr key={event.id}><td className="whitespace-nowrap text-muted">{formatDateTime(event.created_at)}</td><td>{event.delivery ? <Link href={`/admin/deliveries/${encodeURIComponent(event.delivery.number)}`}>{event.delivery.number}</Link> : "Entrega no disponible"}{presentation.archived ? <span className="mt-1 block text-xs text-cat">Archivada</span> : null}</td><td>{presentation.label}</td><td>{presentation.actor}</td><td>{presentation.summary ?? "—"}</td></tr>;
        })}</tbody></table></div>}
      </section>
      {hasMore && nextCursor ? <nav aria-label="Paginación de auditoría"><Link className="btn btn-ghost" href={href(filters, nextCursor)}>Siguientes →</Link></nav> : null}
    </div>
  );
}
