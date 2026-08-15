import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction } from "@/lib/types";

export async function writeAudit(
  supabase: SupabaseClient,
  input: {
    deliveryId: string;
    actorId: string | null;
    action: AuditAction;
    metadata?: Record<string, unknown>;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  const { error } = await supabase.from("audit_events").insert({
    delivery_id: input.deliveryId,
    actor_id: input.actorId,
    action: input.action,
    metadata: input.metadata ?? {},
    before: input.before ?? null,
    after: input.after ?? null,
  });

  if (error) {
    const fallback: Partial<Record<AuditAction, AuditAction>> = {
      RETURNED: "OBSERVATION_ADDED",
      CLAIMED: "ASSIGNED",
      REASSIGNED: "ASSIGNED",
      EVIDENCE_REVIEWED: "EVIDENCE_VOIDED",
    };
    const alternative = fallback[input.action];
    if (alternative && /audit_action|enum/i.test(error.message)) {
      const retry = await supabase.from("audit_events").insert({
        delivery_id: input.deliveryId,
        actor_id: input.actorId,
        action: alternative,
        metadata: { ...input.metadata, kind: input.action },
        before: input.before ?? null,
        after: input.after ?? null,
      });
      if (!retry.error) return;
    }
    throw new Error(`No se pudo registrar auditoría: ${error.message}`);
  }
}
