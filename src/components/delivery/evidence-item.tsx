"use client";

import { useActionState, useState } from "react";
import { PhotoThumb } from "@/components/photo-lightbox";
import { Dialog } from "@/components/ui-dialog";
import { voidEvidenceAction, type EvidenceActionState } from "@/lib/actions/evidence";

export function EvidenceItem({
  evidenceId,
  src,
  alt,
  caption,
  canVoid,
}: {
  evidenceId: string;
  src: string;
  alt: string;
  caption: string;
  canVoid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: EvidenceActionState, formData: FormData) => {
    const result = await voidEvidenceAction(previous, formData);
    if (result.success) setOpen(false);
    return result;
  }, {} as EvidenceActionState);

  return (
    <div className="space-y-1.5">
      <PhotoThumb src={src} thumbSrc={`${src}?variant=thumb`} alt={alt} caption={caption} />
      {canVoid ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm w-full text-danger">
          Anular
        </button>
      ) : null}
      <Dialog
        open={open}
        title="Anular foto"
        description="La foto deja de contar. Hay que cargar otra."
        tone="danger"
        onClose={() => setOpen(false)}
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="evidenceId" value={evidenceId} />
          <label className="block">
            <span className="label">Motivo</span>
            <input name="reason" required minLength={2} placeholder="Ej. foto borrosa" className="field" />
          </label>
          {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn btn-danger">
              {pending ? "Anulando…" : "Confirmar"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
