"use client";

import { useActionState } from "react";
import { assignUnassignedAction, type ActionState } from "@/lib/actions/deliveries";
import type { Profile } from "@/lib/types";

export function AssignUnassigned({ pickers, count }: { pickers: Profile[]; count: number }) {
  const [state, action, pending] = useActionState(assignUnassignedAction, {} as ActionState);
  return (
    <form action={action} className="panel-warn panel flex flex-wrap items-end gap-3 p-4">
      <p className="text-sm">
        Hay <span className="font-semibold">{count}</span> entrega{count === 1 ? "" : "s"} sin
        responsable.
      </p>
      <label className="min-w-48 flex-1">
        <span className="label">Asignarlas a</span>
        <select name="assigneeId" required className="field">
          <option value="">Elegí a alguien</option>
          {pickers.map((picker) => (
            <option key={picker.id} value={picker.id}>
              {picker.full_name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Asignando…" : "Asignar libres"}
      </button>
      {state.error ? <p className="w-full banner banner-danger">{state.error}</p> : null}
      {state.success ? <p className="w-full banner banner-ok">{state.success}</p> : null}
    </form>
  );
}
