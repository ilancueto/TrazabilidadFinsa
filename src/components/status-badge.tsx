import { STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "@/lib/types";

const STYLES: Record<DeliveryStatus, string> = {
  DRAFT: "border border-line bg-paper text-muted",
  PUBLISHED: "border border-line bg-elevated text-fg",
  IN_PICKING: "bg-blue/20 text-blue",
  READY: "bg-ok/20 text-ok",
  CLOSED: "bg-line/70 text-muted",
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]",
        STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
