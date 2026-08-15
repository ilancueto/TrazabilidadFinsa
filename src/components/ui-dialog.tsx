"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({
  open,
  title,
  description,
  tone = "default",
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  tone?: "default" | "danger";
  children: ReactNode;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-back" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onClick={onClose}>
      <div ref={panel} className={tone === "danger" ? "dialog dialog-danger" : "dialog"} onClick={(event) => event.stopPropagation()}>
        <header className="dialog-head">
          <div>
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {description ? <p id={descriptionId} className="dialog-desc">{description}</p> : null}
          </div>
          <button ref={close} type="button" className="dialog-x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
