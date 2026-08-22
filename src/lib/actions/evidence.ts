"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { canReviewEvidence, canVoidEvidence } from "@/lib/deliveries/permissions";
import { getEvidenceStorage } from "@/lib/storage";
import { createServerSupabase } from "@/lib/supabase/server";
import { voidEvidenceSchema } from "@/lib/validations/delivery";
import { logServerError } from "@/lib/observability";

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
    .select("id, storage_key, thumbnail_storage_key, voided_at, requirement_id")
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

  const { data: deliveryId, error: updateError } = await supabase.rpc("void_evidence", {
    p_evidence_id: evidence.id,
    p_reason: parsed.data.reason,
  });
  if (updateError || !deliveryId) return { error: updateError?.message ?? "No se pudo anular la evidencia" };

  // Primero se confirma la anulación en la fuente de verdad. Si mover el archivo
  // falla, la evidencia igual deja de estar operativa y el error queda registrado.
  try {
    await getEvidenceStorage().void(evidence.storage_key);
    if (evidence.thumbnail_storage_key) {
      await getEvidenceStorage().void(evidence.thumbnail_storage_key);
    }
  } catch (voidError) {
    logServerError("evidence.storage_void_failed", voidError, {
      action: "voidEvidenceAction",
      operation: "evidence.storage_void",
      metadata: { evidenceId: evidence.id },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/picking");
  revalidatePath(`/admin/deliveries/${delivery.id}`);
  revalidatePath(`/picking/${delivery.id}`);

  return { success: "Evidencia anulada" };
}

export async function reviewEvidenceAction(
  _prev: EvidenceActionState,
  formData: FormData,
): Promise<EvidenceActionState> {
  const user = await requireSession();
  if (!canReviewEvidence(user.role)) return { error: "No autorizado" };

  const evidenceId = String(formData.get("evidenceId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!evidenceId) return { error: "Foto inválida" };
  if (decision !== "ACCEPTED" && decision !== "REJECTED") {
    return { error: "Decisión inválida" };
  }
  if (decision === "REJECTED" && note.length < 2) {
    return { error: "Escribí por qué no sirve la foto" };
  }

  const supabase = await createServerSupabase();
  let markup: unknown = null;
  const rawMarkup = String(formData.get("markup") ?? "").trim();
  if (rawMarkup) {
    try {
      markup = JSON.parse(rawMarkup);
    } catch {
      markup = null;
    }
  }

  const { data: deliveryId, error } = await supabase.rpc("review_evidence", {
    p_evidence_id: evidenceId,
    p_decision: decision,
    p_note: note || null,
    p_markup: decision === "REJECTED" ? markup : null,
  });
  if (error || !deliveryId) return { error: error?.message ?? "No se pudo revisar la foto" };

  revalidatePath("/admin");
  revalidatePath("/admin/revision");
  revalidatePath(`/admin/deliveries/${deliveryId}`);
  revalidatePath(`/admin/deliveries/${deliveryId}/revisar`);
  revalidatePath(`/picking/${deliveryId}`);

  return {
    success: decision === "ACCEPTED" ? "Foto aceptada" : "Foto rechazada",
    evidenceId,
  };
}
