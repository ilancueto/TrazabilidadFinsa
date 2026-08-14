import Link from "next/link";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { MODALITY_LABEL } from "@/lib/constants";
import { listDeliveries } from "@/lib/deliveries/queries";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Picking" };

export default async function PickingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const deliveries = (await listDeliveries({ q })).filter((row) => row.status !== "CLOSED");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pendientes</h1>
        <p className="text-sm text-muted">Urgentes primero. Un tap abre el checklist.</p>
      </div>
      <form>
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar número o destino"
          className="w-full rounded-md border border-line bg-white px-4 py-3"
        />
      </form>
      {deliveries.length === 0 ? (
        <p className="rounded-md border border-line bg-white p-6 text-sm text-muted">
          No hay entregas publicadas.
        </p>
      ) : (
        <ul className="space-y-3">
          {deliveries.map((row) => (
            <li key={row.id}>
              <Link
                href={`/picking/${row.id}`}
                className="block rounded-md border border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-semibold">{row.number}</p>
                    <p className="text-sm">{row.destination}</p>
                    <p className="text-xs text-muted">{MODALITY_LABEL[row.modality]}</p>
                  </div>
                  <div className="text-right">
                    <PriorityBadge priority={row.priority} />
                    <div className="mt-2">
                      <StatusBadge status={row.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <ProgressBar progress={row.progress} />
                  <span className="text-xs text-muted">{formatRelative(row.updated_at)}</span>
                </div>
                {row.has_open_observation ? (
                  <p className="mt-2 text-xs font-semibold uppercase text-danger">
                    Observación abierta
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
