import Link from "next/link";
import { PickingSearch } from "@/components/picking-search";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { MODALITY_LABEL } from "@/lib/constants";
import { requireRole } from "@/lib/auth/session";
import { countDeliveries, listDeliveries } from "@/lib/deliveries/queries";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import type { DeliveryListItem } from "@/lib/types";
import { formatPackages, formatRelative } from "@/lib/utils";

export const metadata = { title: "Picking" };

export default async function PickingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cola?: string; page?: string }>;
}) {
  const user = await requireRole(["PICKING", "ADMIN"]);
  const { q, cola = "todas", page: rawPage } = await searchParams;
  const parsedPage = Number(rawPage ?? 1);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 50;
  const deliveryFilters = { q, hideClosed: true, excludeDraft: true };
  const [deliveries, total] = await Promise.all([
    listDeliveries({ ...deliveryFilters, page, limit: pageSize }),
    countDeliveries(deliveryFilters),
  ]);
  const actionable = deliveries.filter(
    (row) => row.status === "PUBLISHED" || row.status === "IN_PICKING",
  );
  const mine = actionable.filter((row) => row.assignee_id === user.id);
  const unassigned = actionable.filter((row) => !row.assignee_id);
  const others = actionable.filter((row) => row.assignee_id && row.assignee_id !== user.id);
  const ready = deliveries.filter((row) => row.status === "READY");
  const urgent = actionable.filter((row) => row.priority === "URGENT").length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="page-kicker">Picking</p>
        <h1 className="page-title">Entregas pendientes</h1>
        <p className="page-sub">
          {actionable.length} para completar
          {urgent > 0 ? ` · ${urgent} urgente${urgent === 1 ? "" : "s"}` : ""}
          {ready.length > 0 ? ` · ${ready.length} lista${ready.length === 1 ? "" : "s"}` : ""}.
        </p>
      </div>
      <PickingSearch initialQuery={q} cola={cola} />
      <nav className="flex gap-2">
        <ColaLink current={cola} value="todas" q={q}>
          Todas
        </ColaLink>
        <ColaLink current={cola} value="mias" q={q}>
          Mías
        </ColaLink>
        <ColaLink current={cola} value="libres" q={q}>
          Libres
        </ColaLink>
      </nav>
      {deliveries.length === 0 ? (
        <div className="panel empty space-y-2">
          <p>No hay entregas con esa búsqueda.</p>
          {q ? (
            <Link href="/picking" className="font-semibold text-cat">
              Limpiar búsqueda
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {cola !== "libres" ? (
            <DeliverySection title="Mías" rows={mine} empty="No tenés entregas tomadas." />
          ) : null}
          {cola !== "mias" ? (
            <DeliverySection title="Sin asignar" rows={unassigned} empty="No hay entregas libres." />
          ) : null}
          {cola === "todas" && others.length > 0 ? (
            <DeliverySection title="De otros" rows={others} muted />
          ) : null}
          {cola === "todas" && ready.length > 0 ? (
            <DeliverySection title="Listas para revisión" rows={ready} muted />
          ) : null}
        </div>
      )}
      <nav className="flex items-center justify-between gap-3" aria-label="Paginación de entregas">
        {page > 1 ? (
          <Link href={pickingPageHref(q, cola, page - 1)} className="btn btn-ghost">← Anteriores</Link>
        ) : <span />}
        <span className="text-sm text-muted">Página {page} · {total} entregas</span>
        {page * pageSize < total ? (
          <Link href={pickingPageHref(q, cola, page + 1)} className="btn btn-ghost">Siguientes →</Link>
        ) : <span />}
      </nav>
    </div>
  );
}

function pickingPageHref(q: string | undefined, cola: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cola !== "todas") params.set("cola", cola);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/picking?${params}` : "/picking";
}

function ColaLink({
  current,
  value,
  q,
  children,
}: {
  current: string;
  value: string;
  q?: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (value !== "todas") params.set("cola", value);
  const href = params.size ? `/picking?${params}` : "/picking";
  const active = current === value;
  return (
    <a href={href} className={active ? "tab tab-on" : "tab"}>
      {children}
    </a>
  );
}

function DeliverySection({
  title,
  rows,
  empty,
  muted = false,
}: {
  title: string;
  rows: DeliveryListItem[];
  empty?: string;
  muted?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="panel-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="panel empty !py-5">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <DeliveryCard row={row} muted={muted} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeliveryCard({ row, muted }: { row: DeliveryListItem; muted: boolean }) {
  const warn = row.priority === "URGENT";
  return (
    <Link
      href={pickingDeliveryPath(row.number)}
      className={`panel block p-4 active:bg-cat/15 ${warn ? "panel-warn" : ""} ${muted ? "opacity-75" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-semibold tracking-tight text-cat">{row.number}</p>
          <p className="text-sm font-medium text-foreground">{row.client_name || row.destination}</p>
          {row.client_name && row.destination !== row.client_name ? (
            <p className="text-xs text-muted">{row.destination}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{MODALITY_LABEL[row.modality]} · {formatPackages(row.packages)}</span>
            {row.pallet_code ? (
              <span className="rounded border border-cat/30 bg-cat/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cat">
                📦 {row.pallet_code}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <PriorityBadge priority={row.priority} />
          <div className="mt-2">
            <StatusBadge status={row.status} />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar progress={row.progress} />
        {row.progress.pendingCriticalLabels.length > 0 ? (
          <p className="mt-2 text-xs font-medium">Falta: {row.progress.pendingCriticalLabels.join(", ")}</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-ok">Obligatorios completos</p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">{formatRelative(row.updated_at)}</p>
      {row.has_open_observation ? (
        <p className="mt-2 text-xs font-extrabold uppercase text-danger">Observación abierta</p>
      ) : null}
    </Link>
  );
}
