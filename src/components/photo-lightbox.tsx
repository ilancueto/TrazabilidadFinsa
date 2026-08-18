"use client";

import { useEffect, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = thumbRef.current;
    if (!node || loadedSrc) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setLoadedSrc(thumbSrc ?? src);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, thumbSrc, loadedSrc]);

  useEffect(() => {
    if (!open) return;
    const trigger = thumbRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const [rotation, setRotation] = useState(0);

  return (
    <>
      <button
        ref={thumbRef}
        type="button"
        onClick={() => {
          setLoadedSrc(src);
          setRotation(0);
          setOpen(true);
        }}
        className="block w-full overflow-hidden border border-line bg-black text-left"
      >
        {loadedSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loadedSrc} alt={alt} loading="lazy" decoding="async" className="h-28 w-full object-cover" />
        ) : (
          <span className="grid h-28 place-items-center text-xs font-semibold text-muted">Foto</span>
        )}
        {caption ? <span className="block px-2 py-1.5 text-[11px] text-muted">{caption}</span> : null}
      </button>
      {open ? (
        <div className="dialog-back" role="dialog" aria-modal="true" aria-label="Foto" onClick={() => setOpen(false)}>
          <figure className="flex flex-col items-center w-full max-w-3xl px-4 pb-6 sm:px-0" onClick={(event) => event.stopPropagation()}>
            <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden bg-black p-2 rounded">
              {loadedSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={loadedSrc}
                  alt={alt}
                  className="max-h-[70vh] max-w-full object-contain transition-transform duration-200"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
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
