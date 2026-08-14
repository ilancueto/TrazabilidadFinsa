import { STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "@/lib/types";

const STYLES: Record<DeliveryStatus, string> = {
  DRAFT: "bg-line text-ink",
  PUBLISHED: "bg-anthracite text-white",
  IN_PICKING: "bg-cat text-ink",
  READY: "bg-ok text-white",
  CLOSED: "border border-line bg-white text-muted",
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
