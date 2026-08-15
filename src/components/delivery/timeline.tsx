import { AUDIT_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { AuditAction, DeliveryDetail } from "@/lib/types";

function eventDetail(metadata: Record<string, unknown>): string | null {
  const reason = typeof metadata.reason === "string" ? metadata.reason : null;
  const text = typeof metadata.text === "string" ? metadata.text : null;
  return reason || text;
}

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
            {audit.map((event) => {
              const detail = eventDetail(event.metadata);
              const metadataKind = typeof event.metadata.kind === "string" ? event.metadata.kind : null;
              const actionKey =
                metadataKind && AUDIT_LABEL[metadataKind]
                  ? metadataKind
                  : event.action === "OBSERVATION_ADDED" && event.metadata.kind === "RETURNED"
                  ? "RETURNED"
                  : event.action === "ASSIGNED" &&
                      (event.metadata.kind === "CLAIMED" || event.metadata.kind === "REASSIGNED")
                    ? (event.metadata.kind as AuditAction)
                    : event.action;
              return (
                <li key={event.id} className="grid grid-cols-[108px_1fr] gap-3 text-sm">
                  <span className="font-mono text-[11px] text-muted">{formatDateTime(event.created_at)}</span>
                  <span>
                    <span className="font-semibold">
                      {AUDIT_LABEL[actionKey] ?? actionKey}
                    </span>
                    <span className="text-muted"> · {event.actor_name ?? "Sistema"}</span>
                    {detail ? <span className="mt-0.5 block text-xs text-muted">{detail}</span> : null}
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
