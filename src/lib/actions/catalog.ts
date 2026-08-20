"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { canManageCatalog } from "@/lib/deliveries/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  requirementTypeInputSchema,
  templateSaveSchema,
} from "@/lib/validations/delivery";

export type CatalogActionState = {
  error?: string;
  success?: string;
};

function revalidateCatalog() {
  revalidatePath("/admin/requisitos");
  revalidatePath("/admin/deliveries/new");
}

export async function saveRequirementTypeAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const user = await requireRole(["ADMIN"]);
  if (!canManageCatalog(user.role)) return { error: "No autorizado" };

  const parsed = requirementTypeInputSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    label: formData.get("label"),
    description: formData.get("description") || null,
    guidance: formData.get("guidance") || null,
    stage: formData.get("stage") || "FLOOR",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  if (parsed.data.id) {
    const { error } = await admin
      .from("requirement_types")
      .update({
        label: parsed.data.label,
        description: parsed.data.description,
        guidance: parsed.data.guidance,
        stage: parsed.data.stage ?? "FLOOR",
      })
      .eq("id", parsed.data.id);
    if (error) return { error: error.message };
    revalidateCatalog();
    return { success: "Requisito actualizado" };
  }

  const { error } = await admin.from("requirement_types").insert({
    code: parsed.data.code,
    label: parsed.data.label,
    description: parsed.data.description,
    guidance: parsed.data.guidance,
    stage: parsed.data.stage ?? "FLOOR",
  });
  if (error) {
    if (error.code === "23505") return { error: "Ese código ya existe" };
    return { error: error.message };
  }
  revalidateCatalog();
  return { success: "Requisito creado. Sumalo a Andreani o Retira cliente abajo." };
}

export async function deleteRequirementTypeAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const user = await requireRole(["ADMIN"]);
  if (!canManageCatalog(user.role)) return { error: "No autorizado" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Requisito inválido" };

  const admin = createAdminClient();
  const { count, error: usedError } = await admin
    .from("delivery_requirements")
    .select("id", { count: "exact", head: true })
    .eq("requirement_type_id", id);
  if (usedError) return { error: usedError.message };
  if ((count ?? 0) > 0) {
    return { error: "No se puede eliminar: ya se usó en entregas. Sacalo de las plantillas si no lo necesitás." };
  }

  const { error: unlinkError } = await admin
    .from("template_requirements")
    .delete()
    .eq("requirement_type_id", id);
  if (unlinkError) return { error: unlinkError.message };

  const { error } = await admin.from("requirement_types").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateCatalog();
  return { success: "Requisito eliminado" };
}

export async function saveTemplateAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const user = await requireRole(["ADMIN"]);
  if (!canManageCatalog(user.role)) return { error: "No autorizado" };

  let requirements: unknown = [];
  try {
    requirements = JSON.parse(String(formData.get("requirements") ?? "[]"));
  } catch {
    return { error: "Plantilla inválida" };
  }

  const parsed = templateSaveSchema.safeParse({
    templateId: formData.get("templateId"),
    requirements,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const included = parsed.data.requirements.filter((item) => item.included);
  if (included.filter((item) => item.applicable && item.required).length === 0) {
    return { error: "La plantilla necesita al menos un requisito obligatorio" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("save_delivery_template", {
    p_template_id: parsed.data.templateId,
    p_requirements: included,
  });
  if (error) return { error: error.message };

  revalidateCatalog();
  return { success: "Plantilla guardada. Las entregas nuevas usan estos requisitos." };
}
