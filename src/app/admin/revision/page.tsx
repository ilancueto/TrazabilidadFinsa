import Link from "next/link";
import { BulkCloseForm } from "@/components/admin/bulk-close-form";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { canClose } from "@/lib/deliveries/permissions";
import { listDeliveries } from "@/lib/deliveries/queries";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Revisión" };

export default async function ReviewInboxPage() {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  const ready = await listDeliveries({ status: "READY", hideClosed: true, limit: 80 });
  const canBulk = canClose(user.role, "READY");

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-kicker">Revisión</p>
          <h1 className="page-title">Para revisar</h1>
          <p className="page-sub">Entregas listas. Abrí las fotos, cerrá o devolvé a Picking.</p>
        </div>
        <Link href="/admin" className="btn btn-ghost">
          Todas las entregas
        </Link>
      </div>

      {ready.length === 0 ? (
        <p className="panel empty">No hay entregas listas ahora.</p>
      ) : (
        <BulkCloseForm enabled={canBulk}>
          <ul className="space-y-3">
            {ready.map((row) => (
              <li key={row.id} className="panel p-4">
                <div className="flex items-start gap-3">
                  {canBulk ? (
                    <input
                      type="checkbox"
                      name="deliveryId"
                      value={row.id}
                      disabled={row.has_open_observation}
                      className="mt-2"
                    />
                  ) : null}
                  <Link href={`/admin/deliveries/${row.id}/revisar`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xl font-semibold text-cat">{row.number}</p>
                        <p className="text-sm">{row.destination}</p>
                        <p className="text-xs text-muted">
                          {MODALITY_LABEL[row.modality]} · {row.assignee_name ?? "Sin asignar"} ·{" "}
                          {formatRelative(row.updated_at)}
                        </p>
                      </div>
                      <PriorityBadge priority={row.priority} />
                    </div>
                    <div className="mt-3">
                      <ProgressBar progress={row.progress} size="sm" />
                    </div>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </BulkCloseForm>
      )}
    </div>
  );
}
