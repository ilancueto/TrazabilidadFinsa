"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  success?: string;
};

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Ingresá email y contraseña" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Credenciales inválidas" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No se pudo iniciar sesión" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  if (profile?.must_change_password) {
    redirect("/cambiar-clave");
  }
  if (next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }
  redirect(role === "PICKING" ? "/picking" : "/admin");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres" };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden" };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "La sesión venció. Volvé a ingresar." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: false, password_changed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profileError) {
    return { error: "La clave cambió, pero no pudimos habilitar el acceso. Intentá guardarla otra vez." };
  }

  if (profile?.must_change_password) {
    redirect(profile.role === "PICKING" ? "/picking" : "/admin");
  }
  return { success: "Contraseña actualizada" };
}
