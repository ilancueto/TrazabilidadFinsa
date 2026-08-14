"use client";

import { useState } from "react";

export function EvidenceCapture({
  requirementId,
  deliveryId,
  label,
  serverError,
}: {
  requirementId: string;
  deliveryId: string;
  label: string;
  serverError?: string;
}) {
  const [fileName, setFileName] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Requisito: {label}</p>

      {serverError ? <p className="rounded-md bg-cat/30 px-3 py-2 text-sm">{serverError}</p> : null}

      <form
        action="/api/evidence"
        method="post"
        encType="multipart/form-data"
        className="space-y-3 rounded-md border border-line bg-white p-4"
      >
        <input type="hidden" name="requirementId" value={requirementId} />
        <input type="hidden" name="next" value={`/picking/${deliveryId}`} />
        <input type="hidden" name="returnTo" value={`/picking/${deliveryId}/${requirementId}`} />

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">1. Tomar o elegir la foto</span>
          <input
            type="file"
            name="file"
            accept="image/*"
            required
            className="block w-full py-3 text-base"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file ? `${file.name || "foto"} (${Math.round(file.size / 1024)} KB)` : "");
            }}
          />
        </label>

        {fileName ? (
          <p className="text-sm">Lista para subir: {fileName}</p>
        ) : (
          <p className="text-sm text-muted">
            En el celular: “Tomar foto” o “Fototeca”. Después tocá Subir foto.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-muted">
            Comentario (opcional)
          </span>
          <input name="comment" className="w-full rounded-md border border-line px-3 py-3 text-base" />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-cat py-5 text-base font-bold text-ink"
        >
          2. Subir foto
        </button>
      </form>

      <a
        href={`/picking/${deliveryId}`}
        className="block w-full rounded-md border border-line py-3 text-center text-sm font-semibold"
      >
        Volver al checklist
      </a>
    </div>
  );
}
