"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@/components/ui-dialog";
import { bulkCloseReadyAction, type BulkCloseState } from "@/lib/actions/bulk-close";

export function ExceptionalBulkClose({ readyCount }: { readyCount: number }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(bulkCloseReadyAction, {} as BulkCloseState);
  const enabled = confirmation === "CERRAR TODAS" && !pending;

  return (
    <section className="panel border border-danger/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-danger">Acciones excepcionales</p>
          <h2 className="mt-1 font-semibold">Cierre masivo administrativo</h2>
          <p className="mt-1 text-sm text-muted">Herramienta de contingencia. No reemplaza la revisión normal de cada entrega.</p>
        </div>
        <button type="button" className="btn btn-danger" disabled={readyCount === 0} onClick={() => setOpen(true)}>
          Cerrar todas las listas ({readyCount})
        </button>
      </div>
      {state.success ? <p className="mt-3 banner banner-ok">{state.success}</p> : null}
      {state.error ? <p className="mt-3 banner banner-danger">{state.error}</p> : null}

      <Dialog
        open={open}
        tone="danger"
        title="Cierre excepcional"
        description={`Hay ${readyCount} entrega${readyCount === 1 ? "" : "s"} en estado Lista. Sólo se cerrarán las que cumplan las reglas normales.`}
        onClose={() => !pending && setOpen(false)}
      >
        <form action={action} className="space-y-4">
          <div className="banner banner-danger">
            <strong>Uso excepcional.</strong> Esta acción puede cerrar varias entregas de una sola vez. No la uses para saltear fotos, etiquetas u observaciones pendientes. Cada cierre quedará registrado en auditoría con tu usuario y el motivo.
          </div>
          <label className="block">
            <span className="label">Motivo obligatorio</span>
            <textarea name="reason" required minLength={5} className="field min-h-24" placeholder="Ej.: cierre administrativo extraordinario por contingencia operativa" />
          </label>
          <label className="block">
            <span className="label">Para confirmar, escribí CERRAR TODAS</span>
            <input
              name="confirmation"
              required
              autoComplete="off"
              className="field font-mono"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="CERRAR TODAS"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-danger" disabled={!enabled}>{pending ? "Cerrando…" : `Sí, cerrar hasta ${readyCount}`}</button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
