import "server-only";

import { computeProgress } from "@/lib/deliveries/progress";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  AuditEvent,
  Delivery,
  DeliveryDetail,
  DeliveryListItem,
  DeliveryModality,
  DeliveryPriority,
  DeliveryRequirement,
  DeliveryStatus,
  Evidence,
  Profile,
  RequirementType,
  RequirementTypeCode,
} from "@/lib/types";

export type DeliveryFilters = {
  q?: string;
  status?: DeliveryStatus | "ALL";
  modality?: DeliveryModality | "ALL";
  priority?: DeliveryPriority | "ALL";
  assigneeId?: string | "ALL";
  onlyCritical?: boolean;
};

type DeliveryRow = Delivery & {
  assignee: Pick<Profile, "id" | "full_name" | "role"> | null;
};

function asDelivery(row: Delivery): Delivery {
  return row;
}

function unwrapRel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listRequirementTypes(): Promise<RequirementType[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("requirement_types")
    .select("id, code, label, description")
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []) as RequirementType[];
}

export async function listPickingProfiles(): Promise<Profile[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at")
    .eq("role", "PICKING")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function listDeliveries(filters: DeliveryFilters = {}): Promise<DeliveryListItem[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("deliveries")
    .select(
      "id, number, modality, destination, packages, priority, status, assignee_id, created_by, observations, has_open_observation, published_at, ready_at, closed_at, closed_by, created_at, updated_at, assignee:profiles!assignee_id(id, full_name, role)",
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }
  if (filters.modality && filters.modality !== "ALL") {
    query = query.eq("modality", filters.modality);
  }
  if (filters.priority && filters.priority !== "ALL") {
    query = query.eq("priority", filters.priority);
  }
  if (filters.assigneeId && filters.assigneeId !== "ALL") {
    query = query.eq("assignee_id", filters.assigneeId);
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(`number.ilike.%${q}%,destination.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as DeliveryRow[];
  const ids = rows.map((row) => row.id);
  const requirementsByDelivery = new Map<string, DeliveryRequirement[]>();

  if (ids.length > 0) {
    const { data: reqs, error: reqError } = await supabase
      .from("delivery_requirements")
      .select(
        "id, delivery_id, requirement_type_id, label, required, applicable, status, display_order, created_at, updated_at",
      )
      .in("delivery_id", ids);
    if (reqError) throw new Error(reqError.message);
    for (const req of (reqs ?? []) as DeliveryRequirement[]) {
      const list = requirementsByDelivery.get(req.delivery_id) ?? [];
      list.push(req);
      requirementsByDelivery.set(req.delivery_id, list);
    }
  }

  const items = rows.map((row) => {
    const progress = computeProgress(requirementsByDelivery.get(row.id) ?? []);
    return {
      ...asDelivery(row),
      assignee_name: row.assignee?.full_name ?? null,
      progress,
    };
  });

  const filtered = filters.onlyCritical
    ? items.filter((item) => item.has_open_observation || item.progress.pendingRequired > 0)
    : items;

  return filtered.sort((a, b) => {
    const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 };
    const byPriority = rank[a.priority] - rank[b.priority];
    if (byPriority !== 0) return byPriority;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export async function getDashboardKpis() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, status, has_open_observation");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    active: rows.filter((row) => row.status !== "CLOSED" && row.status !== "DRAFT").length,
    picking: rows.filter((row) => row.status === "IN_PICKING").length,
    ready: rows.filter((row) => row.status === "READY").length,
    observations: rows.filter((row) => row.has_open_observation && row.status !== "CLOSED").length,
  };
}

export async function getDeliveryDetail(id: string): Promise<DeliveryDetail | null> {
  const supabase = await createServerSupabase();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select(
      "id, number, modality, destination, packages, priority, status, assignee_id, created_by, observations, has_open_observation, published_at, ready_at, closed_at, closed_by, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!delivery) return null;

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at")
    .in(
      "id",
      [delivery.created_by, delivery.assignee_id, delivery.closed_by].filter(Boolean) as string[],
    );
  if (profileError) throw new Error(profileError.message);
  const profileMap = new Map((profiles as Profile[] | null)?.map((p) => [p.id, p]) ?? []);

  const { data: requirements, error: reqError } = await supabase
    .from("delivery_requirements")
    .select(
      "id, delivery_id, requirement_type_id, label, required, applicable, status, display_order, created_at, updated_at, requirement_types(code)",
    )
    .eq("delivery_id", id)
    .order("display_order");
  if (reqError) throw new Error(reqError.message);

  const reqRows = (requirements ?? []) as unknown as Array<
    DeliveryRequirement & {
      requirement_types: { code: RequirementTypeCode } | { code: RequirementTypeCode }[] | null;
    }
  >;
  const reqIds = reqRows.map((row) => row.id);

  let evidences: Array<Evidence & { uploader: { full_name: string } | { full_name: string }[] | null }> =
    [];
  if (reqIds.length > 0) {
    const { data: evs, error: evError } = await supabase
      .from("evidences")
      .select(
        "id, requirement_id, provider, storage_key, filename, mime_type, size_bytes, width, height, checksum, comment, uploader_id, voided_at, voided_by, void_reason, created_at, uploader:profiles!uploader_id(full_name)",
      )
      .in("requirement_id", reqIds)
      .order("created_at", { ascending: false });
    if (evError) throw new Error(evError.message);
    evidences = (evs ?? []) as unknown as typeof evidences;
  }

  const { data: audit, error: auditError } = await supabase
    .from("audit_events")
    .select(
      "id, delivery_id, actor_id, action, metadata, before, after, created_at, actor:profiles!actor_id(full_name)",
    )
    .eq("delivery_id", id)
    .order("created_at", { ascending: true });
  if (auditError) throw new Error(auditError.message);

  const requirementViews = reqRows.map((req) => ({
    ...req,
    type_code: unwrapRel(req.requirement_types)?.code ?? "REMITO",
    evidences: evidences
      .filter((ev) => ev.requirement_id === req.id)
      .map((ev) => ({
        ...ev,
        uploader_name: unwrapRel(ev.uploader)?.full_name ?? null,
      })),
  }));

  return {
    ...(delivery as Delivery),
    assignee: delivery.assignee_id ? profileMap.get(delivery.assignee_id) ?? null : null,
    creator: profileMap.get(delivery.created_by) ?? null,
    closer: delivery.closed_by ? profileMap.get(delivery.closed_by) ?? null : null,
    requirements: requirementViews,
    audit: (
      (audit ?? []) as unknown as Array<
        AuditEvent & { actor: { full_name: string } | { full_name: string }[] | null }
      >
    ).map((event) => ({
      ...event,
      actor_name: unwrapRel(event.actor)?.full_name ?? null,
    })),
    progress: computeProgress(requirementViews),
  };
}
