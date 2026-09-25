import { PRIORITY_LABEL } from "@/lib/constants";
import type { DeliveryPriority } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: DeliveryPriority }) {
  if (priority === "NORMAL") {
    return (
      <span className="inline-flex items-center rounded-full border border-line/60 bg-elevated/40 px-2.5 py-0.5 text-[10px] font-semibold text-muted shadow-xs">
        {PRIORITY_LABEL[priority]}
      </span>
    );
  }
  if (priority === "URGENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cat/40 bg-cat/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-cat shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-cat animate-pulse shrink-0" aria-hidden="true" />
        Urgente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-danger shadow-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-danger shrink-0" aria-hidden="true" />
      Alta
    </span>
  );
}
