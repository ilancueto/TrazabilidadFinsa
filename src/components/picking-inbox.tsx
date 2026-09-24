"use client";

import Link from "next/link";
import { PickingSearch } from "@/components/picking-search";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { useSearchQuery } from "@/components/use-search-query";
import { MODALITY_LABEL } from "@/lib/constants";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import { deliveryMatchesQuery } from "@/lib/deliveries/search";
import type { DeliveryListItem } from "@/lib/types";
import type { OperationalAlert } from "@/lib/deliveries/alerts";
import { cn, formatPackages, formatRelative } from "@/lib/utils";

export function PickingInbox({
  deliveries,
  total,
  userId,
  cola,
  page,
  pageSize,
  alerts = [],
  basePath = "/picking",
  emptyLabel = "entregas",
}: {
  deliveries: DeliveryListItem[];
  total: number;
  userId: string;
  cola: string;
  page: number;
  pageSize: number;
  alerts?: OperationalAlert[];
  basePath?: string;
  emptyLabel?: string;
}) {
  const { query, setQuery, isPending, commit, urlQuery, saveData } = useSearchQuery(basePath);
  const typing = query.trim() !== urlQuery.trim();
  const visible = typing ? deliveries.filter((row) => deliveryMatchesQuery(row, query)) : deliveries;
  const actionable = visible.filter((row) => row.status === "PUBLISHED" || row.status === "IN_PICKING");
  const mine = actionable.filter((row) => row.assignee_id === userId);
  const unassigned = actionable.filter((row) => !row.assignee_id);
  const others = actionable.filter((row) => row.assignee_id && row.assignee_id !== userId);
  const ready = visible.filter((row) => row.status === "READY");

  return (
    <>
      {alerts.length > 0 ? (
        <section className="panel overflow-hidden border-cat/30 bg-cat/5">
          <header className="panel-head flex items-center justify-between border-b border-cat/20 bg-cat/10 py-2.5">
            <h2 className="panel-title flex items-center gap-1.5 text-cat">
              <span className="inline-block h-2 w-2 rounded-full bg-cat animate-pulse" />
              Atención prioritaria ({alerts.length})
            </h2>
          </header>
          <ul className="divide-y divide-cat/15">
            {alerts.slice(0, 6).map((alert) => (
              <li key={alert.id}>
                <Link href={alert.href} prefetch={false} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-cat/10 active:bg-cat/20">
                  <div>
                    <p className="font-mono font-bold text-cat">{alert.number}</p>
                    <p className="text-xs text-muted mt-0.5">{alert.label}</p>
                  </div>
                  <span className="text-cat text-sm font-bold">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <PickingSearch query={query} onQueryChange={setQuery} onSubmit={() => commit(query)} onClear={() => { setQuery(""); commit(""); }} isPending={isPending} />
      {typing && saveData ? <p className="text-xs text-muted">Filtrando esta página. Tocá Buscar para consultar el servidor.</p> : null}
      <nav className="flex items-center gap-1 p-1 rounded-xl bg-card border border-line shadow-xs">
        <ColaLink current={cola} value="todas" q={urlQuery} basePath={basePath}>Todas</ColaLink>
        <ColaLink current={cola} value="mias" q={urlQuery} basePath={basePath}>Mías</ColaLink>
        <ColaLink current={cola} value="libres" q={urlQuery} basePath={basePath}>Libres</ColaLink>
      </nav>
      {visible.length === 0 ? (
        <div className="panel empty space-y-2 py-8">
          <p>{typing ? saveData ? "No está en esta página. Tocá Buscar para buscar en todas." : "Buscando…" : `No hay ${emptyLabel} con esa búsqueda.`}</p>
          {urlQuery ? <Link href={basePath} className="font-semibold text-cat hover:underline">Limpiar búsqueda</Link> : null}
        </div>
      ) : (
        <div className="space-y-5">
          {cola !== "libres" ? <DeliverySection title="Mías" rows={mine} empty={`No tenés ${emptyLabel} tomados.`} /> : null}
          {cola !== "mias" ? <DeliverySection title="Sin asignar" rows={unassigned} empty={`No hay ${emptyLabel} libres.`} /> : null}
          {cola === "todas" && others.length > 0 ? <DeliverySection title="De otros" rows={others} muted /> : null}
          {cola === "todas" && ready.length > 0 ? <DeliverySection title="Listas para revisión" rows={ready} muted /> : null}
        </div>
      )}
      <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Paginación de entregas">
        {page > 1 ? <Link href={pickingPageHref(basePath, urlQuery, cola, page - 1)} className="btn btn-ghost">← Anteriores</Link> : <span />}
        <span className="text-sm text-muted">Página {page} · {total} {emptyLabel}</span>
        {page * pageSize < total ? <Link href={pickingPageHref(basePath, urlQuery, cola, page + 1)} className="btn btn-ghost">Siguientes →</Link> : <span />}
      </nav>
    </>
  );
}

function pickingPageHref(basePath: string, q: string, cola: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (cola !== "todas") params.set("cola", cola);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${basePath}?${params}` : basePath;
}

function ColaLink({ current, value, q, basePath, children }: { current: string; value: string; q: string; basePath: string; children: React.ReactNode }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (value !== "todas") params.set("cola", value);
  const href = params.size ? `${basePath}?${params}` : basePath;
  const active = current === value;
  return (
    <a
      href={href}
      className={cn(
        "flex-1 text-center py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all duration-140 select-none",
        active
          ? "bg-cat text-ink shadow-sm"
          : "text-muted hover:text-foreground hover:bg-white/5",
      )}
    >
      {children}
    </a>
  );
}

function DeliverySection({ title, rows, empty, muted = false }: { title: string; rows: DeliveryListItem[]; empty?: string; muted?: boolean }) {
  return (
    <section className="space-y-2.5">
      <h2 className="panel-title px-1">{title}</h2>
      {rows.length === 0 ? <p className="panel empty !py-5">{empty}</p> : (
        <ul className="space-y-3">{rows.map((row) => <li key={row.id}><DeliveryCard row={row} muted={muted} /></li>)}</ul>
      )}
    </section>
  );
}

function DeliveryCard({ row, muted }: { row: DeliveryListItem; muted: boolean }) {
  const isUrgent = row.priority === "URGENT";
  return (
    <Link
      href={pickingDeliveryPath(row.number)}
      prefetch={false}
      className={cn(
        "panel block p-4 sm:p-4.5 rounded-xl border transition-all duration-150",
        "hover:border-cat/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] active:bg-cat/5",
        isUrgent ? "border-cat/60 bg-gradient-to-r from-cat/5 via-card to-card" : "border-line bg-card",
        muted && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xl font-bold tracking-tight text-cat">{row.number}</p>
            {isUrgent ? (
              <span className="inline-flex items-center rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-danger border border-danger/30">
                Urgente
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {row.client_name || row.destination}
          </p>
          {row.client_name && row.destination !== row.client_name ? (
            <p className="truncate text-xs text-muted">{row.destination}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="rounded-md bg-elevated px-2 py-0.5 font-medium border border-line/60">
              {MODALITY_LABEL[row.modality]} · {formatPackages(row.packages)}
            </span>
            {row.pallet_code ? (
              <span className="rounded-md border border-cat/30 bg-cat/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cat">
                📦 {row.pallet_code}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={row.status} />
          {!isUrgent && <PriorityBadge priority={row.priority} />}
        </div>
      </div>
      <div className="mt-3.5 pt-3 border-t border-line/60">
        <ProgressBar progress={row.progress} />
        {row.progress.pendingCriticalLabels.length > 0 ? (
          <p className="mt-2 text-xs font-medium text-cat">
            Falta: {row.progress.pendingCriticalLabels.join(", ")}
          </p>
        ) : (
          <p className="mt-2 text-xs font-medium text-ok">✓ Requisitos de piso completos</p>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
        <span>Actualizado {formatRelative(row.updated_at)}</span>
        {row.has_open_observation ? (
          <span className="rounded-full bg-danger/15 px-2 py-0.5 font-extrabold uppercase text-danger border border-danger/30">
            ⚠ Observación abierta
          </span>
        ) : null}
      </div>
    </Link>
  );
}
