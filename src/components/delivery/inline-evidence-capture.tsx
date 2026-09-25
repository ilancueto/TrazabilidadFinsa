"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareEvidenceImage } from "@/lib/evidence/compress";
import { uploadWithRetry } from "@/lib/evidence/upload-retry";

type InlineCaptureProps = {
  requirementId: string;
  deliveryNumber?: string;
  label: string;
  hasActiveEvidence: boolean;
  canCapture: boolean;
  fallbackHref?: string | null;
  isSharedBulto?: boolean;
  bultoCode?: string | null;
};

export function InlineEvidenceCapture({
  requirementId,
  label,
  hasActiveEvidence,
  canCapture,
  fallbackHref,
  isSharedBulto,
  bultoCode,
}: InlineCaptureProps) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [justSuccess, setJustSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!canCapture) return null;

  function playSuccessFeedback() {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([100, 50, 150]);
      } catch {}
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErrorMessage(null);
    setJustSuccess(false);
    setLastUploadedFile(file);

    const tempUrl = URL.createObjectURL(file);
    setPreviewUrl(tempUrl);
    await uploadSingleFile(file);
  }

  async function uploadSingleFile(file: File) {
    setUploading(true);
    setErrorMessage(null);

    try {
      setProgressText("Procesando foto…");
      const prepared = await prepareEvidenceImage(file, 0);

      setProgressText("Subiendo foto…");
      const data = new FormData();
      data.set("requirementId", requirementId);
      data.set("comment", "");
      data.set("file", prepared.file);
      data.set("width", String(prepared.width));
      data.set("height", String(prepared.height));

      const operationId = crypto.randomUUID();
      await uploadWithRetry({
        operationId,
        send: async (attempt, currentOperationId) => {
          const response = await fetch("/api/evidence", {
            method: "POST",
            body: data,
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

      playSuccessFeedback();
      setJustSuccess(true);
      router.refresh();

      // Ocultar mensaje de éxito luego de 4 segundos
      setTimeout(() => {
        setJustSuccess(false);
        setPreviewUrl(null);
      }, 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error al subir la foto");
    } finally {
      setUploading(false);
      setProgressText("");
      // Resetear inputs para permitir tomar otra foto si se requiere
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2 mt-2">
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={`Tomar foto con la cámara para ${label}`}
        disabled={uploading}
        className="sr-only"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        aria-label={`Elegir foto de la galería para ${label}`}
        disabled={uploading}
        className="sr-only"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* Uploading State Preview */}
      {uploading ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-cat/40 bg-cat/10 animate-pulse">
          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Vista previa"
              className="w-12 h-12 object-cover rounded-lg border border-line"
            />
          ) : (
            <span className="text-xl">📷</span>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{progressText}</p>
            <p className="text-xs text-muted">No cierres esta pantalla…</p>
          </div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cat border-t-transparent" />
        </div>
      ) : null}

      {/* Just Success Confirmation Banner */}
      {justSuccess ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl border border-ok/40 bg-ok/10 text-ok text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <span>✓</span>
            <span>Foto guardada con éxito</span>
            {isSharedBulto ? (
              <span className="text-[10px] text-muted font-normal">
                (compartida a bulto {bultoCode})
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => setJustSuccess(false)}
            className="text-muted hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Error Banner with Retry */}
      {errorMessage ? (
        <div className="p-3 rounded-xl border border-danger/40 bg-danger/10 text-danger text-xs space-y-2">
          <p className="font-semibold">⚠ {errorMessage}</p>
          <div className="flex items-center gap-2">
            {lastUploadedFile ? (
              <button
                type="button"
                onClick={() => uploadSingleFile(lastUploadedFile)}
                className="btn btn-danger btn-xs"
              >
                Reintentar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setPreviewUrl(null);
              }}
              className="btn btn-ghost btn-xs text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {/* Buttons */}
      {!uploading ? (
        <div className="flex items-center gap-2">
          {!hasActiveEvidence ? (
            <>
              {/* Botón Principal: Cámara Nativa Rápida */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn btn-primary flex-1 min-h-11 rounded-xl shadow-xs active:scale-[0.98] font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <span className="text-base">📷</span>
                <span>Tomar foto</span>
              </button>

              {/* Botón Secundario: Galería */}
              <button
                type="button"
                title="Elegir de galería"
                aria-label={`Elegir de galería para ${label}`}
                onClick={() => galleryInputRef.current?.click()}
                className="btn btn-ghost min-h-11 px-3.5 rounded-xl border border-line bg-surface/80 hover:bg-elevated text-muted hover:text-foreground active:scale-[0.98] transition-all flex items-center justify-center"
              >
                <span className="text-base">🖼️</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full justify-between">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn btn-ghost btn-sm rounded-lg border border-line/70 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface active:scale-[0.98] flex items-center gap-1.5"
              >
                <span>📷</span>
                <span>+ Agregar otra foto</span>
              </button>
              {fallbackHref ? (
                <a
                  href={fallbackHref}
                  className="text-[11px] text-muted hover:text-cat hover:underline transition-colors"
                >
                  Modo detallado →
                </a>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Fallback link for keyboard navigation / screen readers / legacy flows */}
      {!hasActiveEvidence && fallbackHref && !uploading ? (
        <div className="text-right">
          <a
            href={fallbackHref}
            className="text-[11px] text-muted hover:text-cat hover:underline transition-colors"
          >
            ¿Preferís el modo de carga detallado? Ir a pantalla individual →
          </a>
        </div>
      ) : null}
    </div>
  );
}
