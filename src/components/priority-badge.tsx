import { PRIORITY_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DeliveryPriority } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: DeliveryPriority }) {
  if (priority === "NORMAL") {
    return <span className="text-xs text-muted">{PRIORITY_LABEL[priority]}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide",
        priority === "URGENT" ? "text-ink" : "text-danger",
      )}
    >
      {priority === "URGENT" ? (
        <span className="inline-flex items-center gap-1 rounded-sm bg-cat px-1.5 py-0.5 text-ink">
          <span aria-hidden>▲</span> {PRIORITY_LABEL[priority]}
        </span>
      ) : (
        <span className="rounded-sm border border-danger/40 px-1.5 py-0.5">
          {PRIORITY_LABEL[priority]}
        </span>
      )}
    </span>
  );
}
