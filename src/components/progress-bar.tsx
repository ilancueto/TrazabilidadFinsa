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
  return (
    <div className="min-w-[88px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("font-mono font-semibold", size === "sm" ? "text-xs" : "text-sm")}>
          {progress.complete}/{progress.total}
        </span>
        {progress.pendingRequired > 0 ? (
          <span className="text-[10px] font-bold uppercase text-cat">{progress.pendingRequired} falta</span>
        ) : (
          <span className="text-[10px] font-bold uppercase text-ok">listo</span>
        )}
      </div>
      <div className={cn("overflow-hidden bg-line", size === "sm" ? "h-1" : "h-1.5")}>
        <div
          className={cn("h-full", progress.pendingRequired > 0 ? "bg-cat" : "bg-ok")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
