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

  const [zoomedPhoto, setZoomedPhoto] = useState<PendingPhoto | null>(null);

  // Limpieza de URLs al desmontar
  useEffect(() => {
    return () => {
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [pendingPhotos]);

  function playSuccessFeedback() {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([100, 50, 150]);
      } catch {}
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  }

  async function uploadPhotoWithRetry(formData: FormData, maxRetries = 3): Promise<void> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await fetch("/api/evidence", {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.error || `Error del servidor (${response.status})`);
        }
        return;
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        // Backoff exponencial ante microcortes: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

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
    if (zoomedPhoto?.id === id) {
      setZoomedPhoto((prev) => (prev ? { ...prev, rotation: (prev.rotation + 90) % 360 } : null));
    }
  }

  function removePhoto(id: string) {
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    if (zoomedPhoto?.id === id) setZoomedPhoto(null);
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

        await uploadPhotoWithRetry(data);
      }

      playSuccessFeedback();

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
                  <button
                    type="button"
                    onClick={() => setZoomedPhoto(photo)}
                    className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-black cursor-zoom-in group"
                    title="Tocar para ampliar y revisar nitidez"
                  >
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
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-cat opacity-80 group-hover:opacity-100">
                      🔍 Ampliar
                    </span>
                  </button>

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

      {/* Modal de Zoom e Inspección de nitidez previa */}
      {zoomedPhoto ? (
        <div
          className="dialog-back"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa ampliada"
          onClick={() => setZoomedPhoto(null)}
        >
          <figure
            className="flex flex-col items-center w-full max-w-3xl px-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden bg-black p-2 rounded shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedPhoto.previewUrl}
                alt={zoomedPhoto.name}
                className="max-h-[70vh] max-w-full object-contain transition-transform duration-200"
                style={{ transform: `rotate(${zoomedPhoto.rotation}deg)` }}
              />
            </div>

            <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => rotatePhoto(zoomedPhoto.id)}
                className="btn btn-ghost !border-line !text-white text-xs"
              >
                🔄 Girar 90°
              </button>

              <p className="text-center text-xs text-white/90 truncate max-w-[200px]">
                {zoomedPhoto.name} ({zoomedPhoto.sizeText})
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => removePhoto(zoomedPhoto.id)}
                  className="btn btn-danger btn-sm text-xs"
                >
                  🗑️ Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setZoomedPhoto(null)}
                  className="btn btn-primary btn-sm px-4 text-xs font-bold"
                >
                  Listo
                </button>
              </div>
            </div>
          </figure>
        </div>
      ) : null}
    </div>
  );
}

