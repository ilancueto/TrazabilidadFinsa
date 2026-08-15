"use client";

import { useActionState } from "react";
import { closeReadyBatchAction, type ActionState } from "@/lib/actions/deliveries";

export function BulkCloseForm({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(closeReadyBatchAction, {} as ActionState);
  if (!enabled) return <>{children}</>;
  return (
    <form action={action} className="space-y-3">
      {children}
      {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
      {state.success ? <p className="banner banner-ok">{state.success}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Cerrando…" : "Cerrar las marcadas"}
      </button>
    </form>
  );
}
