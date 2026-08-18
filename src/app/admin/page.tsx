import Link from "next/link";
import { AdminFilters } from "@/components/admin/filters";
import { AssignUnassigned } from "@/components/admin/assign-unassigned";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { MODALITY_LABEL } from "@/lib/constants";
import { requireRole } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";
import {
  buildOperationalAlerts,
  countDeliveries,
  getDashboardKpis,
  listDeliveries,
  listPickingProfiles,
} from "@/lib/deliveries/queries";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { DELIVERY_MODALITIES, DELIVERY_PRIORITIES, DELIVERY_STATUSES, type DeliveryModality, type DeliveryPriority, type DeliveryStatus } from "@/lib/types";
import { formatRelative, isUuid } from "@/lib/utils";

export const metadata = { title: "Tablero" };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const rawStatus = typeof params.status === "string" ? params.status : "ALL";
  const status: DeliveryStatus | "ALL" = (DELIVERY_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus as DeliveryStatus : "ALL";
  const rawModality = typeof params.modality === "string" ? params.modality : "ALL";
  const modality: DeliveryModality | "ALL" = (DELIVERY_MODALITIES as readonly string[]).includes(rawModality) ? rawModality as DeliveryModality : "ALL";
  const rawPriority = typeof params.priority === "string" ? params.priority : "ALL";
  const priority: DeliveryPriority | "ALL" = (DELIVERY_PRIORITIES as readonly string[]).includes(rawPriority) ? rawPriority as DeliveryPriority : "ALL";
  const rawAssignee = typeof params.assignee === "string" ? params.assignee : "ALL";
  const assigneeId = rawAssignee === "NONE" || isUuid(rawAssignee) ? rawAssignee : "ALL";
  const rawClient = typeof params.clientId === "string" ? params.clientId : "ALL";
  const clientId = isUuid(rawClient) ? rawClient : "ALL";
  const hideClosed = params.closed !== "1" && status !== "CLOSED";
  const deleted = typeof params.deleted === "string" ? params.deleted : undefined;
  const rawPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = 50;

  const deliveryFilters = { q, status, modality, priority, assigneeId, clientId, hideClosed };
  const [kpis, deliveries, pickers, clients, total] = await Promise.all([
    getDashboardKpis(),
    listDeliveries({ ...deliveryFilters, page, limit: pageSize }),
    listPickingProfiles(),
    listClients(),
    countDeliveries(deliveryFilters),
  ]);

  const alerts = buildOperationalAlerts(deliveries);
  const unassigned = deliveries.filter(
    (row) =>
      !row.assignee_id && (row.status === "PUBLISHED" || row.status === "IN_PICKING"),
  ).length;

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-kicker">Centro de operaciones · Bodega Neuquén</p>
          <h1 className="page-title">Control de Entregas</h1>
          <p className="page-sub">Estado operativo, responsables y alertas en tiempo real.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/agrupar" className="btn btn-ghost" title="Agrupar múltiples entregas en lotes o pallets">
            📦 Agrupar
          </Link>
          <a
            href={`/api/deliveries/export-zip${q || status !== "ALL" || clientId !== "ALL" ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`}
            className="btn btn-ghost"
            title="Descargar ZIP con PDFs y fotos de las entregas filtradas"
          >
            Descargar ZIP
          </a>
          <Link href="/admin/dia" className="btn btn-ghost">
            Cierre de día
          </Link>
          <Link href="/admin/revision" className="btn btn-outline">
            Revisión
          </Link>
          {user.role === "ADMIN" ? (
            <Link href="/admin/deliveries/new" className="btn btn-primary">
              Nueva entrega
            </Link>
          ) : null}
        </div>
      </div>

      {deleted ? <p className="banner banner-ok">Se archivó la entrega {deleted}.</p> : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi href="/admin" label="Activas" value={kpis.active} hint="En curso" />
        <Kpi href="/admin?status=IN_PICKING" label="En Picking" value={kpis.picking} />
        <Kpi href="/admin/revision" label="Listas" value={kpis.ready} hint="Para revisar" warn={kpis.ready > 0} />
        <Kpi
          href="/admin"
          label="Observaciones"
          value={kpis.observations}
          danger={kpis.observations > 0}
          warn={kpis.observations > 0}
        />
      </section>

      <div className="dashboard-command">
        <div className="dashboard-primary">
          {user.role === "ADMIN" && unassigned > 0 ? <AssignUnassigned pickers={pickers} count={unassigned} /> : null}
          <AdminFilters pickers={pickers} clients={clients} />
          <section className="panel overflow-hidden">
            {deliveries.length === 0 ? <p className="empty">No hay entregas con ese filtro.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Entrega</th><th>Destino / Cliente</th><th>Responsable</th><th>Estado</th><th>Progreso</th><th>Prioridad</th><th>Actualizada</th></tr></thead>
                  <tbody>{deliveries.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono">
                        <Link href={adminDeliveryPath(row.number)}>{row.number}</Link>
                        <span className="mt-1 block font-sans text-[10px] uppercase tracking-wide text-muted">{MODALITY_LABEL[row.modality]}</span>
                        {row.has_open_observation ? <span className="mt-1 block text-[10px] font-extrabold uppercase text-danger">observación</span> : null}
                      </td>
                      <td>
                        <p className="font-medium text-foreground">{row.client_name || row.destination}</p>
                        {row.client_name && row.destination !== row.client_name ? (
                          <p className="text-xs text-muted">{row.destination}</p>
                        ) : null}
                        {row.pallet_code ? (
                          <span className="mt-1 inline-block rounded border border-cat/30 bg-cat/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cat">
                            📦 {row.pallet_code}
                          </span>
                        ) : null}
                      </td>
                      <td>{row.assignee_name ?? "Sin asignar"}</td><td><StatusBadge status={row.status} /></td>
                      <td><ProgressBar progress={row.progress} size="sm" /></td><td><PriorityBadge priority={row.priority} /></td>
                      <td className="text-muted">{formatRelative(row.updated_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <nav className="flex items-center justify-between gap-3" aria-label="Paginación de entregas">
            {page > 1 ? <Link href={adminPageHref(params, page - 1)} className="btn btn-ghost">← Anteriores</Link> : <span />}
            <span className="text-sm text-muted">Página {page} · {total} entregas</span>
            {page * pageSize < total ? <Link href={adminPageHref(params, page + 1)} className="btn btn-ghost">Siguientes →</Link> : <span />}
          </nav>
        </div>
        <aside className="space-y-3" aria-label="Información operativa">
          <section className="panel activity-rail">
            <header className="panel-head"><h2 className="panel-title">Actividad reciente</h2></header>
            <ul className="activity-list">{deliveries.slice(0, 7).map((row) => (
              <li key={row.id} className="activity-item"><span className="activity-marker" aria-hidden="true">{row.status === "READY" ? "✓" : row.has_open_observation ? "!" : "↗"}</span>
                <Link href={adminDeliveryPath(row.number)} className="activity-copy no-underline"><strong>Entrega {row.number}</strong><small>{row.destination} · {formatRelative(row.updated_at)}</small></Link>
              </li>
            ))}</ul>
          </section>
          {alerts.length > 0 ? <section className="panel"><header className="panel-head"><h2 className="panel-title">Atención ahora</h2></header><div className="attention-list">
            {alerts.slice(0, 6).map((alert) => <Link key={alert.id} href={alert.href} className="attention-link"><span className="font-mono font-semibold">{alert.number}</span><span className="text-cat">{alert.label}</span></Link>)}
          </div></section> : null}
        </aside>
      </div>
    </div>
  );
}

function adminPageHref(
  current: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key !== "page" && typeof value === "string" && value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  return params.size ? `/admin?${params}` : "/admin";
}

function Kpi({
  href,
  label,
  value,
  hint,
  danger,
  warn,
}: {
  href: string;
  label: string;
  value: number;
  hint?: string;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <Link href={href} className={warn ? "kpi kpi-warn" : "kpi"}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${danger ? "text-danger" : ""}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </Link>
  );
}
