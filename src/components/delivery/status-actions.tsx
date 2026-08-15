"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closeDeliveryAction,
  deleteDeliveryAction,
  duplicateDeliveryAction,
  markReadyAction,
  reopenDeliveryAction,
  resolveObservationAction,
  returnToPickingAction,
  type ActionState,
} from "@/lib/actions/deliveries";
import { Dialog } from "@/components/ui-dialog";
import type { DeliveryDetail, UserRole } from "@/lib/types";
import {
  canClose,
  canDeleteDelivery,
  canDownloadReport,
  canDuplicateDelivery,
  canEditMasterData,
  canMarkReady,
  canReopen,
  canResolveObservation,
  canReturnToPicking,
} from "@/lib/deliveries/permissions";

export function StatusActions({
  detail,
  role,
}: {
  detail: DeliveryDetail;
  role: UserRole;
}) {
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [actionPending, startAction] = useTransition();
  const [dialog, setDialog] = useState<"return" | "delete" | "reopen" | "close" | null>(null);
  const router = useRouter();
  const [reopenState, reopenAction, reopenPending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await reopenDeliveryAction(previous, formData);
    if (result.success) {
      setDialog(null);
      setFeedback({ kind: "success", text: result.success });
    }
    return result;
  }, {} as ActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await deleteDeliveryAction(previous, formData);
    if (result.success) router.push("/admin");
    return result;
  }, {} as ActionState);
  const [returnState, returnAction, returnPending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await returnToPickingAction(previous, formData);
    if (result.success) {
      setDialog(null);
      setFeedback({ kind: "success", text: result.success });
    }
    return result;
  }, {} as ActionState);

  const readyOk = canMarkReady(role, detail.status, detail.progress.pendingRequired);
  const blocked = detail.progress.pendingRequired > 0;
  const busy = actionPending || reopenPending || deletePending || returnPending;

  function runAction(operation: () => Promise<ActionState>) {
    setFeedback(null);
    startAction(async () => {
      const result = await operation();
      setFeedback(
        result.error
          ? { kind: "error", text: result.error }
          : { kind: "success", text: result.success || "Listo" },
      );
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Acciones</h2>
      </div>
      <div className="space-y-3 p-4">
        {blocked && (detail.status === "IN_PICKING" || detail.status === "PUBLISHED") ? (
          <p className="banner banner-cat text-xs">
            Todavía falta foto de: {detail.progress.pendingCriticalLabels.join(", ")}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canEditMasterData(role, detail.status) ? (
            <a href={`/admin/deliveries/${detail.id}/edit`} className="btn btn-ghost">
              Editar
            </a>
          ) : null}
          {canDownloadReport(role) ? (
            <a href={`/admin/deliveries/${detail.id}/report`} className="btn btn-ghost">
              Informe
            </a>
          ) : null}
          {canReturnToPicking(role, detail.status) ? (
            <a href={`/admin/deliveries/${detail.id}/revisar`} className="btn btn-outline">
              Revisar fotos
            </a>
          ) : null}
          {readyOk ? (
            <button type="button" disabled={busy} className="btn btn-ok" onClick={() => runAction(() => markReadyAction(detail.id))}>
              {actionPending ? "…" : "Marcar lista"}
            </button>
          ) : null}
          {canClose(role, detail.status) ? (
            <button type="button" disabled={busy} className="btn btn-primary" onClick={() => setDialog("close")}>
              Cerrar
            </button>
          ) : null}
          {canResolveObservation(role, detail.status) && detail.has_open_observation ? (
            <button type="button" disabled={busy} className="btn btn-ghost" onClick={() => runAction(() => resolveObservationAction(detail.id))}>
              Resolver observación
            </button>
          ) : null}
          {canDuplicateDelivery(role) ? (
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost"
              onClick={() =>
                runAction(async () => {
                  const result = await duplicateDeliveryAction(detail.id);
                  if (result.deliveryId && !result.error) {
                    router.push(`/admin/deliveries/${result.deliveryId}/edit`);
                  }
                  return result;
                })
              }
            >
              Duplicar
            </button>
          ) : null}
          {canReturnToPicking(role, detail.status) ? (
            <button type="button" className="btn btn-ghost" onClick={() => setDialog("return")}>
              Devolver
            </button>
          ) : null}
          {canReopen(role, detail.status) ? (
            <button type="button" className="btn btn-ghost" onClick={() => setDialog("reopen")}>
              Reabrir
            </button>
          ) : null}
          {canDeleteDelivery(role) ? (
            <button type="button" className="btn btn-danger" onClick={() => setDialog("delete")}>
              Archivar
            </button>
          ) : null}
        </div>

        {feedback ? (
          <p className={feedback.kind === "error" ? "banner banner-danger" : "banner banner-ok"}>{feedback.text}</p>
        ) : null}
      </div>

      <Dialog
        open={dialog === "close"}
        title="Cerrar entrega"
        description={`¿Cerrar la entrega ${detail.number}? Después de esto Picking no puede cargar fotos.`}
        onClose={() => setDialog(null)}
      >
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            className="btn btn-primary"
            onClick={() => {
              setDialog(null);
              runAction(() => closeDeliveryAction(detail.id));
            }}
          >
            Cerrar
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
            Cancelar
          </button>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "return"}
        title="Devolver a Picking"
        description="Decí qué hay que corregir. Lo van a ver en el celular."
        onClose={() => setDialog(null)}
      >
        <form action={returnAction} className="space-y-3">
          <input type="hidden" name="deliveryId" value={detail.id} />
          <label className="block">
            <span className="label">Qué hay que corregir</span>
            <input name="reason" required minLength={3} className="field" />
          </label>
          {returnState.error ? <p className="banner banner-danger">{returnState.error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={returnPending} className="btn btn-primary">
              {returnPending ? "Devolviendo…" : "Devolver"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "reopen"}
        title="Reabrir entrega"
        description="Vuelve a Picking. Queda registrado el motivo."
        onClose={() => setDialog(null)}
      >
        <form action={reopenAction} className="space-y-3">
          <input type="hidden" name="deliveryId" value={detail.id} />
          <label className="block">
            <span className="label">Motivo</span>
            <input name="reason" required className="field" />
          </label>
          {reopenState.error ? <p className="banner banner-danger">{reopenState.error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={reopenPending} className="btn btn-primary">
              {reopenPending ? "Reabriendo…" : "Reabrir"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        title="Archivar entrega"
        description={`Se oculta la entrega sin borrar su historial ni sus fotos. Escribí ${detail.number} para confirmar.`}
        tone="danger"
        onClose={() => setDialog(null)}
      >
        <form action={deleteAction} className="space-y-3">
          <input type="hidden" name="deliveryId" value={detail.id} />
          <label className="block">
            <span className="label">Número de confirmación</span>
            <input name="confirmNumber" required autoComplete="off" className="field font-mono" />
          </label>
          {deleteState.error ? <p className="banner banner-danger">{deleteState.error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={deletePending} className="btn btn-danger">
              {deletePending ? "Archivando…" : "Archivar"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
