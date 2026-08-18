"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepareEvidenceImage } from "@/lib/evidence/compress";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number;
  name: string;
  sizeText: string;
};

export function EvidenceCapture({
  requirementId,
  deliveryNumber,
  label,
  serverError,
}: {
  requirementId: string;
  deliveryNumber: string;
  label: string;
  serverError?: string;
}) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  // Limpieza de URLs al desmontar
  useEffect(() => {
    return () => {
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [pendingPhotos]);

  function handleFilesAdded(files: FileList | null) {
    if (!files || files.length === 0) return;
    setClientError(null);

    const newPhotos: PendingPhoto[] = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
      name: file.name || `foto-${idx + 1}.jpg`,
      sizeText: `${Math.round(file.size / 1024)} KB`,
    }));

    setPendingPhotos((prev) => [...prev, ...newPhotos]);

    // Resetear inputs para poder volver a seleccionar el mismo archivo si se desea
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  function rotatePhoto(id: string) {
    setPendingPhotos((prev) =>
      prev.map((photo) =>
        photo.id === id ? { ...photo, rotation: (photo.rotation + 90) % 360 } : photo,
      ),
    );
  }

  function removePhoto(id: string) {
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function submitAllEvidence(event: FormEvent) {
    event.preventDefault();
    if (pendingPhotos.length === 0 || uploading) return;

    setUploading(true);
    setClientError(null);

    try {
      const total = pendingPhotos.length;
      for (let i = 0; i < total; i++) {
        const photo = pendingPhotos[i];
        setProgressText(`Preparando foto ${i + 1} de ${total}…`);

        const prepared = await prepareEvidenceImage(photo.file, photo.rotation);

        setProgressText(`Subiendo foto ${i + 1} de ${total}…`);
        const data = new FormData();
        data.set("requirementId", requirementId);
        data.set("comment", comment.trim());
        data.set("file", prepared.file);
        data.set("width", String(prepared.width));
        data.set("height", String(prepared.height));

        const response = await fetch("/api/evidence", {
          method: "POST",
          body: data,
          headers: { Accept: "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            payload?.error || `Error al subir la foto ${i + 1} (${photo.name})`,
          );
        }
      }

      // Redirigir siempre a la pantalla general de la entrega
      router.replace(`${pickingDeliveryPath(deliveryNumber)}?uploaded=${total}`);
      router.refresh();
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "No se pudieron guardar las fotos",
      );
      setUploading(false);
      setProgressText("");
    }
  }

  return (
    <div className="space-y-4">
      {serverError || clientError ? (
        <p role="alert" className="banner banner-danger">
          {clientError || serverError}
        </p>
      ) : null}

      <div className="panel space-y-4 p-4">
        {/* Controles de captura */}
        <div>
          <p className="text-sm font-semibold text-muted">
            Agregar evidencia para <span className="text-foreground">{label}</span>:
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Botón 1: Cámara Directa (Android & iOS) */}
            <label className="btn btn-primary flex min-h-14 cursor-pointer items-center justify-center gap-2 text-center text-base font-bold shadow-sm active:scale-[0.98]">
              <span>📷 Tomar foto</span>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label={`Tomar foto con la cámara para ${label}`}
                disabled={uploading}
                className="sr-only"
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
            </label>

            {/* Botón 2: Galería / Archivos Múltiples */}
            <label className="btn btn-ghost flex min-h-14 cursor-pointer items-center justify-center gap-2 text-center text-base font-semibold active:scale-[0.98]">
              <span>🖼️ Galería / Archivos</span>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                aria-label={`Elegir fotos de la galería para ${label}`}
                disabled={uploading}
                className="sr-only"
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
            </label>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Podés sacar varias fotos o elegir múltiples archivos de la galería.
          </p>
        </div>

        {/* Bandeja de fotos seleccionadas */}
        {pendingPhotos.length > 0 ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <p className="text-sm font-bold text-cat">
                Fotos seleccionadas ({pendingPhotos.length}):
              </p>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                    setPendingPhotos([]);
                  }}
                  className="text-xs text-muted underline hover:text-danger"
                >
                  Quitar todas
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pendingPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative flex flex-col overflow-hidden rounded-md border border-line bg-surface p-2 shadow-xs"
                >
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Foto ${index + 1}`}
                      className="max-h-full max-w-full object-contain transition-transform duration-200"
                      style={{ transform: `rotate(${photo.rotation}deg)` }}
                    />
                    <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      #{index + 1}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-center text-[11px] text-muted" title={photo.name}>
                    {photo.name} ({photo.sizeText})
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => rotatePhoto(photo.id)}
                      className="btn btn-ghost !p-1 text-xs"
                      title="Girar 90°"
                      aria-label="Girar 90°"
                    >
                      🔄 90°
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removePhoto(photo.id)}
                      className="btn btn-ghost !p-1 text-xs text-danger hover:bg-danger/10"
                      title="Eliminar foto"
                      aria-label="Eliminar foto"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Formulario de subida */}
        <form onSubmit={submitAllEvidence} className="space-y-4 pt-2">
          <label className="block">
            <span className="label">Comentario para estas fotos (opcional)</span>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={uploading}
              placeholder="Ej: Remito firmado por chofer, bulto con precinto..."
              className="field"
            />
          </label>

          {uploading ? (
            <div className="space-y-2 rounded-md bg-cat/10 p-3 text-center">
              <p className="font-semibold text-cat">{progressText || "Subiendo evidencias…"}</p>
              <p className="text-xs text-muted">No salgas de esta pantalla hasta que termine.</p>
            </div>
          ) : (
            <button
              type="submit"
              disabled={pendingPhotos.length === 0 || uploading}
              className="btn btn-primary btn-block btn-lg shadow-md"
            >
              {pendingPhotos.length === 0
                ? "Elegí o sacá una foto para subir"
                : pendingPhotos.length === 1
                  ? "Subir 1 foto"
                  : `Subir ${pendingPhotos.length} fotos juntas`}
            </button>
          )}
        </form>
      </div>

      <a href={pickingDeliveryPath(deliveryNumber)} className="btn btn-ghost btn-block">
        ← Volver a la entrega
      </a>
    </div>
  );
}

