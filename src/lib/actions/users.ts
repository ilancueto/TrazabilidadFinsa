"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/deliveries/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";
import { z } from "zod";
import {
  createUserSchema,
  deleteUserSchema,
  resetUserPasswordSchema,
  updateUserRoleSchema,
} from "@/lib/validations/delivery";

export type UserActionState = {
  error?: string;
  success?: string;
};

function revalidateUsers() {
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/deliveries/new");
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requireRole(["ADMIN"]);
  if (!canManageUsers(actor.role)) return { error: "No autorizado" };

  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) {
      return { error: "Ese email ya tiene usuario" };
    }
    return { error: error?.message ?? "No se pudo crear el usuario" };
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    active: true,
    disabled_at: null,
    must_change_password: true,
    password_changed_at: null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `No se pudo guardar el perfil: ${profileError.message}` };
  }

  revalidateUsers();
  return { success: `Listo. ${parsed.data.fullName} ya puede ingresar con ese email y contraseña.` };
}

export async function updateUserRoleAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requireRole(["ADMIN"]);
  if (!canManageUsers(actor.role)) return { error: "No autorizado" };

  const parsed = updateUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  if (parsed.data.userId === actor.id && parsed.data.role !== "ADMIN") {
    return { error: "No podés quitarte el acceso de administración a vos mismo" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role as UserRole })
    .eq("id", parsed.data.userId);
  if (error) return { error: error.message };

  revalidateUsers();
  return { success: "Acceso actualizado" };
}

export async function resetUserPasswordAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requireRole(["ADMIN"]);
  if (!canManageUsers(actor.role)) return { error: "No autorizado" };

  const parsed = resetUserPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true, password_changed_at: null })
    .eq("id", parsed.data.userId);
  if (profileError) return { error: profileError.message };

  revalidateUsers();
  return { success: "Contraseña temporal actualizada. El usuario deberá reemplazarla al ingresar." };
}

export async function deleteUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requireRole(["ADMIN"]);
  if (!canManageUsers(actor.role)) return { error: "No autorizado" };

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
    confirmEmail: formData.get("confirmEmail"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  if (parsed.data.userId === actor.id) {
    return { error: "No podés eliminar tu propio usuario" };
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(parsed.data.userId);
  if (authError || !authData.user) return { error: "Usuario no encontrado" };

  const email = (authData.user.email ?? "").trim().toLowerCase();
  if (email !== parsed.data.confirmEmail.trim().toLowerCase()) {
    return { error: "El email no coincide. Escribilo para confirmar." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, active, disabled_at, deleted_at, deleted_by")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!profile) return { error: "Perfil no encontrado" };

  if (profile?.role === "ADMIN") {
    const { count, error: adminCountError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "ADMIN")
      .eq("active", true)
      .is("deleted_at", null)
      .neq("id", parsed.data.userId);
    if (adminCountError) return { error: adminCountError.message };
    if ((count ?? 0) === 0) {
      return { error: "No se puede eliminar al único usuario de Administración" };
    }
  }

  const deletedAt = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      active: false,
      disabled_at: profile.disabled_at ?? deletedAt,
      deleted_at: deletedAt,
      deleted_by: actor.id,
    })
    .eq("id", parsed.data.userId);
  if (profileError) return { error: profileError.message };

  const { error: deleteError } = await admin.auth.admin.deleteUser(parsed.data.userId);
  if (deleteError) {
    await admin
      .from("profiles")
      .update({
        active: profile.active,
        disabled_at: profile.disabled_at,
        deleted_at: profile.deleted_at,
        deleted_by: profile.deleted_by,
      })
      .eq("id", parsed.data.userId);
    return { error: `No se pudo eliminar la cuenta: ${deleteError.message}` };
  }

  revalidateUsers();
  return { success: "Cuenta eliminada. Las fotos y el historial conservan el nombre del autor." };
}

const reactivateUserSchema = z.object({ userId: z.string().uuid() });

export async function reactivateUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requireRole(["ADMIN"]);
  if (!canManageUsers(actor.role)) return { error: "No autorizado" };
  const parsed = reactivateUserSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { error: "Usuario inválido" };

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: "none",
  });
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ active: true, disabled_at: null })
    .eq("id", parsed.data.userId)
    .is("deleted_at", null);
  if (profileError) return { error: profileError.message };

  revalidateUsers();
  return { success: "Acceso reactivado" };
}
