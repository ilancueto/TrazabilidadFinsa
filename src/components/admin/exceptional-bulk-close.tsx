"use client";

import { useActionState, useCallback, useState } from "react";
import { Dialog } from "@/components/ui-dialog";
import { bulkCloseReadyAction, type BulkCloseState } from "@/lib/actions/bulk-close";

export function ExceptionalBulkClose({ activeCount }: { activeCount: number }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState(bulkCloseReadyAction, {} as BulkCloseState);
  const enabled = confirmation === "CERRAR TODAS" && !pending;

  const closeDialog = useCallback(() => {
    if (!pending) setOpen(false);
  }, [pending]);

  return (
    <details className="group rounded-2xl border border-danger/30 bg-gradient-to-r from-danger/10 via-card to-card p-3 sm:p-4 text-xs transition-all duration-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-danger select-none">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger/20 text-[11px] font-black">⚠</span>
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Herramienta de contingencia · Cierre masivo extraordinario</span>
        </span>
        <span className="text-muted group-open:rotate-180 transition-transform text-xs sm:text-sm">▼</span>
      </summary>
      <div className="mt-3 pt-3 border-t border-danger/20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground text-sm">Cierre administrativo forzado</h2>
          <p className="mt-0.5 text-xs text-muted max-w-xl">Herramienta de contingencia. Fuerza el cierre a CLOSED de todas las entregas activas sin respetar el flujo normal. Queda registrado en auditoría.</p>
        </div>
        <button type="button" className="btn btn-danger btn-sm rounded-xl font-bold active:scale-[0.98]" disabled={activeCount === 0} onClick={() => setOpen(true)}>
          Cerrar todas las activas ({activeCount})
        </button>
      </div>
      {state.success ? <p className="mt-3 banner banner-ok">{state.success}</p> : null}
      {state.error ? <p className="mt-3 banner banner-danger">{state.error}</p> : null}

      <Dialog
        open={open}
        tone="danger"
        title="Cierre excepcional forzado"
        description={`Se intentarán cerrar ${activeCount} entrega${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}, sin importar su estado actual.`}
        onClose={closeDialog}
      >
        <form action={action} className="space-y-4">
          <div className="banner banner-danger">
            <strong>Uso exclusivamente excepcional.</strong> Esta acción fuerza a CLOSED todas las entregas no archivadas que aún estén abiertas, incluso si están en borrador, publicadas, en picking o listas, y aunque tengan fotos, etiquetas u observaciones pendientes. El evento queda registrado en auditoría con tu usuario, el estado anterior y el motivo.
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
              autoCapitalize="characters"
              className="field font-mono"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
              placeholder="CERRAR TODAS"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={closeDialog}>Cancelar</button>
            <button type="submit" className="btn btn-danger" disabled={!enabled}>{pending ? "Cerrando…" : `Sí, forzar cierre de ${activeCount}`}</button>
          </div>
        </form>
      </Dialog>
    </details>
  );
}
