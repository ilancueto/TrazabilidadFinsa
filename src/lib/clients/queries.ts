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

export async function listClientAliases(): Promise<import("@/lib/types").ClientAlias[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("client_aliases")
    .select("id, client_id, alias, created_at, clients(name)")
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("client_aliases.list_failed", error, { operation: "client_aliases.list" });
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    client_id: String(row.client_id),
    alias: String(row.alias),
    created_at: String(row.created_at),
    client_name: (row.clients as { name?: string } | null)?.name ?? "Cliente",
  }));
}

