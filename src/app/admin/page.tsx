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
import { cn, formatRelative, isUuid } from "@/lib/utils";

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
    <div className="space-y-6">
      <div className="page-head flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="page-kicker flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cat animate-pulse" />
            Centro de operaciones · Bodega Neuquén
          </p>
          <h1 className="page-title">{sectionTitle}</h1>
          <p className="page-sub">{sectionSubtitle}</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {user.role === "ADMIN" ? (
            <Link
              href="/admin/deliveries/new"
              className="btn btn-primary rounded-xl font-bold shadow-md shadow-cat/20 active:scale-[0.98] flex items-center justify-center gap-2 order-first sm:order-last"
            >
              <span>＋</span>
              <span>Nueva entrega</span>
            </Link>
          ) : null}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0">
            <Link href="/admin/revision" className="btn btn-outline btn-sm rounded-xl font-bold whitespace-nowrap active:scale-[0.98]">
              Revisión
            </Link>
            <Link href="/admin/agrupar" className="btn btn-ghost btn-sm rounded-xl whitespace-nowrap active:scale-[0.98]" title="Agrupar múltiples entregas en lotes o pallets">
              📦 Agrupar
            </Link>
            <a href={`/api/deliveries/export-zip?${exportParams.toString()}`} className="btn btn-ghost btn-sm rounded-xl whitespace-nowrap active:scale-[0.98]" title={`Descargar ZIP de ${sectionTitle.toLowerCase()}`}>
              Descargar ZIP
            </a>
            <Link href="/admin/dia" className="btn btn-ghost btn-sm rounded-xl whitespace-nowrap active:scale-[0.98]">
              Cierre de día
            </Link>
          </div>
        </div>
      </div>

      {deleted ? <p className="banner banner-ok rounded-xl">Se archivó la entrega {deleted}.</p> : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Kpi href={sectionHref()} label="Activas" value={kpis.active} hint="En curso" icon="⚡" variant="active" />
        <Kpi href={sectionHref("status=IN_PICKING")} label="En Picking" value={kpis.picking} icon="🚜" variant="picking" />
        <Kpi href={sectionHref("status=READY")} label="Listas" value={kpis.ready} hint="Para revisar" warn={kpis.ready > 0} icon="✓" variant="ready" />
        <Kpi href={sectionHref()} label="Observaciones" value={kpis.observations} danger={kpis.observations > 0} warn={kpis.observations > 0} icon="⚠" variant="observations" />
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
        <aside className="space-y-4" aria-label="Información operativa">
          <section className="panel activity-rail rounded-2xl border-line/80 shadow-sm overflow-hidden">
            <header className="panel-head px-4 py-3 border-b border-line/70">
              <h2 className="panel-title flex items-center gap-1.5">
                <span>⏱</span>
                <span>Actividad reciente</span>
              </h2>
            </header>
            <ul className="activity-list">{deliveries.slice(0, 7).map((row) => (
              <li key={row.id} className="activity-item">
                <span
                  className={cn(
                    "activity-marker",
                    row.status === "READY" ? "bg-ok/15 text-ok border border-ok/30" : row.has_open_observation ? "bg-danger/15 text-danger border border-danger/30" : "bg-elevated text-cat border border-line",
                  )}
                  aria-hidden="true"
                >
                  {row.status === "READY" ? "✓" : row.has_open_observation ? "!" : "↗"}
                </span>
                <Link href={adminDeliveryPath(row.number)} prefetch={false} className="activity-copy no-underline">
                  <strong>Entrega {row.number}</strong>
                  <small>{row.destination} · {formatRelative(row.updated_at)}</small>
                </Link>
              </li>
            ))}</ul>
          </section>
          {alerts.length > 0 ? (
            <section className="panel rounded-2xl border-line/80 shadow-sm overflow-hidden">
              <header className="panel-head px-4 py-3 border-b border-line/70">
                <h2 className="panel-title flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>Atención ahora</span>
                </h2>
              </header>
              <div className="attention-list">
                {alerts.slice(0, 6).map((alert) => (
                  <Link key={alert.id} href={alert.href} prefetch={false} className="attention-link rounded-xl">
                    <span className="font-mono font-bold text-cat">{alert.number}</span>
                    <span className="text-xs font-semibold text-foreground/90">{alert.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Kpi({
  href,
  label,
  value,
  hint,
  icon,
  danger,
  warn,
  variant = "active",
}: {
  href: string;
  label: string;
  value: number;
  hint?: string;
  icon?: string;
  danger?: boolean;
  warn?: boolean;
  variant?: "active" | "picking" | "ready" | "observations";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 overflow-hidden no-underline",
        "bg-gradient-to-br from-[#182129] via-[#12181e] to-[#0c1014] shadow-sm hover:shadow-md",
        danger
          ? "border-danger/40 hover:border-danger/80 hover:from-danger/15"
          : warn
            ? "border-cat/40 hover:border-cat/80 hover:from-cat/15"
            : "border-line/80 hover:border-cat/40 hover:from-[#1d2731]",
      )}
    >
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-1 transition-all duration-200",
          danger
            ? "bg-danger"
            : warn
              ? "bg-cat"
              : variant === "ready"
                ? "bg-ok"
                : "bg-cat/30 group-hover:bg-cat",
        )}
      />
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-muted group-hover:text-foreground transition-colors truncate">
          {icon ? <span className="text-xs">{icon}</span> : null}
          <span>{label}</span>
        </span>
        {danger ? (
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
          </span>
        ) : warn ? (
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cat opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cat" />
          </span>
        ) : (
          <span className="text-muted/40 text-xs group-hover:text-cat/80 transition-colors hidden sm:inline">→</span>
        )}
      </div>

      <div className="mt-2 sm:mt-2.5 flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "font-mono text-3xl sm:text-4xl font-extrabold tracking-tight",
            danger
              ? "text-danger"
              : warn
                ? "text-cat"
                : "text-foreground group-hover:text-cat transition-colors",
          )}
        >
          {value}
        </p>
        {hint ? (
          <span
            className={cn(
              "text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors truncate",
              danger
                ? "bg-danger/10 text-danger border-danger/30"
                : warn
                  ? "bg-cat/10 text-cat border-cat/30"
                  : "bg-white/5 text-muted border-white/10 group-hover:border-cat/30 group-hover:text-foreground",
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
