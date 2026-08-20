"use client";

import { useRef, useState } from "react";
import type { ReviewMarkup, ReviewMarkupBox } from "@/lib/deliveries/stages";

export function MarkupOverlay({ markup }: { markup: ReviewMarkup | null | undefined }) {
  if (!markup?.boxes.length) return null;
  return (
    <>
      {markup.boxes.map((box, index) => (
        <span
          key={index}
          className="pointer-events-none absolute border-2 border-danger bg-danger/15"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          }}
        />
      ))}
    </>
  );
}

export function ReviewMarkupEditor({
  src,
  alt,
  initial,
}: {
  src: string;
  alt: string;
  initial?: ReviewMarkup | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [boxes, setBoxes] = useState<ReviewMarkupBox[]>(initial?.boxes ?? []);
  const [draft, setDraft] = useState<ReviewMarkupBox | null>(null);

  function point(event: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(event: React.PointerEvent) {
    event.preventDefault();
    wrapRef.current?.setPointerCapture(event.pointerId);
    origin.current = point(event);
    setDraft({ x: origin.current.x, y: origin.current.y, w: 0, h: 0 });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!origin.current) return;
    const next = point(event);
    setDraft({
      x: Math.min(origin.current.x, next.x),
      y: Math.min(origin.current.y, next.y),
      w: Math.abs(next.x - origin.current.x),
      h: Math.abs(next.y - origin.current.y),
    });
  }

  function onPointerUp() {
    if (draft && draft.w > 0.03 && draft.h > 0.03) setBoxes((current) => [...current, draft]);
    origin.current = null;
    setDraft(null);
  }

  const visible = { boxes: draft ? [...boxes, draft] : boxes };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted">Arrastrá un recuadro sobre lo que está mal. Opcional, pero ayuda en el piso.</p>
      <div
        ref={wrapRef}
        className="relative overflow-hidden border border-line bg-black touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="pointer-events-none block max-h-64 w-full object-contain" />
        <MarkupOverlay markup={visible} />
      </div>
      <input type="hidden" name="markup" value={JSON.stringify(visible)} />
      {boxes.length > 0 ? (
        <button type="button" className="btn-text" onClick={() => setBoxes([])}>
          Borrar recuadros
        </button>
      ) : null}
    </div>
  );
}
