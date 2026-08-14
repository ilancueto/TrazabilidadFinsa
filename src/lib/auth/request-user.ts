import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth/session";
import { getPublicSupabaseConfig, getServiceRoleKey } from "@/lib/env";
import type { SessionUser } from "@/lib/types";

export async function getRequestUser(request: Request): Promise<SessionUser | null> {
  const fromCookies = await getSessionUser();
  if (fromCookies) return fromCookies;

  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const { url } = getPublicSupabaseConfig();
  const admin = createClient(url, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
  };
}

export function userScopedClient(accessToken: string) {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
