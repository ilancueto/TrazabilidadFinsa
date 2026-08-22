import { createServerSupabase } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import { logServerError } from "@/lib/observability";

export async function listClients(options?: {
  activeOnly?: boolean;
  search?: string;
}): Promise<Client[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from("clients").select("*").order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  if (options?.search?.trim()) {
    query = query.ilike("name", `%${options.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    logServerError("clients.list_failed", error, { operation: "clients.list" });
    return [];
  }

  return (data as Client[]) ?? [];
}

export async function getClientById(id: string): Promise<Client | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Client;
}
