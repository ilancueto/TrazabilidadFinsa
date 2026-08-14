"use client";

import { useActionState, useState } from "react";
import {
  closeDeliveryAction,
  markReadyAction,
  reopenDeliveryAction,
  resolveObservationAction,
  type ActionState,
} from "@/lib/actions/deliveries";
import type { DeliveryDetail, UserRole } from "@/lib/types";
import {
  canClose,
  canDownloadReport,
  canEditMasterData,
  canMarkReady,
  canReopen,
  canResolveObservation,
} from "@/lib/deliveries/permissions";

export function StatusActions({
  detail,
  role,
}: {
  detail: DeliveryDetail;
  role: UserRole;
}) {
  const [readyError, setReadyError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [reopenState, reopenAction, reopenPending] = useActionState(
    reopenDeliveryAction,
    {} as ActionState,
  );

  const readyOk = canMarkReady(role, detail.status, detail.progress.pendingRequired);
  const blocked = detail.progress.pendingRequired > 0;

  return (
    <div className="space-y-3 rounded-md border border-line bg-white p-4">
      <h2 className="text-sm font-semibold">Acciones</h2>
      {blocked && (detail.status === "IN_PICKING" || detail.status === "PUBLISHED") ? (
        <p className="rounded-sm bg-cat/30 px-2 py-1 text-xs">
          READY bloqueado. Falta: {detail.progress.pendingCriticalLabels.join(", ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canEditMasterData(role, detail.status) ? (
          <a
            href={`/admin/deliveries/${detail.id}/edit`}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
          >
            Editar
          </a>
        ) : null}

        {canDownloadReport(role) ? (
          <a
            href={`/admin/deliveries/${detail.id}/report`}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
          >
            Descargar informe
          </a>
        ) : null}

        {readyOk ? (
          <button
            type="button"
            className="rounded-md bg-ok px-3 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              setReadyError(null);
              const result = await markReadyAction(detail.id);
              if (result.error) setReadyError(result.error);
            }}
          >
            Marcar lista
          </button>
        ) : null}

        {canClose(role, detail.status) ? (
          <button
            type="button"
            className="rounded-md bg-anthracite px-3 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              setCloseError(null);
              const result = await closeDeliveryAction(detail.id);
              if (result.error) setCloseError(result.error);
            }}
          >
            Cerrar entrega
          </button>
        ) : null}

        {canResolveObservation(role, detail.status) && detail.has_open_observation ? (
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
            onClick={() => resolveObservationAction(detail.id)}
          >
            Resolver observación
          </button>
        ) : null}
      </div>

      {readyError ? <p className="text-sm text-danger">{readyError}</p> : null}
      {closeError ? <p className="text-sm text-danger">{closeError}</p> : null}

      {canReopen(role, detail.status) ? (
        <form action={reopenAction} className="space-y-2 border-t border-line pt-3">
          <input type="hidden" name="deliveryId" value={detail.id} />
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Reabrir (queda auditado)
            <input
              name="reason"
              required
              placeholder="Motivo de reapertura"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm font-normal"
            />
          </label>
          {reopenState.error ? <p className="text-sm text-danger">{reopenState.error}</p> : null}
          <button
            type="submit"
            disabled={reopenPending}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold"
          >
            Reabrir
          </button>
        </form>
      ) : null}
    </div>
  );
}
