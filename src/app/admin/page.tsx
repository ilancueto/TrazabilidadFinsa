import Link from "next/link";
import { AdminFilters } from "@/components/admin/filters";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { MODALITY_LABEL } from "@/lib/constants";
import { getDashboardKpis, listDeliveries, listPickingProfiles } from "@/lib/deliveries/queries";
import type { DeliveryModality, DeliveryPriority, DeliveryStatus } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Dashboard Admin" };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = (typeof params.status === "string" ? params.status : "ALL") as
    | DeliveryStatus
    | "ALL";
  const modality = (typeof params.modality === "string" ? params.modality : "ALL") as
    | DeliveryModality
    | "ALL";
  const priority = (typeof params.priority === "string" ? params.priority : "ALL") as
    | DeliveryPriority
    | "ALL";
  const assigneeId = typeof params.assignee === "string" ? params.assignee : "ALL";

  const [kpis, deliveries, pickers] = await Promise.all([
    getDashboardKpis(),
    listDeliveries({ q, status, modality, priority, assigneeId }),
    listPickingProfiles(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Entregas</h1>
          <p className="text-sm text-muted">Creá, publicá y cerrá con evidencia trazable.</p>
        </div>
        <Link
          href="/admin/deliveries/new"
          className="rounded-md bg-cat px-4 py-3 text-sm font-bold text-ink"
        >
          Nueva entrega
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Activas", kpis.active],
          ["En Picking", kpis.picking],
          ["Listas", kpis.ready],
          ["Observaciones", kpis.observations],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-md border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <AdminFilters pickers={pickers} />

      <section className="overflow-hidden rounded-md border border-line bg-white">
        {deliveries.length === 0 ? (
          <p className="p-6 text-sm text-muted">No hay entregas con esos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Número</th>
                  <th className="px-3 py-2">Modalidad</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Prioridad</th>
                  <th className="px-3 py-2">Responsable</th>
                  <th className="px-3 py-2">Progreso</th>
                  <th className="px-3 py-2">Actualizada</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((row) => (
                  <tr key={row.id} className="border-t border-line hover:bg-paper/70">
                    <td className="px-3 py-3 font-mono font-semibold">
                      <Link href={`/admin/deliveries/${row.id}`} className="underline-offset-2 hover:underline">
                        {row.number}
                      </Link>
                      {row.has_open_observation ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-danger">obs</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{MODALITY_LABEL[row.modality]}</td>
                    <td className="px-3 py-3">{row.destination}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="px-3 py-3">{row.assignee_name ?? "—"}</td>
                    <td className="px-3 py-3">
                      <ProgressBar progress={row.progress} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-muted">{formatRelative(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
