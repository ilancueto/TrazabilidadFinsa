import { AUDIT_LABEL } from "@/lib/constants";

export const AUDIT_FILTER_ACTIONS = [
  "CREATED", "PUBLISHED", "EDITED", "ASSIGNED", "CLAIMED", "REASSIGNED",
  "PICKING_STARTED", "EVIDENCE_UPLOADED", "EVIDENCE_VOIDED", "EVIDENCE_REVIEWED",
  "OBSERVATION_ADDED", "OBSERVATION_RESOLVED", "READY", "CLOSED", "REOPENED",
  "RETURNED", "ARCHIVED",
] as const;
export type AuditFilterAction = (typeof AUDIT_FILTER_ACTIONS)[number];

export type PresentableAuditEvent = {
  action: string;
  metadata: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actor_name?: string | null;
  actor?: { full_name?: string | null; deleted_at?: string | null } | null;
};

function text(metadata: Record<string, unknown> | null, key: "reason" | "text" | "note") {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function semanticAuditAction(event: PresentableAuditEvent): AuditFilterAction {
  const kind = typeof event.metadata?.kind === "string" ? event.metadata.kind : null;
  if (event.action === "EDITED" && kind === "ARCHIVED") return "ARCHIVED";
  if (event.action === "ASSIGNED" && kind === "CLAIMED") return "CLAIMED";
  if (event.action === "ASSIGNED" && kind === "REASSIGNED") return "REASSIGNED";
  if (event.action === "OBSERVATION_ADDED" && kind === "RETURNED") return "RETURNED";
  if (event.action === "EVIDENCE_VOIDED" && kind === "EVIDENCE_REVIEWED") return "EVIDENCE_REVIEWED";
  if ((AUDIT_FILTER_ACTIONS as readonly string[]).includes(event.action)) return event.action as AuditFilterAction;
  return "EDITED";
}

export function auditActor(event: PresentableAuditEvent) {
  if (!event.actor_name && !event.actor) return "Sistema";
  const name = event.actor_name ?? event.actor?.full_name ?? "Usuario no disponible";
  return event.actor?.deleted_at ? `${name} (eliminado)` : name;
}

export function auditReason(event: PresentableAuditEvent) {
  return text(event.metadata, "reason") ?? text(event.metadata, "text") ?? text(event.metadata, "note");
}

export function presentAuditEvent(event: PresentableAuditEvent) {
  const action = semanticAuditAction(event);
  const metadata = event.metadata ?? {};
  const decision = typeof metadata.decision === "string" ? metadata.decision : null;
  const kind = typeof metadata.kind === "string" ? metadata.kind : null;
  const exceptional = metadata.exceptional === true || metadata.forced === true;
  const evidenceSummary = action === "EVIDENCE_REVIEWED" && decision
    ? `Decisión de evidencia: ${decision === "ACCEPTED" ? "aceptada" : decision === "REJECTED" ? "rechazada" : decision}`
    : null;
  const returnedEvidenceSummary = action === "RETURNED" && kind === "EVIDENCE_REJECTED"
    ? "Devuelta a Picking por evidencia rechazada"
    : action === "RETURNED" && kind === "EVIDENCE_VOIDED"
      ? "Devuelta a Picking por evidencia anulada"
      : null;
  const summary = evidenceSummary ?? returnedEvidenceSummary ?? (exceptional && action === "CLOSED" ? "Cierre excepcional" : auditReason(event));
  return { action, label: AUDIT_LABEL[action] ?? action, actor: auditActor(event), summary, archived: action === "ARCHIVED" };
}
