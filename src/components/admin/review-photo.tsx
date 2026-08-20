"use client";

import { useActionState } from "react";
import { reviewEvidenceAction, type EvidenceActionState } from "@/lib/actions/evidence";
import { ReviewMarkupEditor } from "@/components/review-markup";
import { parseReviewMarkup, type ReviewMarkup } from "@/lib/deliveries/stages";

export function ReviewPhotoActions({
  evidenceId,
  status,
  src,
  markup,
}: {
  evidenceId: string;
  status: string;
  src: string;
  markup?: ReviewMarkup | null;
}) {
  const [state, action, pending] = useActionState(reviewEvidenceAction, {} as EvidenceActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <ReviewMarkupEditor src={src} alt="Marcar foto" initial={parseReviewMarkup(markup)} />
      <input name="note" aria-label="Nota de revisión" placeholder="Nota (obligatoria si no sirve)" className="field py-2 text-xs" />
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="ACCEPTED"
          disabled={pending}
          className="btn btn-ok btn-sm flex-1"
          title="Aceptar evidencia"
        >
          ✓ Sirve
        </button>
        <button
          type="submit"
          name="decision"
          value="REJECTED"
          disabled={pending}
          className="btn btn-danger btn-sm flex-1"
          title="Rechazar evidencia y solicitar corrección"
        >
          ✕ No sirve
        </button>
      </div>
      {status === "REJECTED" ? <p className="text-[11px] font-bold uppercase text-danger">Rechazada</p> : null}
      {status === "ACCEPTED" ? <p className="text-[11px] font-bold uppercase text-ok">Aceptada</p> : null}
      {state.error ? <p className="text-[11px] text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-[11px] text-ok">{state.success}</p> : null}
    </form>
  );
}
