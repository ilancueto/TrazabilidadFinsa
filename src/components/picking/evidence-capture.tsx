"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepareEvidenceImage } from "@/lib/evidence/compress";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";
import { uploadWithRetry } from "@/lib/evidence/upload-retry";

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

  async function uploadPhotoWithRetry(formData: FormData): Promise<void> {
    const operationId = crypto.randomUUID();
    await uploadWithRetry({
      operationId,
      send: async (attempt, currentOperationId) => {
        const response = await fetch("/api/evidence", {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
            "X-Upload-Attempt": String(attempt),
            "X-Upload-Operation-Id": currentOperationId,
          },
        });

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.error || `Error del servidor (${response.status})`);
        }
      },
      wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    });
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
        <p role="alert" className="banner banner-danger rounded-xl">
          {clientError || serverError}
        </p>
      ) : null}

      <div className="panel space-y-4 p-4 sm:p-5 rounded-2xl border-line/80 shadow-sm">
        {/* Controles de captura */}
        <div>
          <p className="text-sm font-semibold text-muted">
            Agregar evidencia para <span className="text-foreground font-bold">{label}</span>:
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Botón 1: Cámara Directa (Android & iOS) */}
            <label className="btn btn-primary flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl text-center text-base font-bold shadow-md shadow-cat/15 active:scale-[0.98] transition-all">
              <span className="text-lg">📷</span>
              <span>Tomar foto</span>
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
            <label className="btn btn-ghost flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface/80 text-center text-base font-semibold hover:bg-elevated hover:border-cat/40 active:scale-[0.98] transition-all">
              <span className="text-lg">🖼️</span>
              <span>Galería / Archivos</span>
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
                  className="relative flex flex-col overflow-hidden rounded-xl border border-line/90 bg-elevated/70 p-2 shadow-xs transition-all hover:border-cat/40"
                >
                  <button
                    type="button"
                    onClick={() => setZoomedPhoto(photo)}
                    className="group relative flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg bg-black/90"
                    title="Tocar para ampliar y revisar nitidez"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Foto ${index + 1}`}
                      className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                      style={{ transform: `rotate(${photo.rotation}deg)` }}
                    />
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      #{index + 1}
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-medium text-cat opacity-90 shadow-xs group-hover:opacity-100">
                      🔍 Ampliar
                    </span>
                  </button>

                  <p className="mt-1.5 truncate text-center text-[11px] font-medium text-muted" title={photo.name}>
                    {photo.name} ({photo.sizeText})
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => rotatePhoto(photo.id)}
                      className="btn btn-ghost !p-1 text-xs rounded-lg border border-line/60 hover:bg-surface"
                      title="Girar 90°"
                      aria-label="Girar 90°"
                    >
                      🔄 90°
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removePhoto(photo.id)}
                      className="btn btn-ghost !p-1 text-xs rounded-lg text-danger border border-line/60 hover:border-danger/30 hover:bg-danger/10"
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
            <span className="label font-medium">Comentario para estas fotos (opcional)</span>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={uploading}
              placeholder="Ej: Remito firmado por chofer, bulto con precinto..."
              className="field rounded-xl"
            />
          </label>

          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-cat/30 bg-cat/10 p-4 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cat border-t-transparent" />
              <p className="font-bold text-cat">{progressText || "Subiendo evidencias…"}</p>
              <p className="text-xs text-muted">No salgas de esta pantalla hasta que termine.</p>
            </div>
          ) : (
            <button
              type="submit"
              disabled={pendingPhotos.length === 0 || uploading}
              className="btn btn-primary btn-block btn-lg rounded-xl font-bold shadow-md shadow-cat/15 active:scale-[0.98] transition-all"
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

      <a href={pickingDeliveryPath(deliveryNumber)} className="btn btn-ghost btn-block rounded-xl border border-line/70">
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
            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden bg-black/95 p-3 rounded-2xl border border-line/80 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedPhoto.previewUrl}
                alt={zoomedPhoto.name}
                className="max-h-[70vh] max-w-full object-contain transition-transform duration-200"
                style={{ transform: `rotate(${zoomedPhoto.rotation}deg)` }}
              />
            </div>

            <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-surface/90 backdrop-blur-md p-2.5 border border-line/80">
              <button
                type="button"
                onClick={() => rotatePhoto(zoomedPhoto.id)}
                className="btn btn-ghost !border-line !text-white text-xs rounded-lg"
              >
                🔄 Girar 90°
              </button>

              <p className="text-center text-xs text-foreground/90 font-medium truncate max-w-[200px]">
                {zoomedPhoto.name} ({zoomedPhoto.sizeText})
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => removePhoto(zoomedPhoto.id)}
                  className="btn btn-danger btn-sm text-xs rounded-lg"
                >
                  🗑️ Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setZoomedPhoto(null)}
                  className="btn btn-primary btn-sm px-4 text-xs font-bold rounded-lg shadow-sm"
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
