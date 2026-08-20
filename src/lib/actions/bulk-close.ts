"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export type BulkCloseState = {
  error?: string;
  success?: string;
};

export async function bulkCloseReadyAction(
  _prev: BulkCloseState,
  formData: FormData,
): Promise<BulkCloseState> {
  await requireRole(["ADMIN"]);

  const reason = String(formData.get("reason") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (reason.length < 5) return { error: "Escribí un motivo de al menos 5 caracteres" };
  if (confirmation !== "CERRAR TODAS") return { error: "Escribí CERRAR TODAS para confirmar" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("bulk_close_ready_deliveries", {
    p_reason: reason,
    p_confirmation: confirmation,
  });

  if (error) return { error: error.message };

  const result = (data ?? {}) as { closedCount?: number; skippedCount?: number; totalReady?: number };
  const closed = Number(result.closedCount ?? 0);
  const skipped = Number(result.skippedCount ?? 0);

  revalidatePath("/admin");
  revalidatePath("/admin/revision");
  revalidatePath("/picking");
  revalidatePath("/tablero");

  if (closed === 0) {
    return { success: skipped > 0 ? `No se cerró ninguna entrega. ${skipped} quedaron omitidas por requisitos u observaciones pendientes.` : "No había entregas listas para cerrar." };
  }

  return {
    success: `${closed} entrega${closed === 1 ? "" : "s"} cerrada${closed === 1 ? "" : "s"}.${skipped > 0 ? ` ${skipped} omitida${skipped === 1 ? "" : "s"} por pendientes.` : ""}`,
  };
}
