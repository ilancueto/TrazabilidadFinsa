"use client";

import { useActionState } from "react";
import { reviewEvidenceAction, type EvidenceActionState } from "@/lib/actions/evidence";

export function ReviewPhotoActions({
  evidenceId,
  status,
}: {
  evidenceId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(reviewEvidenceAction, {} as EvidenceActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <input name="note" aria-label="Nota de revisión" placeholder="Nota (obligatoria si no sirve)" className="field py-2 text-xs" />
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="ACCEPTED"
          disabled={pending}
          className="btn btn-ok btn-sm flex-1"
        >
          Sirve
        </button>
        <button
          type="submit"
          name="decision"
          value="REJECTED"
          disabled={pending}
          className="btn btn-danger btn-sm flex-1"
        >
          No sirve
        </button>
      </div>
      {status === "REJECTED" ? <p className="text-[11px] font-bold uppercase text-danger">Rechazada</p> : null}
      {status === "ACCEPTED" ? <p className="text-[11px] font-bold uppercase text-ok">Aceptada</p> : null}
      {state.error ? <p className="text-[11px] text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-[11px] text-ok">{state.success}</p> : null}
    </form>
  );
}
