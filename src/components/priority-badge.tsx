import { PRIORITY_LABEL } from "@/lib/constants";
import type { DeliveryPriority } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: DeliveryPriority }) {
  if (priority === "NORMAL") {
    return <span className="text-xs text-muted">{PRIORITY_LABEL[priority]}</span>;
  }
  if (priority === "URGENT") {
    return (
      <span className="inline-flex items-center rounded-full bg-cat/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-cat">
        Urgente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-danger/50 bg-danger/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-danger">
      Alta
    </span>
  );
}
