"use client";

import { useEffect, useRef, useState } from "react";
import { useSaveData } from "@/components/use-save-data";

export function PhotoThumb({
  src,
  alt,
  caption,
  thumbSrc,
}: {
  src: string;
  alt: string;
  caption?: string;
  thumbSrc?: string;
}) {
  const saveData = useSaveData();
  const preview = thumbSrc && thumbSrc !== src ? thumbSrc : null;
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [wantOriginal, setWantOriginal] = useState(false);
  const [originalReady, setOriginalReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (saveData || loaded) return;
    const node = thumbRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setLoaded(preview ?? src);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [saveData, preview, src, loaded]);

  useEffect(() => {
    if (!wantOriginal || originalReady) return;
    const image = new Image();
    image.onload = () => setOriginalReady(true);
    image.onerror = () => setOriginalReady(true);
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [wantOriginal, originalReady, src]);

  useEffect(() => {
    if (!open) return;
    const trigger = thumbRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setRotation((r) => (r + 90) % 360);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const displaySrc = wantOriginal && originalReady ? src : loaded ?? (open ? preview ?? src : null);

  function openPhoto() {
    setRotation(0);
    setWantOriginal(false);
    setOriginalReady(false);
    const next = preview ?? src;
    setLoaded(next);
    setOpen(true);
  }

  return (
    <>
      <button
        ref={thumbRef}
        type="button"
        onClick={openPhoto}
        className="block w-full overflow-hidden border border-line bg-black text-left"
      >
        {loaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loaded} alt={alt} decoding="async" loading="lazy" className="h-28 w-full object-cover" />
        ) : (
          <span className="grid h-28 place-items-center bg-black px-2 text-center text-xs font-semibold text-muted">
            Ver foto
          </span>
        )}
        {caption ? <span className="block px-2 py-1.5 text-[11px] text-muted">{caption}</span> : null}
      </button>
      {open ? (
        <div className="dialog-back" role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setOpen(false)}>
          <figure className="flex w-full max-w-3xl flex-col items-center px-4 pb-6 sm:px-0" onClick={(event) => event.stopPropagation()}>
            <div className="relative flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded bg-black p-2">
              {displaySrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displaySrc}
                  alt={alt}
                  className="max-h-[70vh] max-w-full object-contain transition-transform duration-200"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              ) : (
                <span className="inline-block h-8 w-8 animate-pulse rounded-full border-2 border-line border-t-cat" />
              )}
              {wantOriginal && !originalReady ? (
                <span className="absolute inline-block h-8 w-8 animate-pulse rounded-full border-2 border-line border-t-cat" />
              ) : null}
            </div>

            <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="btn btn-ghost !border-line !text-white flex items-center gap-1.5 text-xs font-medium"
              >
                <span>🔄 Girar 90°</span>
                {rotation > 0 ? <span className="opacity-75">({rotation}°)</span> : null}
              </button>

              {preview ? (
                <button
                  type="button"
                  onClick={() => setWantOriginal(true)}
                  disabled={wantOriginal && originalReady}
                  className="btn btn-ghost !border-line !text-white text-xs font-medium"
                >
                  {wantOriginal && !originalReady
                    ? "Cargando original…"
                    : wantOriginal && originalReady
                      ? "Original"
                      : "Alta calidad"}
                </button>
              ) : null}

              {caption ? (
                <figcaption className="text-center text-xs text-white/80">{caption}</figcaption>
              ) : null}

              <button
                ref={closeButton}
                type="button"
                className="btn btn-primary btn-sm px-6"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </figure>
        </div>
      ) : null}
    </>
  );
}
