"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireSession } from "@/lib/auth/session";
import {
  canAddObservation,
  canClose,
  canCreateDelivery,
  canDeleteDelivery,
  canDuplicateDelivery,
  canEditMasterData,
  canMarkReady,
  canReopen,
  canReassignDelivery,
  canReleaseDelivery,
  canResolveObservation,
  canReturnToPicking,
  canClaimDelivery,
} from "@/lib/deliveries/permissions";
import { computeProgress } from "@/lib/deliveries/progress";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { assertTransition } from "@/lib/deliveries/state";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Delivery, DeliveryRequirement } from "@/lib/types";
import {
  assertPublishableRequirements,
  deleteDeliverySchema,
  deliveryInputSchema,
  observationSchema,
  reassignDeliverySchema,
  reopenSchema,
  returnToPickingSchema,
} from "@/lib/validations/delivery";

export type ActionState = {
  error?: string;
  success?: string;
  deliveryId?: string;
  deliveryNumber?: string;
};

function revalidateDelivery(id: string) {
  revalidatePath("/admin");
  revalidatePath("/picking");
  revalidatePath(`/admin/deliveries/${id}`);
  revalidatePath(`/admin/deliveries/${id}/edit`);
  revalidatePath(`/picking/${id}`);
  revalidatePath("/admin/revision");
  revalidatePath(`/admin/deliveries/${id}/revisar`);
}

export async function saveDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  if (!canCreateDelivery(user.role)) {
    return { error: "No autorizado" };
  }

  const rawRequirements = String(formData.get("requirements") ?? "[]");
  let parsedRequirements: unknown = [];
  try {
    parsedRequirements = JSON.parse(rawRequirements);
  } catch {
    return { error: "Requisitos inválidos" };
  }

  const parsed = deliveryInputSchema.safeParse({
    id: formData.get("id") || undefined,
    number: formData.get("number"),
    modality: formData.get("modality"),
    destination: formData.get("destination"),
    packages: formData.get("packages"),
    priority: formData.get("priority"),
    assigneeId: formData.get("assigneeId") || null,
    clientId: formData.get("clientId") || null,
    palletCode: formData.get("palletCode") || null,
    observations: formData.get("observations") || null,
    requirements: parsedRequirements,
    intent: formData.get("intent"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const input = parsed.data;
  if (input.intent === "publish") {
    const publishError = assertPublishableRequirements(input.requirements);
    if (publishError) return { error: publishError };
  }

  const supabase = await createServerSupabase();
  const current = input.id ? await getDeliveryDetail(input.id) : null;
  if (input.id && !current) return { error: "Entrega no encontrada" };
  if (current && !canEditMasterData(user.role, current.status)) return { error: "La entrega está bloqueada" };

  const { data: deliveryId, error } = await supabase.rpc("save_delivery", {
    p_delivery_id: input.id ?? null,
    p_expected_status: current?.status ?? null,
    p_number: input.number,
    p_modality: input.modality,
    p_destination: input.destination,
    p_packages: input.packages,
    p_priority: input.priority,
    p_assignee_id: input.assigneeId,
    p_due_at: null,
    p_observations: input.observations ?? null,
    p_intent: input.intent,
    p_requirements: input.requirements,
    p_client_id: input.clientId ?? null,
    p_pallet_code: input.palletCode ?? null,
  });
  if (error || !deliveryId) {
    if (error?.code === "23505") return { error: "Ese número de entrega ya existe" };
    return { error: error?.message ?? "No se pudo guardar la entrega" };
  }

  revalidateDelivery(deliveryId);
  return {
    success: input.id ? "Entrega actualizada" : input.intent === "publish" ? "Entrega publicada" : "Borrador guardado",
    deliveryId,
    deliveryNumber: input.number,
  };
}

export async function markReadyAction(deliveryId: string): Promise<ActionState> {
  const user = await requireSession();
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };

  const progress = computeProgress(detail.requirements);
  if (!canMarkReady(user.role, detail.status, progress.pendingRequired)) {
    if (progress.pendingRequired > 0) {
      return {
        error: `Faltan fotos de bodega: ${progress.pendingCriticalLabels.join(", ")}`,
      };
    }
    return { error: "No se puede marcar lista en este estado" };
  }

  try {
    assertTransition(detail.status, "READY", user.role);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Transición inválida" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("transition_delivery", {
    p_delivery_id: deliveryId,
    p_expected_status: detail.status,
    p_next_status: "READY",
    p_action: "READY",
    p_metadata: {},
  });
  if (error) return { error: error.message };

  revalidateDelivery(deliveryId);
  return { success: "Entrega marcada como lista" };
}

export async function closeDeliveryAction(deliveryId: string): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canClose(user.role, detail.status)) {
    return { error: "Sólo Admin puede cerrar una entrega lista" };
  }
  if (detail.has_open_observation) {
    return { error: "Resolvé la observación abierta antes de cerrar" };
  }
  const closeProgress = computeProgress(detail.requirements);
  if (closeProgress.pendingDispatch > 0) {
    return { error: `Falta etiqueta: ${closeProgress.pendingDispatchLabels.join(", ")}` };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("transition_delivery", {
    p_delivery_id: deliveryId,
    p_expected_status: "READY",
    p_next_status: "CLOSED",
    p_action: "CLOSED",
    p_metadata: {},
  });
  if (error) return { error: error.message };

  revalidateDelivery(deliveryId);
  return { success: "Entrega cerrada" };
}

export async function reopenDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = reopenSchema.safeParse({
    deliveryId: formData.get("deliveryId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const detail = await getDeliveryDetail(parsed.data.deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canReopen(user.role, detail.status)) {
    return { error: "Sólo se reabre una entrega cerrada" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("transition_delivery", {
    p_delivery_id: parsed.data.deliveryId,
    p_expected_status: "CLOSED",
    p_next_status: "IN_PICKING",
    p_action: "REOPENED",
    p_metadata: { reason: parsed.data.reason },
  });
  if (error) return { error: error.message };

  revalidateDelivery(parsed.data.deliveryId);
  return { success: "Entrega reabierta", deliveryId: parsed.data.deliveryId };
}

export async function addObservationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSession();
  const parsed = observationSchema.safeParse({
    deliveryId: formData.get("deliveryId"),
    text: formData.get("text"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const detail = await getDeliveryDetail(parsed.data.deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canAddObservation(user.role, detail.status)) {
    return { error: "No se pueden agregar observaciones" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("record_observation", {
    p_delivery_id: detail.id,
    p_text: parsed.data.text,
    p_resolve: false,
  });
  if (error) return { error: error.message };

  revalidateDelivery(detail.id);
  return { success: "Observación registrada" };
}

export async function resolveObservationAction(deliveryId: string): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canResolveObservation(user.role, detail.status)) {
    return { error: "No se puede resolver la observación" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("record_observation", {
    p_delivery_id: deliveryId,
    p_text: "",
    p_resolve: true,
  });
  if (error) return { error: error.message };

  revalidateDelivery(deliveryId);
  return { success: "Observación resuelta" };
}

export async function loadDeliveryForEdit(id: string): Promise<Delivery | null> {
  await requireRole(["ADMIN"]);
  const detail = await getDeliveryDetail(id);
  return detail;
}

export async function deleteDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  if (!canDeleteDelivery(user.role)) return { error: "No autorizado" };

  const parsed = deleteDeliverySchema.safeParse({
    deliveryId: formData.get("deliveryId"),
    confirmNumber: formData.get("confirmNumber"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const detail = await getDeliveryDetail(parsed.data.deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (parsed.data.confirmNumber.trim().toUpperCase() !== detail.number.trim().toUpperCase()) {
    return { error: "El número no coincide. Escribí el número de entrega para confirmar." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("archive_delivery", {
    p_delivery_id: detail.id,
    p_confirm_number: parsed.data.confirmNumber,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/picking");
  redirect(`/admin?deleted=${encodeURIComponent(detail.number)}`);
}

export async function duplicateDeliveryAction(deliveryId: string): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  if (!canDuplicateDelivery(user.role)) return { error: "No autorizado" };

  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };

  const supabase = await createServerSupabase();
  const stamp = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "");
  const number = `${detail.number}-C${stamp}`.slice(0, 40);

  const { data: createdId, error } = await supabase.rpc("save_delivery", {
    p_delivery_id: null,
    p_expected_status: null,
    p_number: number,
    p_modality: detail.modality,
    p_destination: detail.destination,
    p_packages: detail.packages,
    p_priority: detail.priority,
    p_assignee_id: detail.assignee_id,
    p_due_at: null,
    p_observations: detail.observations,
    p_intent: "draft",
    p_requirements: detail.requirements.map((req) => ({
      typeId: req.requirement_type_id,
      label: req.label,
      required: req.required,
      applicable: req.applicable,
      displayOrder: req.display_order,
    })),
  });

  if (error || !createdId) {
    if (error?.code === "23505") return { error: "No se pudo generar un número libre. Probá de nuevo." };
    return { error: error?.message ?? "No se pudo duplicar" };
  }

  revalidateDelivery(createdId);
  return { success: `Copia creada como ${number}`, deliveryId: createdId, deliveryNumber: number };
}

export async function returnToPickingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = returnToPickingSchema.safeParse({
    deliveryId: formData.get("deliveryId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const detail = await getDeliveryDetail(parsed.data.deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canReturnToPicking(user.role, detail.status)) {
    return { error: "Sólo se puede devolver una entrega lista" };
  }

  try {
    assertTransition(detail.status, "IN_PICKING", user.role);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Transición inválida" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("transition_delivery", {
    p_delivery_id: detail.id,
    p_expected_status: "READY",
    p_next_status: "IN_PICKING",
    p_action: "RETURNED",
    p_metadata: { reason: parsed.data.reason },
  });
  if (error) return { error: error.message };

  revalidateDelivery(detail.id);
  return { success: "La entrega volvió a Picking", deliveryId: detail.id };
}

export async function claimDeliveryAction(deliveryId: string): Promise<ActionState> {
  const user = await requireSession();
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canClaimDelivery(user.role, detail.status, detail.assignee_id, user.id)) {
    return { error: "No se puede tomar esta entrega" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("assign_delivery", {
    p_delivery_id: deliveryId,
    p_expected_assignee: detail.assignee_id,
    p_next_assignee: user.id,
    p_action: "CLAIMED",
  });
  if (error) return { error: error.message };

  revalidateDelivery(deliveryId);
  return { success: "Esta entrega quedó a tu nombre" };
}

export async function releaseDeliveryAction(deliveryId: string): Promise<ActionState> {
  const user = await requireSession();
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canReleaseDelivery(user.role, detail.status, detail.assignee_id, user.id)) {
    return { error: "No se puede soltar esta entrega" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("assign_delivery", {
    p_delivery_id: deliveryId,
    p_expected_assignee: detail.assignee_id,
    p_next_assignee: null,
    p_action: "REASSIGNED",
  });
  if (error) return { error: error.message };

  revalidateDelivery(deliveryId);
  return { success: "La entrega quedó sin asignar" };
}

export async function reassignDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const rawAssignee = String(formData.get("assigneeId") ?? "").trim();
  const parsed = reassignDeliverySchema.safeParse({
    deliveryId: formData.get("deliveryId"),
    assigneeId: rawAssignee || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const detail = await getDeliveryDetail(parsed.data.deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };
  if (!canReassignDelivery(user.role, detail.status)) {
    return { error: "No se puede reasignar en este estado" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("assign_delivery", {
    p_delivery_id: detail.id,
    p_expected_assignee: detail.assignee_id,
    p_next_assignee: parsed.data.assigneeId,
    p_action: "REASSIGNED",
  });
  if (error) return { error: error.message };

  revalidateDelivery(detail.id);
  return { success: "Responsable actualizado" };
}

export async function assignUnassignedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  if (!assigneeId) return { error: "Elegí un responsable" };

  const supabase = await createServerSupabase();
  const { data: assignedCount, error } = await supabase.rpc("bulk_assign_unassigned", {
    p_assignee_id: assigneeId,
  });
  if (error) return { error: error.message };
  const count = Number(assignedCount ?? 0);
  if (count === 0) return { success: "No había entregas sin asignar" };

  revalidatePath("/admin");
  revalidatePath("/picking");
  return { success: `Se asignaron ${count} entrega${count === 1 ? "" : "s"}` };
}

export async function closeReadyBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const ids = formData
    .getAll("deliveryId")
    .map((value) => String(value))
    .filter(Boolean);
  if (ids.length === 0) return { error: "Elegí al menos una entrega" };

  const closed: string[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const detail = await getDeliveryDetail(id);
    if (!detail || detail.status !== "READY") {
      skipped.push(detail?.number ?? id);
      continue;
    }
    if (detail.has_open_observation) {
      skipped.push(`${detail.number} (observación)`);
      continue;
    }
    if (detail.progress.pendingDispatch > 0) {
      skipped.push(`${detail.number} (falta etiqueta)`);
      continue;
    }
    const result = await closeDeliveryAction(id);
    if (result.error) skipped.push(`${detail.number}: ${result.error}`);
    else closed.push(detail.number);
  }

  if (closed.length === 0) return { error: `No se cerró ninguna. ${skipped.join(" · ")}` };
  return {
    success: `Cerradas: ${closed.join(", ")}.${skipped.length ? ` Sin cerrar: ${skipped.join(" · ")}` : ""}`,
  };
}

export type RequirementRow = DeliveryRequirement;
