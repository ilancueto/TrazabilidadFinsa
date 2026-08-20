import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { DeliveryModality } from "@/lib/types";

export async function getSectionKpis(modality: DeliveryModality) {
  const supabase = await createServerSupabase();

  const [active, picking, ready, observations] = await Promise.all([
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("modality", modality)
      .neq("status", "CLOSED")
      .is("deleted_at", null),
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("modality", modality)
      .eq("status", "IN_PICKING")
      .is("deleted_at", null),
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("modality", modality)
      .eq("status", "READY")
      .is("deleted_at", null),
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("modality", modality)
      .eq("has_open_observation", true)
      .neq("status", "CLOSED")
      .is("deleted_at", null),
  ]);

  for (const result of [active, picking, ready, observations]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    active: active.count ?? 0,
    picking: picking.count ?? 0,
    ready: ready.count ?? 0,
    observations: observations.count ?? 0,
  };
}
