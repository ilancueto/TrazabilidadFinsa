"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { listCatalogTemplates, listRequirementTypes, templatesToDrafts } from "@/lib/deliveries/queries";
import { assertPublishableRequirements } from "@/lib/validations/delivery";
import { createServerSupabase } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability";

export type BulkImportItem = {
  number: string;
  destination: string;
  packages: number;
  clientId: string | null;
  saveAlias?: {
    alias: string;
    clientId: string;
  } | null;
};

export type BulkImportResult = {
  success: boolean;
  createdCount: number;
  errorCount: number;
  errors: Array<{ number: string; error: string }>;
};

export async function bulkCreateDeliveriesAction(
  items: BulkImportItem[],
): Promise<BulkImportResult> {
  await requireRole(["ADMIN"]);
  if (!items || items.length === 0) {
    return { success: false, createdCount: 0, errorCount: 0, errors: [{ number: "-", error: "No se proporcionaron entregas" }] };
  }

  const [types, templates] = await Promise.all([
    listRequirementTypes(),
    listCatalogTemplates(),
  ]);

  const draftsByModality = templatesToDrafts(templates, types);
  const defaultDrafts = draftsByModality.DESPACHO;

  const publishError = assertPublishableRequirements(defaultDrafts);
  if (publishError) {
    return { success: false, createdCount: 0, errorCount: items.length, errors: [{ number: "TODAS", error: publishError }] };
  }

  const supabase = await createServerSupabase();
  let createdCount = 0;
  const errors: Array<{ number: string; error: string }> = [];

  // 1. Guardar nuevos alias aprendidos si los hay
  const aliasesToSave = items
    .filter((it) => it.saveAlias && it.saveAlias.clientId && it.saveAlias.alias.trim().length >= 2)
    .map((it) => ({
      client_id: it.saveAlias!.clientId,
      alias: it.saveAlias!.alias.trim(),
    }));

  if (aliasesToSave.length > 0) {
    const { error: aliasErr } = await supabase
      .from("client_aliases")
      .upsert(aliasesToSave, { onConflict: "alias" });

    if (aliasErr) {
      logServerError("bulk_import.save_aliases_failed", aliasErr, { metadata: { count: aliasesToSave.length } });
    }
  }

  // 2. Crear entregas en lote
  for (const item of items) {
    const cleanNum = item.number.trim();
    if (!cleanNum) continue;

    try {
      const { data: deliveryId, error } = await supabase.rpc("save_delivery", {
        p_delivery_id: null,
        p_expected_status: null,
        p_number: cleanNum,
        p_modality: "DESPACHO",
        p_carrier: "Andreani",
        p_destination: item.destination?.trim() || "Neuquén",
        p_packages: Math.max(1, item.packages || 1),
        p_priority: "NORMAL",
        p_assignee_id: null,
        p_due_at: null,
        p_observations: null,
        p_intent: "publish",
        p_requirements: defaultDrafts,
        p_client_id: item.clientId || null,
        p_pallet_code: null,
      });

      if (error || !deliveryId) {
        errors.push({
          number: cleanNum,
          error: error?.code === "23505" ? "El número ya existe en el sistema" : error?.message ?? "Error al guardar",
        });
      } else {
        createdCount++;
      }
    } catch (err) {
      errors.push({
        number: cleanNum,
        error: err instanceof Error ? err.message : "Error inesperado",
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/retiros");
  revalidatePath("/tablero");
  revalidatePath("/picking");

  return {
    success: createdCount > 0,
    createdCount,
    errorCount: errors.length,
    errors,
  };
}
