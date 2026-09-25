import { STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "@/lib/types";

const STYLES: Record<DeliveryStatus, { pill: string; dot: string }> = {
  DRAFT: {
    pill: "border-line/70 bg-elevated/40 text-muted",
    dot: "bg-muted",
  },
  PUBLISHED: {
    pill: "border-cat/35 bg-cat/10 text-cat",
    dot: "bg-cat",
  },
  IN_PICKING: {
    pill: "border-blue/35 bg-blue/15 text-blue",
    dot: "bg-blue",
  },
  READY: {
    pill: "border-ok/35 bg-ok/15 text-ok",
    dot: "bg-ok",
  },
  CLOSED: {
    pill: "border-line/80 bg-paper/60 text-muted",
    dot: "bg-muted/70",
  },
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] shadow-xs",
        style.pill,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
