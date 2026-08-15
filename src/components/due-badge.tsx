import { formatDueLabel, isOverdue } from "@/lib/time";

export function DueBadge({
  dueAt,
  status,
}: {
  dueAt: string | null | undefined;
  status: string;
}) {
  const label = formatDueLabel(dueAt, status);
  if (!label) return null;
  const overdue = isOverdue(dueAt, status);
  return (
    <span
      className={
        overdue
          ? "inline-block rounded-full bg-danger/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-danger"
          : "inline-block rounded-full bg-cat/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cat"
      }
    >
      {label}
    </span>
  );
}
