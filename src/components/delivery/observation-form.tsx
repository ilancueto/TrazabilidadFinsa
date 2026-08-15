"use client";

import { useActionState } from "react";
import { addObservationAction, type ActionState } from "@/lib/actions/deliveries";

export function ObservationForm({ deliveryId }: { deliveryId: string }) {
  const [state, action, pending] = useActionState(addObservationAction, {} as ActionState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <label className="block">
        <span className="label">Nueva observación</span>
        <textarea name="text" required rows={3} placeholder="Escribí la observación" className="field" />
      </label>
      {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
      {state.success ? <p className="banner banner-ok">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-ghost">
        {pending ? "Guardando…" : "Agregar observación"}
      </button>
    </form>
  );
}
