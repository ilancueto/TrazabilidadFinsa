"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepareEvidenceImage } from "@/lib/evidence/compress";

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
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading">("idle");
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || uploading) return;
    const form = event.currentTarget;

    setUploading(true);
    setClientError(null);
    setPhase("preparing");

    try {
      const prepared = await prepareEvidenceImage(selectedFile);
      const data = new FormData(form);
      data.set("file", prepared.file);
      data.set("width", String(prepared.width));
      data.set("height", String(prepared.height));

      setPhase("uploading");
      const response = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        nextRequirementId?: string | null;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la foto");
      }

      const nextId = payload?.nextRequirementId;
      router.replace(
        nextId ? `/picking/${deliveryId}/${nextId}?uploaded=1` : `/picking/${deliveryId}?uploaded=1`,
      );
      router.refresh();
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "No se pudo guardar la foto");
      setUploading(false);
      setPhase("idle");
    }
  }

  return (
    <div className="space-y-4">
      {serverError || clientError ? (
        <p role="alert" className="banner banner-danger">
          {clientError || serverError}
        </p>
      ) : null}

      <form
        action="/api/evidence"
        method="post"
        encType="multipart/form-data"
        className="panel space-y-4 p-4"
        onSubmit={submitEvidence}
      >
        <input type="hidden" name="requirementId" value={requirementId} />
        <input type="hidden" name="next" value={`/picking/${deliveryId}`} />
        <input type="hidden" name="returnTo" value={`/picking/${deliveryId}/${requirementId}`} />

        <div className="relative">
          <div className={fileName ? "file-drop file-drop-on" : "file-drop"}>
            <p className="text-xl font-bold">{fileName ? "Cambiar foto" : "Elegir o sacar foto"}</p>
            <p className="mt-2 text-sm text-muted">Tocá acá para abrir la cámara o la galería.</p>
          </div>
          <input
            type="file"
            name="file"
            accept="image/*"
            aria-label={`Elegir foto de ${label}`}
            required
            disabled={uploading}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            style={{ fontSize: 48 }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setSelectedFile(file ?? null);
              setClientError(null);
              setFileName(file ? `${file.name || "foto"} (${Math.round(file.size / 1024)} KB)` : "");
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
          />
        </div>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Vista previa"
            className="max-h-72 w-full border border-line bg-black object-contain"
          />
        ) : null}

        {fileName ? (
          <p className="banner banner-ok">Lista: {fileName}</p>
        ) : (
          <p className="text-sm text-muted">Todavía no hay foto.</p>
        )}

        <label className="block">
          <span className="label">Comentario (opcional)</span>
          <input name="comment" className="field" />
        </label>

        <button type="submit" disabled={!selectedFile || uploading} className="btn btn-primary btn-block btn-lg">
          {phase === "preparing" ? "Preparando foto…" : phase === "uploading" ? "Subiendo…" : "Subir foto"}
        </button>
        {uploading ? (
          <p className="text-center text-xs text-muted">No cierres esta pantalla hasta que termine.</p>
        ) : null}
      </form>

      <a href={`/picking/${deliveryId}`} className="btn btn-ghost btn-block">
        Volver a la entrega
      </a>
    </div>
  );
}
