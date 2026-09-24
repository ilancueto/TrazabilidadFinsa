import Link from "next/link";
import { BulkCloseForm } from "@/components/admin/bulk-close-form";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import { requireRole } from "@/lib/auth/session";
import { MODALITY_LABEL } from "@/lib/constants";
import { canClose } from "@/lib/deliveries/permissions";
import { listDeliveries } from "@/lib/deliveries/queries";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
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
        <Link href="/admin" className="btn btn-ghost rounded-xl shadow-xs active:scale-[0.98]">
          Todas las entregas
        </Link>
      </div>

      {ready.length === 0 ? (
        <p className="panel empty rounded-2xl py-10">No hay entregas listas ahora.</p>
      ) : (
        <BulkCloseForm enabled={canBulk}>
          <ul className="space-y-3">
            {ready.map((row) => (
              <li
                key={row.id}
                className="panel p-4 sm:p-5 rounded-2xl border border-line/80 shadow-xs transition-all duration-150 hover:border-cat/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3.5">
                  {canBulk ? (
                    <input
                      type="checkbox"
                      name="deliveryId"
                      value={row.id}
                      disabled={row.has_open_observation || row.progress.pendingDispatch > 0}
                      className="mt-2.5 h-4 w-4 rounded-xs border-line/80 accent-cat cursor-pointer"
                    />
                  ) : null}
                  <Link href={adminDeliveryPath(row.number, "/revisar")} prefetch={false} className="min-w-0 flex-1 block">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xl sm:text-2xl font-bold text-cat">{row.number}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{row.destination}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span className="rounded-md bg-elevated px-2 py-0.5 font-medium border border-line/60">
                            {MODALITY_LABEL[row.modality]} · {row.assignee_name ?? "Sin asignar"}
                          </span>
                          <span>· Actualizada {formatRelative(row.updated_at)}</span>
                        </div>
                      </div>
                      <PriorityBadge priority={row.priority} />
                    </div>
                    <div className="mt-3.5 pt-2.5 border-t border-line/60">
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
