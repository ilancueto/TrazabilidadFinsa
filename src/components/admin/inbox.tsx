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
}: {
  deliveries: DeliveryListItem[];
  total: number;
  page: number;
  pageSize: number;
  pickers: Profile[];
  clients: Client[];
  pageParams: Record<string, string>;
}) {
  const { query, setQuery, isPending, commit, urlQuery, saveData } = useSearchQuery("/admin");
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
      />
      {typing && saveData ? (
        <p className="px-1 text-xs text-muted">
          Filtrando esta página. Enter o Buscar consulta el servidor.
        </p>
      ) : null}
      <section className="panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="empty">
            {typing
              ? saveData
                ? "No está en esta página. Enter o Buscar para buscar en todas."
                : "Buscando…"
              : "No hay entregas con ese filtro."}
          </p>
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
                      <Link href={adminDeliveryPath(row.number)}>{row.number}</Link>
                      <span className="mt-1 block font-sans text-[10px] uppercase tracking-wide text-muted">
                        {MODALITY_LABEL[row.modality]}
                      </span>
                      {row.has_open_observation ? (
                        <span className="mt-1 block text-[10px] font-extrabold uppercase text-danger">observación</span>
                      ) : null}
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
                    <td>{row.assignee_name ?? "Sin asignar"}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <ProgressBar progress={row.progress} size="sm" />
                    </td>
                    <td>
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="text-muted">{formatRelative(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <nav className="flex items-center justify-between gap-3" aria-label="Paginación de entregas">
        {page > 1 ? (
          <Link href={adminPageHref(pageParams, page - 1)} className="btn btn-ghost">
            ← Anteriores
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted">
          Página {page} · {total} entregas
        </span>
        {page * pageSize < total ? (
          <Link href={adminPageHref(pageParams, page + 1)} className="btn btn-ghost">
            Siguientes →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}

function adminPageHref(current: Record<string, string>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key !== "page" && value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  return params.size ? `/admin?${params}` : "/admin";
}
