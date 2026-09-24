"use client";

import Link from "next/link";
import { AdminFilters } from "@/components/admin/filters";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { useSearchQuery } from "@/components/use-search-query";
import { MODALITY_LABEL } from "@/lib/constants";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { deliveryMatchesQuery } from "@/lib/deliveries/search";
import type { Client, DeliveryListItem, Profile } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export function AdminInbox({
  deliveries,
  total,
  page,
  pageSize,
  pickers,
  clients,
  pageParams,
  basePath = "/admin",
}: {
  deliveries: DeliveryListItem[];
  total: number;
  page: number;
  pageSize: number;
  pickers: Profile[];
  clients: Client[];
  pageParams: Record<string, string>;
  basePath?: string;
}) {
  const { query, setQuery, isPending, commit, urlQuery, saveData } = useSearchQuery(basePath);
  const typing = query.trim() !== urlQuery.trim();
  const rows = typing ? deliveries.filter((row) => deliveryMatchesQuery(row, query)) : deliveries;

  return (
    <>
      <AdminFilters
        pickers={pickers}
        clients={clients}
        query={query}
        onQueryChange={setQuery}
        onCommit={(value) => commit(value ?? query)}
        onClear={() => {
          setQuery("");
          commit("");
        }}
        isPending={isPending}
        basePath={basePath}
      />
      {typing && saveData ? <p className="px-1 text-xs text-muted">Filtrando esta página. Enter o Buscar consulta el servidor.</p> : null}
      <section className="panel rounded-2xl border-line/80 shadow-sm overflow-hidden bg-card">
        {rows.length === 0 ? (
          <p className="empty py-10">{typing ? (saveData ? "No está en esta página. Enter o Buscar para buscar en todas." : "Buscando…") : "No hay entregas con ese filtro."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Destino / Cliente</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Progreso</th>
                  <th>Prioridad</th>
                  <th>Actualizada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono">
                      <Link href={adminDeliveryPath(row.number)} prefetch={false} className="font-bold text-base text-cat hover:underline">
                        {row.number}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="inline-flex items-center rounded-md bg-elevated px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-muted border border-line/60">
                          {MODALITY_LABEL[row.modality]}
                        </span>
                        {row.has_open_observation ? (
                          <span className="inline-flex items-center rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-danger border border-danger/30">
                            observación
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <p className="font-semibold text-foreground">{row.client_name || row.destination}</p>
                      {row.client_name && row.destination !== row.client_name ? (
                        <p className="text-xs text-muted mt-0.5">{row.destination}</p>
                      ) : null}
                      {row.pallet_code ? (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-cat/30 bg-cat/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cat">
                          📦 {row.pallet_code}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {row.assignee_name ? (
                        <span className="text-sm font-medium text-foreground">{row.assignee_name}</span>
                      ) : (
                        <span className="text-xs text-muted italic">Sin asignar</span>
                      )}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td><ProgressBar progress={row.progress} size="sm" /></td>
                    <td><PriorityBadge priority={row.priority} /></td>
                    <td className="text-xs text-muted font-medium">{formatRelative(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <nav className="flex items-center justify-between gap-3 pt-1" aria-label="Paginación de entregas">
        {page > 1 ? (
          <Link href={adminPageHref(basePath, pageParams, page - 1)} className="btn btn-ghost rounded-xl shadow-xs active:scale-[0.98]">
            ← Anteriores
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted font-medium">Página {page} · {total} entregas</span>
        {page * pageSize < total ? (
          <Link href={adminPageHref(basePath, pageParams, page + 1)} className="btn btn-ghost rounded-xl shadow-xs active:scale-[0.98]">
            Siguientes →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}

function adminPageHref(basePath: string, current: Record<string, string>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key !== "page" && key !== "section" && key !== "modality" && value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  return params.size ? `${basePath}?${params}` : basePath;
}
