import { cn } from "@/lib/utils";
import type { DeliveryProgress } from "@/lib/types";

export function ProgressBar({
  progress,
  size = "md",
}: {
  progress: DeliveryProgress;
  size?: "sm" | "md";
}) {
  const pct = progress.total === 0 ? 0 : Math.round((progress.complete / progress.total) * 100);
  const isComplete = progress.pendingRequired === 0 && progress.pendingDispatch === 0;

  return (
    <div className="min-w-[88px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("font-mono font-semibold tracking-tight", size === "sm" ? "text-xs text-muted" : "text-sm text-foreground")}>
          {progress.complete}/{progress.total} fotos
        </span>
        {progress.pendingRequired > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-cat/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-cat border border-cat/30">
            {progress.pendingRequired} {progress.pendingRequired === 1 ? "falta" : "faltan"}
          </span>
        ) : progress.pendingDispatch > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blue border border-blue/30">
            falta etiqueta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ok border border-ok/30">
            ✓ completo
          </span>
        )}
      </div>
      <div className={cn("overflow-hidden rounded-full bg-line/80", size === "sm" ? "h-1.5" : "h-2")}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            isComplete ? "bg-ok" : "bg-cat shadow-[0_0_8px_rgba(255,205,0,0.35)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
