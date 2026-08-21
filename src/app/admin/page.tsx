import Link from "next/link";
import { AdminInbox } from "@/components/admin/inbox";
import { AssignUnassigned } from "@/components/admin/assign-unassigned";
import { ExceptionalBulkClose } from "@/components/admin/exceptional-bulk-close";
import { requireRole } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";
import {
  buildOperationalAlerts,
  countDeliveries,
  getDashboardKpis,
  listDeliveries,
  listPickingProfiles,
} from "@/lib/deliveries/queries";
import { getSectionKpis } from "@/lib/deliveries/section-kpis";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { DELIVERY_PRIORITIES, DELIVERY_STATUSES, type DeliveryModality, type DeliveryPriority, type DeliveryStatus } from "@/lib/types";
import { formatRelative, isUuid } from "@/lib/utils";

export const metadata = { title: "Tablero" };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const params = await searchParams;
  const pickupSection = params.section === "CUSTOMER_PICKUP";
  const modality: DeliveryModality = pickupSection ? "CUSTOMER_PICKUP" : "DESPACHO";
  const basePath = pickupSection ? "/admin/retiros" : "/admin";
  const sectionTitle = pickupSection ? "Retira cliente" : "Despachos";
  const sectionSubtitle = pickupSection
    ? "Retiros de clientes, responsables y alertas en tiempo real."
    : "Despachos, responsables y alertas en tiempo real.";

  const q = typeof params.q === "string" ? params.q : undefined;
  const rawStatus = typeof params.status === "string" ? params.status : "ALL";
  const status: DeliveryStatus | "ALL" = (DELIVERY_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus as DeliveryStatus : "ALL";
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
  const [globalKpis, kpis, deliveries, pickers, clients, total] = await Promise.all([
    getDashboardKpis(),
    getSectionKpis(modality),
    listDeliveries({ ...deliveryFilters, page, limit: pageSize }),
    listPickingProfiles(),
    listClients(),
    countDeliveries(deliveryFilters),
  ]);

  const alerts = buildOperationalAlerts(deliveries);
  const unassigned = deliveries.filter(
    (row) => !row.assignee_id && (row.status === "PUBLISHED" || row.status === "IN_PICKING"),
  ).length;

  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value && key !== "section" && key !== "modality") exportParams.set(key, value);
  }
  exportParams.set("modality", modality);

  const cleanPageParams = Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && Boolean(entry[1]) && entry[0] !== "section" && entry[0] !== "modality",
    ),
  );

  const sectionHref = (query = "") => `${basePath}${query ? `?${query}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-kicker">Centro de operaciones · Bodega Neuquén</p>
          <h1 className="page-title">{sectionTitle}</h1>
          <p className="page-sub">{sectionSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/agrupar" className="btn btn-ghost" title="Agrupar múltiples entregas en lotes o pallets">📦 Agrupar</Link>
          <a href={`/api/deliveries/export-zip?${exportParams.toString()}`} className="btn btn-ghost" title={`Descargar ZIP de ${sectionTitle.toLowerCase()}`}>Descargar ZIP</a>
          <Link href="/admin/dia" className="btn btn-ghost">Cierre de día</Link>
          <Link href="/admin/revision" className="btn btn-outline">Revisión</Link>
          {user.role === "ADMIN" ? <Link href="/admin/deliveries/new" className="btn btn-primary">Nueva entrega</Link> : null}
        </div>
      </div>

      {deleted ? <p className="banner banner-ok">Se archivó la entrega {deleted}.</p> : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi href={sectionHref()} label="Activas" value={kpis.active} hint="En curso" />
        <Kpi href={sectionHref("status=IN_PICKING")} label="En Picking" value={kpis.picking} />
        <Kpi href={sectionHref("status=READY")} label="Listas" value={kpis.ready} hint="Para revisar" warn={kpis.ready > 0} />
        <Kpi href={sectionHref()} label="Observaciones" value={kpis.observations} danger={kpis.observations > 0} warn={kpis.observations > 0} />
      </section>

      {user.role === "ADMIN" ? <ExceptionalBulkClose activeCount={globalKpis.active} /> : null}

      <div className="dashboard-command">
        <div className="dashboard-primary">
          {user.role === "ADMIN" && unassigned > 0 ? <AssignUnassigned pickers={pickers} count={unassigned} /> : null}
          <AdminInbox
            deliveries={deliveries}
            total={total}
            page={page}
            pageSize={pageSize}
            pickers={pickers}
            clients={clients}
            pageParams={cleanPageParams}
            basePath={basePath}
          />
        </div>
        <aside className="space-y-3" aria-label="Información operativa">
          <section className="panel activity-rail">
            <header className="panel-head"><h2 className="panel-title">Actividad reciente</h2></header>
            <ul className="activity-list">{deliveries.slice(0, 7).map((row) => (
              <li key={row.id} className="activity-item"><span className="activity-marker" aria-hidden="true">{row.status === "READY" ? "✓" : row.has_open_observation ? "!" : "↗"}</span>
                <Link href={adminDeliveryPath(row.number)} prefetch={false} className="activity-copy no-underline"><strong>Entrega {row.number}</strong><small>{row.destination} · {formatRelative(row.updated_at)}</small></Link>
              </li>
            ))}</ul>
          </section>
          {alerts.length > 0 ? <section className="panel"><header className="panel-head"><h2 className="panel-title">Atención ahora</h2></header><div className="attention-list">
            {alerts.slice(0, 6).map((alert) => <Link key={alert.id} href={alert.href} prefetch={false} className="attention-link"><span className="font-mono font-semibold">{alert.number}</span><span className="text-cat">{alert.label}</span></Link>)}
          </div></section> : null}
        </aside>
      </div>
    </div>
  );
}

function Kpi({ href, label, value, hint, danger, warn }: { href: string; label: string; value: number; hint?: string; danger?: boolean; warn?: boolean }) {
  return (
    <Link href={href} className={warn ? "kpi kpi-warn" : "kpi"}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${danger ? "text-danger" : ""}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </Link>
  );
}
