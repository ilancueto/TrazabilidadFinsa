"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit/log";
import { requireSession } from "@/lib/auth/session";
import { canVoidEvidence } from "@/lib/deliveries/permissions";
import { computeProgress } from "@/lib/deliveries/progress";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { statusAfterIncompleteReady } from "@/lib/deliveries/state";
import { getEvidenceStorage } from "@/lib/storage";
import { createServerSupabase } from "@/lib/supabase/server";
import { voidEvidenceSchema } from "@/lib/validations/delivery";

export type EvidenceActionState = {
  error?: string;
  success?: string;
  evidenceId?: string;
};

export async function voidEvidenceAction(
  _prev: EvidenceActionState,
  formData: FormData,
): Promise<EvidenceActionState> {
  const user = await requireSession();
  const parsed = voidEvidenceSchema.safeParse({
    evidenceId: formData.get("evidenceId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createServerSupabase();
  const { data: evidence, error } = await supabase
    .from("evidences")
    .select("id, storage_key, voided_at, requirement_id")
    .eq("id", parsed.data.evidenceId)
    .maybeSingle();

  if (error || !evidence) return { error: "Evidencia no encontrada" };
  if (evidence.voided_at) return { error: "La evidencia ya está anulada" };

  const { data: requirement } = await supabase
    .from("delivery_requirements")
    .select("delivery_id")
    .eq("id", evidence.requirement_id)
    .maybeSingle();
  if (!requirement) return { error: "Requisito no encontrado" };

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, status")
    .eq("id", requirement.delivery_id)
    .maybeSingle();
  if (!delivery) return { error: "Entrega no encontrada" };
  if (!canVoidEvidence(user.role, delivery.status)) {
    return { error: "No se puede anular evidencia en este estado" };
  }

  try {
    await getEvidenceStorage().void(evidence.storage_key);
  } catch (voidError) {
    console.error("void storage failed", voidError);
  }

  const { error: updateError } = await supabase
    .from("evidences")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: parsed.data.reason,
    })
    .eq("id", evidence.id);
  if (updateError) return { error: updateError.message };

  await writeAudit(supabase, {
    deliveryId: delivery.id,
    actorId: user.id,
    action: "EVIDENCE_VOIDED",
    metadata: { evidenceId: evidence.id, reason: parsed.data.reason },
  });

  const detail = await getDeliveryDetail(delivery.id);
  if (detail) {
    const progress = computeProgress(detail.requirements);
    const nextStatus = statusAfterIncompleteReady(detail.status);
    if (nextStatus !== detail.status && progress.pendingRequired > 0) {
      await supabase.from("deliveries").update({ status: nextStatus }).eq("id", detail.id);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/picking");
  revalidatePath(`/admin/deliveries/${delivery.id}`);
  revalidatePath(`/picking/${delivery.id}`);

  return { success: "Evidencia anulada" };
}
