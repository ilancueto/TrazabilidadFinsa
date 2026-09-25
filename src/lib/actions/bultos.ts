"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { canBulkAssignPallet } from "@/lib/deliveries/permissions";

import { validateBultoInput, type CreateBultoResult } from "./bultos-validation";
export type { CreateBultoResult };

/**
 * Crea o actualiza un bulto asociando las entregas especificadas.
 * Las entregas compartirán automáticamente fotos de Remito y Etiquetas en Picking.
 */
export async function createBultoAction(
  deliveryIds: string[],
  bultoCode: string,
): Promise<CreateBultoResult> {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!canBulkAssignPallet(user.role)) {
    return { error: "No autorizado para gestionar bultos" };
  }

  const validationError = validateBultoInput(bultoCode, deliveryIds);
  if (validationError) {
    return { error: validationError };
  }

  const cleanBultoCode = bultoCode.trim();

  const supabase = await createServerSupabase();
  const { data: count, error } = await supabase.rpc("bulk_assign_pallet", {
    p_delivery_ids: deliveryIds,
    p_pallet_code: cleanBultoCode,
  });

  if (error) {
    return { error: error.message || "No se pudo crear el bulto" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/agrupar");
  revalidatePath("/picking");
  revalidatePath("/tablero");

  const assigned = Number(count ?? 0);
  return {
    success: `Bulto "${cleanBultoCode}" creado con éxito con ${assigned} entrega${assigned === 1 ? "" : "s"}.`,
    count: assigned,
  };
}

/**
 * Desarma un bulto quitando la asignación de bulto de todas sus entregas.
 */
export async function dismantleBultoAction(
  bultoCode: string,
): Promise<CreateBultoResult> {
  const user = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!canBulkAssignPallet(user.role)) {
    return { error: "No autorizado para gestionar bultos" };
  }

  const cleanBultoCode = bultoCode.trim();
  if (!cleanBultoCode) {
    return { error: "Código de bulto inválido" };
  }

  const supabase = await createServerSupabase();

  // Buscar todas las entregas que tengan este bulto
  const { data: deliveries, error: findError } = await supabase
    .from("deliveries")
    .select("id")
    .eq("pallet_code", cleanBultoCode)
    .is("deleted_at", null);

  if (findError) {
    return { error: findError.message || "Error al buscar entregas del bulto" };
  }

  if (!deliveries || deliveries.length === 0) {
    return { error: "No se encontraron entregas en ese bulto" };
  }

  const deliveryIds = deliveries.map((d) => d.id);
  const { data: count, error } = await supabase.rpc("bulk_assign_pallet", {
    p_delivery_ids: deliveryIds,
    p_pallet_code: "",
  });

  if (error) {
    return { error: error.message || "No se pudo desarmar el bulto" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/agrupar");
  revalidatePath("/picking");
  revalidatePath("/tablero");

  const assigned = Number(count ?? 0);
  return {
    success: `Se desarmó el bulto "${cleanBultoCode}". Se liberaron ${assigned} entrega${assigned === 1 ? "" : "s"}.`,
    count: assigned,
  };
}
