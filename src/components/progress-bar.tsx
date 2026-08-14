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
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn("font-mono font-semibold", size === "sm" ? "text-xs" : "text-sm")}>
          {progress.complete}/{progress.total}
        </span>
        {progress.pendingRequired > 0 ? (
          <span className="text-[10px] font-semibold uppercase text-danger">
            {progress.pendingRequired} crit.
          </span>
        ) : null}
      </div>
      <div className={cn("overflow-hidden rounded-full bg-line", size === "sm" ? "h-1.5" : "h-2")}>
        <div
          className={cn("h-full rounded-full", progress.pendingRequired > 0 ? "bg-cat" : "bg-ok")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
