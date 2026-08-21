"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { canBulkAssignPallet, canBulkAssignPicker } from "@/lib/deliveries/permissions";
import { createServerSupabase } from "@/lib/supabase/server";

export type ClientActionState = {
  error?: string;
  success?: string;
  clientId?: string;
};

export async function saveClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!name || name.length < 2) {
    return { error: "El nombre del cliente debe tener al menos 2 caracteres" };
  }

  const supabase = await createServerSupabase();

  if (id) {
    // Editar
    const { error } = await supabase
      .from("clients")
      .update({ name })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") return { error: "Ya existe un cliente con ese nombre" };
      return { error: error.message || "No se pudo actualizar el cliente" };
    }

    revalidatePath("/admin/clientes");
    revalidatePath("/admin/deliveries/new");
    revalidatePath("/admin");
    return { success: "Cliente actualizado correctamente", clientId: id };
  } else {
    // Crear
    const { data, error } = await supabase
      .from("clients")
      .insert({ name, active: true })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return { error: "Ya existe un cliente con ese nombre" };
      return { error: error.message || "No se pudo crear el cliente" };
    }

    revalidatePath("/admin/clientes");
    revalidatePath("/admin/deliveries/new");
    revalidatePath("/admin");
    return { success: "Cliente creado correctamente", clientId: data.id };
  }
}

export async function toggleClientStatusAction(
  id: string,
  active: boolean,
): Promise<ClientActionState> {
  await requireRole(["ADMIN"]);
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("clients")
    .update({ active })
    .eq("id", id);

  if (error) {
    return { error: error.message || "No se pudo cambiar el estado del cliente" };
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/deliveries/new");
  return { success: active ? "Cliente activado" : "Cliente desactivado" };
}

export async function bulkAssignPalletAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireRole(["ADMIN"]);
  if (!canBulkAssignPallet(user.role)) return { error: "No autorizado" };
  const palletCode = String(formData.get("palletCode") ?? "").trim();
  const deliveryIds = formData
    .getAll("deliveryId")
    .map((v) => String(v))
    .filter(Boolean);

  if (deliveryIds.length === 0) {
    return { error: "Elegí al menos una entrega" };
  }

  const supabase = await createServerSupabase();
  const { data: count, error } = await supabase.rpc("bulk_assign_pallet", {
    p_delivery_ids: deliveryIds,
    p_pallet_code: palletCode,
  });

  if (error) {
    return { error: error.message || "No se pudo asignar el lote / pallet" };
  }

  revalidatePath("/admin");
  revalidatePath("/picking");
  const assigned = Number(count ?? 0);
  return {
    success: palletCode
      ? `Se asignaron ${assigned} entrega${assigned === 1 ? "" : "s"} al lote "${palletCode}"`
      : `Se quitó el lote de ${assigned} entrega${assigned === 1 ? "" : "s"}`,
  };
}

export async function bulkAssignPickerAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!canBulkAssignPicker(user.role)) return { error: "No autorizado" };
  const rawAssigneeId = String(formData.get("assigneeId") ?? "").trim();
  const assigneeId = rawAssigneeId === "NONE" || !rawAssigneeId ? null : rawAssigneeId;
  const deliveryIds = formData
    .getAll("deliveryId")
    .map((v) => String(v))
    .filter(Boolean);

  if (deliveryIds.length === 0) {
    return { error: "Elegí al menos una entrega" };
  }

  const supabase = await createServerSupabase();
  const { data: count, error } = await supabase.rpc("bulk_assign_picker", {
    p_delivery_ids: deliveryIds,
    p_assignee_id: assigneeId,
  });

  if (error) {
    return { error: error.message || "No se pudo asignar el responsable" };
  }

  revalidatePath("/admin");
  revalidatePath("/picking");
  const assigned = Number(count ?? 0);
  return {
    success: `Se actualizó el responsable de ${assigned} entrega${assigned === 1 ? "" : "s"}`,
  };
}

