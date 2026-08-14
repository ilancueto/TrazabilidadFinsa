"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit/log";
import { requireRole, requireSession } from "@/lib/auth/session";
import {
  canAddObservation,
  canClose,
  canCreateDelivery,
  canEditMasterData,
  canMarkReady,
  canReopen,
  canResolveObservation,
} from "@/lib/deliveries/permissions";
import { computeProgress } from "@/lib/deliveries/progress";
import { getDeliveryDetail } from "@/lib/deliveries/queries";
import { assertTransition } from "@/lib/deliveries/state";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Delivery, DeliveryRequirement, DeliveryStatus } from "@/lib/types";
import {
  assertPublishableRequirements,
  deliveryInputSchema,
  observationSchema,
  reopenSchema,
} from "@/lib/validations/delivery";

export type ActionState = {
  error?: string;
  success?: string;
  deliveryId?: string;
};

function masterSnapshot(row: Delivery) {
  return {
    number: row.number,
    modality: row.modality,
    destination: row.destination,
    packages: row.packages,
    priority: row.priority,
    status: row.status,
    assignee_id: row.assignee_id,
    observations: row.observations,
    has_open_observation: row.has_open_observation,
  };
}

function revalidateDelivery(id: string) {
  revalidatePath("/admin");
  revalidatePath("/picking");
  revalidatePath(`/admin/deliveries/${id}`);
  revalidatePath(`/admin/deliveries/${id}/edit`);
  revalidatePath(`/picking/${id}`);
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
  const now = new Date().toISOString();

  if (!input.id) {
    const nextStatus: DeliveryStatus = input.intent === "publish" ? "PUBLISHED" : "DRAFT";
    const { data: created, error } = await supabase
      .from("deliveries")
      .insert({
        number: input.number,
        modality: input.modality,
        destination: input.destination,
        packages: input.packages,
        priority: input.priority,
        status: nextStatus,
        assignee_id: input.assigneeId,
        created_by: user.id,
        observations: input.observations || null,
        published_at: nextStatus === "PUBLISHED" ? now : null,
      })
      .select("id, number, assignee_id")
      .single();

    if (error || !created) {
      if (error?.code === "23505") return { error: "Ese número de entrega ya existe" };
      return { error: error?.message ?? "No se pudo crear la entrega" };
    }

    const { error: reqError } = await supabase.from("delivery_requirements").insert(
      input.requirements.map((req) => ({
        delivery_id: created.id,
        requirement_type_id: req.typeId,
        label: req.label,
        required: req.required,
        applicable: req.applicable,
        display_order: req.displayOrder,
        status: "PENDING",
      })),
    );
    if (reqError) return { error: reqError.message };

    await writeAudit(supabase, {
      deliveryId: created.id,
      actorId: user.id,
      action: "CREATED",
      after: { number: created.number, status: nextStatus },
    });
    if (input.assigneeId) {
      await writeAudit(supabase, {
        deliveryId: created.id,
        actorId: user.id,
        action: "ASSIGNED",
        after: { assignee_id: input.assigneeId },
      });
    }
    if (nextStatus === "PUBLISHED") {
      await writeAudit(supabase, {
        deliveryId: created.id,
        actorId: user.id,
        action: "PUBLISHED",
        after: { status: "PUBLISHED" },
      });
    }

    revalidateDelivery(created.id);
    return {
      success: nextStatus === "PUBLISHED" ? "Entrega publicada" : "Borrador guardado",
      deliveryId: created.id,
    };
  }

  const current = await getDeliveryDetail(input.id);
  if (!current) return { error: "Entrega no encontrada" };
  if (!canEditMasterData(user.role, current.status)) {
    return { error: "La entrega está bloqueada" };
  }

  if (input.intent === "draft" && current.status !== "DRAFT") {
    const hasEvidence = current.requirements.some((req) =>
      req.evidences.some((ev) => !ev.voided_at),
    );
    if (hasEvidence) {
      return { error: "No se puede volver a borrador: ya hay evidencias" };
    }
  }

  const nextStatus: DeliveryStatus =
    input.intent === "publish"
      ? current.status === "DRAFT"
        ? "PUBLISHED"
        : current.status
      : current.status === "DRAFT"
        ? "DRAFT"
        : current.status === "PUBLISHED"
          ? "DRAFT"
          : current.status;

  if (nextStatus !== current.status) {
    try {
      assertTransition(current.status, nextStatus, user.role);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Transición inválida" };
    }
  }

  const { error } = await supabase
    .from("deliveries")
    .update({
      number: input.number,
      modality: input.modality,
      destination: input.destination,
      packages: input.packages,
      priority: input.priority,
      assignee_id: input.assigneeId,
      observations: input.observations || null,
      status: nextStatus,
      published_at:
        nextStatus === "PUBLISHED" ? (current.published_at ?? now) : current.published_at,
    })
    .eq("id", current.id);

  if (error) {
    if (error.code === "23505") return { error: "Ese número de entrega ya existe" };
    return { error: error.message };
  }

  const existingByType = new Map(current.requirements.map((req) => [req.requirement_type_id, req]));
  for (const req of input.requirements) {
    const existing = existingByType.get(req.typeId);
    if (existing) {
      const { error: updError } = await supabase
        .from("delivery_requirements")
        .update({
          label: req.label,
          required: req.required,
          applicable: req.applicable,
          display_order: req.displayOrder,
        })
        .eq("id", existing.id);
      if (updError) return { error: updError.message };
    } else {
      const { error: insError } = await supabase.from("delivery_requirements").insert({
        delivery_id: current.id,
        requirement_type_id: req.typeId,
        label: req.label,
        required: req.required,
        applicable: req.applicable,
        display_order: req.displayOrder,
        status: "PENDING",
      });
      if (insError) return { error: insError.message };
    }
  }

  await writeAudit(supabase, {
    deliveryId: current.id,
    actorId: user.id,
    action: "EDITED",
    before: masterSnapshot(current),
    after: {
      number: input.number,
      modality: input.modality,
      destination: input.destination,
      packages: input.packages,
      priority: input.priority,
      status: nextStatus,
      assignee_id: input.assigneeId,
      observations: input.observations,
    },
  });

  if (input.assigneeId !== current.assignee_id) {
    await writeAudit(supabase, {
      deliveryId: current.id,
      actorId: user.id,
      action: "ASSIGNED",
      before: { assignee_id: current.assignee_id },
      after: { assignee_id: input.assigneeId },
    });
  }

  if (current.status !== "PUBLISHED" && nextStatus === "PUBLISHED") {
    await writeAudit(supabase, {
      deliveryId: current.id,
      actorId: user.id,
      action: "PUBLISHED",
      after: { status: "PUBLISHED" },
    });
  }

  revalidateDelivery(current.id);
  return { success: "Entrega actualizada", deliveryId: current.id };
}

export async function markReadyAction(deliveryId: string): Promise<ActionState> {
  const user = await requireSession();
  const detail = await getDeliveryDetail(deliveryId);
  if (!detail) return { error: "Entrega no encontrada" };

  const progress = computeProgress(detail.requirements);
  if (!canMarkReady(user.role, detail.status, progress.pendingRequired)) {
    if (progress.pendingRequired > 0) {
      return {
        error: `Faltan requisitos: ${progress.pendingCriticalLabels.join(", ")}`,
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
  const { error } = await supabase
    .from("deliveries")
    .update({ status: "READY", ready_at: new Date().toISOString() })
    .eq("id", deliveryId);
  if (error) return { error: error.message };

  await writeAudit(supabase, {
    deliveryId,
    actorId: user.id,
    action: "READY",
    before: { status: detail.status },
    after: { status: "READY" },
  });

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

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("deliveries")
    .update({
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", deliveryId);
  if (error) return { error: error.message };

  await writeAudit(supabase, {
    deliveryId,
    actorId: user.id,
    action: "CLOSED",
    before: { status: detail.status },
    after: { status: "CLOSED" },
  });

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
  const { error } = await supabase
    .from("deliveries")
    .update({
      status: "IN_PICKING",
      closed_at: null,
      closed_by: null,
    })
    .eq("id", parsed.data.deliveryId);
  if (error) return { error: error.message };

  await writeAudit(supabase, {
    deliveryId: parsed.data.deliveryId,
    actorId: user.id,
    action: "REOPENED",
    metadata: { reason: parsed.data.reason },
    before: { status: "CLOSED" },
    after: { status: "IN_PICKING" },
  });

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

  const stamp = new Date().toLocaleString("es-AR");
  const line = `[${stamp} · ${user.fullName}] ${parsed.data.text}`;
  const next = detail.observations ? `${detail.observations}\n${line}` : line;

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("deliveries")
    .update({ observations: next, has_open_observation: true })
    .eq("id", detail.id);
  if (error) return { error: error.message };

  await writeAudit(supabase, {
    deliveryId: detail.id,
    actorId: user.id,
    action: "OBSERVATION_ADDED",
    metadata: { text: parsed.data.text },
  });

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
  const { error } = await supabase
    .from("deliveries")
    .update({ has_open_observation: false })
    .eq("id", deliveryId);
  if (error) return { error: error.message };

  await writeAudit(supabase, {
    deliveryId,
    actorId: user.id,
    action: "OBSERVATION_RESOLVED",
    before: { has_open_observation: true },
    after: { has_open_observation: false },
  });

  revalidateDelivery(deliveryId);
  return { success: "Observación resuelta" };
}

export async function loadDeliveryForEdit(id: string): Promise<Delivery | null> {
  await requireRole(["ADMIN"]);
  const detail = await getDeliveryDetail(id);
  return detail;
}

export type RequirementRow = DeliveryRequirement;
