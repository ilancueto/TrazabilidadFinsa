import { presentAuditEvent } from "@/lib/audit/presentation";
import { formatDateTime } from "@/lib/utils";
import type { DeliveryDetail } from "@/lib/types";

export function Timeline({ audit }: { audit: DeliveryDetail["audit"] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Historial</h2>
      </div>
      <div className="p-4">
        {audit.length === 0 ? (
          <p className="text-sm text-muted">Sin eventos todavía.</p>
        ) : (
          <ol className="space-y-3">
            {[...audit].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((event) => {
              const presentation = presentAuditEvent(event);
              return (
                <li key={event.id} className="grid grid-cols-[108px_1fr] gap-3 text-sm">
                  <span className="font-mono text-[11px] text-muted">{formatDateTime(event.created_at)}</span>
                  <span>
                    <span className="font-semibold">
                      {presentation.label}
                    </span>
                    <span className="text-muted"> · {presentation.actor}</span>
                    {presentation.summary ? <span className="mt-0.5 block text-xs text-muted">{presentation.summary}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
