"use client";

import { useActionState } from "react";
import { addObservationAction, type ActionState } from "@/lib/actions/deliveries";

export function ObservationForm({ deliveryId }: { deliveryId: string }) {
  const [state, action, pending] = useActionState(addObservationAction, {} as ActionState);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <textarea
        name="text"
        required
        rows={3}
        placeholder="Describí la observación"
        className="w-full rounded-md border border-line px-3 py-2"
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-ok">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Agregar observación"}
      </button>
    </form>
  );
}
