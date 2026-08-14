import { formatDateTime } from "@/lib/utils";
import type { DeliveryDetail } from "@/lib/types";

export function Timeline({ audit }: { audit: DeliveryDetail["audit"] }) {
  return (
    <section className="rounded-md border border-line bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">Historial</h2>
      {audit.length === 0 ? (
        <p className="text-sm text-muted">Sin eventos todavía.</p>
      ) : (
        <ol className="space-y-2">
          {audit.map((event) => (
            <li key={event.id} className="grid grid-cols-[110px_1fr] gap-3 text-sm">
              <span className="font-mono text-[11px] text-muted">
                {formatDateTime(event.created_at)}
              </span>
              <span>
                <span className="font-semibold">{event.action}</span>
                <span className="text-muted"> · {event.actor_name ?? "sistema"}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
