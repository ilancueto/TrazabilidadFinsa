import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile, SessionUser, UserRole } from "@/lib/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: (profile as Pick<Profile, "full_name" | "role">).full_name,
    role: (profile as Pick<Profile, "full_name" | "role">).role,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    redirect(user.role === "PICKING" ? "/picking" : "/admin");
  }
  return user;
}
