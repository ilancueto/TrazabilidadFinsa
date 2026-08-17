import "server-only";
import type { User } from "@supabase/supabase-js";

import { computeProgress } from "@/lib/deliveries/progress";
import { buildRequirementDrafts } from "@/lib/deliveries/templates";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { isUuid } from "@/lib/utils";

export type DeliveryFilters = {
  q?: string;
  status?: DeliveryStatus | "ALL";
  modality?: DeliveryModality | "ALL";
  priority?: DeliveryPriority | "ALL";
  assigneeId?: string | "ALL" | "NONE";
  onlyCritical?: boolean;
  hideClosed?: boolean;
  limit?: number;
  ids?: string[];
  page?: number;
  includeArchived?: boolean;
  excludeDraft?: boolean;
};

type DeliveryRow = Delivery & {
  assignee: Pick<Profile, "id" | "full_name" | "role"> | null;
};

type RequirementProgressRow = Pick<
  DeliveryRequirement,
  "id" | "delivery_id" | "applicable" | "required" | "status" | "label"
>;

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
    .select("id, code, label, description, guidance")
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []) as RequirementType[];
}

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: import("@/lib/types").UserRole;
  createdAt: string;
  disabled: boolean;
  mustChangePassword: boolean;
};

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  const authUsers: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    authUsers.push(...data.users);
    if (data.users.length < 200) break;
  }
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, role, active, disabled_at, must_change_password, created_at")
    .is("deleted_at", null);
  if (profileError) throw new Error(profileError.message);

  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string; role: string; active: boolean; disabled_at: string | null; must_change_password: boolean; created_at: string }>).map(
      (row) => [row.id, row],
    ),
  );

  return authUsers
    .map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name || user.user_metadata?.full_name || user.email || "Sin nombre",
        role: (profile?.role === "ADMIN" || profile?.role === "SUPERVISOR"
          ? profile.role
          : "PICKING") as import("@/lib/types").UserRole,
        createdAt: profile?.created_at ?? user.created_at,
        disabled:
          profile?.active === false ||
          Boolean(user.banned_until && new Date(user.banned_until) > new Date()),
        mustChangePassword: profile?.must_change_password ?? true,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
}

export async function listPickingProfiles(): Promise<Profile[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, disabled_at, created_at, updated_at")
    .eq("role", "PICKING")
    .eq("active", true)
    .is("deleted_at", null)
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function listDeliveries(filters: DeliveryFilters = {}): Promise<DeliveryListItem[]> {
  const supabase = await createServerSupabase();
  const pageSize = filters.limit ?? Math.max(filters.ids?.length ?? 0, 50);
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("deliveries")
    .select(
      "id, number, modality, destination, packages, priority, status, assignee_id, created_by, observations, has_open_observation, published_at, ready_at, due_at, closed_at, closed_by, created_at, updated_at, deleted_at, deleted_by, assignee:profiles!assignee_id(id, full_name, role)",
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.ids) {
    if (filters.ids.length === 0) return [];
    query = query.in("id", filters.ids);
  }
  if (!filters.includeArchived) query = query.is("deleted_at", null);
  if (filters.excludeDraft) query = query.neq("status", "DRAFT");

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  } else if (filters.hideClosed) {
    query = query.neq("status", "CLOSED");
  }
  if (filters.modality && filters.modality !== "ALL") {
    query = query.eq("modality", filters.modality);
  }
  if (filters.priority && filters.priority !== "ALL") {
    query = query.eq("priority", filters.priority);
  }
  if (filters.assigneeId === "NONE") {
    query = query.is("assignee_id", null);
  } else if (filters.assigneeId && filters.assigneeId !== "ALL") {
    query = query.eq("assignee_id", filters.assigneeId);
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim().replace(/[,()%]/g, " ").slice(0, 80);
    query = query.or(`number.ilike.%${q}%,destination.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as DeliveryRow[];
  const ids = rows.map((row) => row.id);
  const requirementsByDelivery = new Map<string, RequirementProgressRow[]>();

  if (ids.length > 0) {
    const { data: reqs, error: reqError } = await supabase
      .from("delivery_requirements")
      .select("id, delivery_id, label, required, applicable, status")
      .in("delivery_id", ids)
      .order("display_order", { ascending: true });
    if (reqError) throw new Error(reqError.message);
    for (const req of (reqs ?? []) as unknown as RequirementProgressRow[]) {
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

  return filtered.sort(compareDeliveries);
}

export async function countDeliveries(filters: DeliveryFilters = {}): Promise<number> {
  const supabase = await createServerSupabase();
  let query = supabase.from("deliveries").select("id", { count: "exact", head: true });
  if (!filters.includeArchived) query = query.is("deleted_at", null);
  if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
  else if (filters.hideClosed) query = query.neq("status", "CLOSED");
  if (filters.excludeDraft) query = query.neq("status", "DRAFT");
  if (filters.modality && filters.modality !== "ALL") query = query.eq("modality", filters.modality);
  if (filters.priority && filters.priority !== "ALL") query = query.eq("priority", filters.priority);
  if (filters.assigneeId === "NONE") query = query.is("assignee_id", null);
  else if (filters.assigneeId && filters.assigneeId !== "ALL") query = query.eq("assignee_id", filters.assigneeId);
  if (filters.q?.trim()) {
    const q = filters.q.trim().replace(/[,()%]/g, " ").slice(0, 80);
    query = query.or(`number.ilike.%${q}%,destination.ilike.%${q}%`);
  }
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function compareDeliveries(a: DeliveryListItem, b: DeliveryListItem): number {
  const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 };
  const byPriority = rank[a.priority] - rank[b.priority];
  if (byPriority !== 0) return byPriority;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export async function getDashboardKpis() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("dashboard_kpis");
  if (error) throw new Error(error.message);
  const row = data?.[0] as {
    active: number | string;
    picking: number | string;
    ready: number | string;
    observations: number | string;
  } | undefined;

  return {
    active: Number(row?.active ?? 0),
    picking: Number(row?.picking ?? 0),
    ready: Number(row?.ready ?? 0),
    observations: Number(row?.observations ?? 0),
  };
}

export type OperationalAlert = {
  id: string;
  number: string;
  label: string;
  href: string;
};

export function buildOperationalAlerts(
  deliveries: DeliveryListItem[],
  now = new Date(),
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  for (const row of deliveries) {
    const href = adminDeliveryPath(row.number);
    if (
      row.priority === "URGENT" &&
      (row.status === "PUBLISHED" || row.status === "IN_PICKING") &&
      row.progress.pendingRequired > 0
    ) {
      const started = row.published_at ?? row.created_at;
      if (now.getTime() - new Date(started).getTime() >= 30 * 60 * 1000) {
        alerts.push({
          id: `${row.id}-urgent`,
          number: row.number,
          label: "Urgente sin foto",
          href,
        });
      }
    }
    if (row.status === "READY" && row.ready_at) {
      if (now.getTime() - new Date(row.ready_at).getTime() >= 2 * 60 * 60 * 1000) {
        alerts.push({
          id: `${row.id}-ready`,
          number: row.number,
          label: "Lista sin cerrar",
          href: adminDeliveryPath(row.number, "/revisar"),
        });
      }
    }
    if (row.has_open_observation && row.status !== "CLOSED") {
      alerts.push({
        id: `${row.id}-obs`,
        number: row.number,
        label: "Observación abierta",
        href,
      });
    }
  }
  return alerts;
}

export type DayReport = {
  date: string;
  published: number;
  ready: number;
  closed: number;
  urgentOpen: number;
  observations: number;
  avgFirstPhotoMinutes: number | null;
  avgReadyToCloseMinutes: number | null;
  open: DeliveryListItem[];
};

export async function getDayReport(dateYmd: string): Promise<DayReport> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("day_report", { p_date: dateYmd });
  if (error) throw new Error(error.message);
  const metrics = (data?.[0] ?? null) as {
    published: number;
    ready: number;
    closed: number;
    urgent_open: number;
    observations: number;
    avg_first_photo_minutes: number | null;
    avg_ready_to_close_minutes: number | null;
    open_ids: string[];
  } | null;
  if (!metrics) throw new Error("No se pudo construir el cierre de día");
  const open = await listDeliveries({ ids: metrics.open_ids, hideClosed: false, limit: metrics.open_ids.length || 1, includeArchived: true });

  return {
    date: dateYmd,
    published: Number(metrics.published),
    ready: Number(metrics.ready),
    closed: Number(metrics.closed),
    urgentOpen: Number(metrics.urgent_open),
    observations: Number(metrics.observations),
    avgFirstPhotoMinutes: metrics.avg_first_photo_minutes,
    avgReadyToCloseMinutes: metrics.avg_ready_to_close_minutes,
    open: open.sort(compareDeliveries),
  };
}

export type CatalogTemplate = {
  id: string;
  code: string;
  label: string;
  modality: DeliveryModality;
  requirements: Array<{
    id: string;
    typeId: string;
    typeCode: string;
    label: string;
    required: boolean;
    applicable: boolean;
    displayOrder: number;
  }>;
};

export async function listCatalogTemplates(): Promise<CatalogTemplate[]> {
  const supabase = await createServerSupabase();
  const [templateResult, requirementResult] = await Promise.all([
    supabase.from("delivery_templates").select("id, code, label, modality").order("label"),
    supabase
      .from("template_requirements")
      .select(
        "id, template_id, requirement_type_id, required, applicable, display_order, requirement_types(id, code, label)",
      )
      .order("display_order"),
  ]);
  const { data: templates, error } = templateResult;
  if (error) throw new Error(error.message);
  const { data: rows, error: reqError } = requirementResult;
  if (reqError) throw new Error(reqError.message);

  return (templates ?? []).map((template) => ({
    ...(template as { id: string; code: string; label: string; modality: DeliveryModality }),
    requirements: ((rows ?? []) as unknown as Array<{
      id: string;
      template_id: string;
      requirement_type_id: string;
      required: boolean;
      applicable: boolean;
      display_order: number;
      requirement_types: { id: string; code: string; label: string } | { id: string; code: string; label: string }[] | null;
    }>)
      .filter((row) => row.template_id === template.id)
      .map((row) => {
        const type = unwrapRel(row.requirement_types);
        return {
          id: row.id,
          typeId: row.requirement_type_id,
          typeCode: type?.code ?? "",
          label: type?.label ?? "",
          required: row.required,
          applicable: row.applicable,
          displayOrder: row.display_order,
        };
      }),
  }));
}

export function templatesToDrafts(
  templates: CatalogTemplate[],
  types: RequirementType[],
): Record<DeliveryModality, import("@/lib/types").RequirementDraft[]> {
  const typeIds = Object.fromEntries(types.map((type) => [type.code, type.id]));
  const labels = Object.fromEntries(types.map((type) => [type.code, type.label]));
  const empty: Record<DeliveryModality, import("@/lib/types").RequirementDraft[]> = {
    ANDREANI: [],
    CUSTOMER_PICKUP: [],
  };

  for (const template of templates) {
    empty[template.modality] = template.requirements.map((req) => ({
      typeCode: req.typeCode,
      typeId: req.typeId,
      label: req.label,
      required: req.required,
      applicable: req.applicable,
      displayOrder: req.displayOrder,
    }));
  }

  for (const modality of Object.keys(empty) as DeliveryModality[]) {
    if (empty[modality].length === 0) {
      empty[modality] = buildRequirementDrafts(modality, typeIds, labels);
    }
  }

  return empty;
}

export async function getDeliveryDetail(reference: string): Promise<DeliveryDetail | null> {
  const supabase = await createServerSupabase();
  let deliveryQuery = supabase
    .from("deliveries")
    .select(
      "id, number, modality, destination, packages, priority, status, assignee_id, created_by, observations, has_open_observation, published_at, ready_at, due_at, closed_at, closed_by, created_at, updated_at, deleted_at, deleted_by",
    )
    .is("deleted_at", null);
  deliveryQuery = isUuid(reference)
    ? deliveryQuery.eq("id", reference)
    : deliveryQuery.eq("number", reference);
  const { data: delivery, error } = await deliveryQuery.maybeSingle();

  if (error) throw new Error(error.message);
  if (!delivery) return null;

  const deliveryId = delivery.id;
  const profileIds = [delivery.created_by, delivery.assignee_id, delivery.closed_by].filter(Boolean) as string[];
  const profilesPromise = profileIds.length > 0
    ? supabase
        .from("profiles")
        .select("id, full_name, role, active, disabled_at, created_at, updated_at")
        .in("id", profileIds)
    : Promise.resolve({ data: [], error: null });
  const requirementsPromise = supabase
    .from("delivery_requirements")
    .select(
      "id, delivery_id, requirement_type_id, label, required, applicable, status, display_order, created_at, updated_at, requirement_types(code, guidance)",
    )
    .eq("delivery_id", deliveryId)
    .order("display_order");
  const auditPromise = supabase
    .from("audit_events")
    .select(
      "id, delivery_id, actor_id, action, metadata, before, after, created_at, actor:profiles!actor_id(full_name)",
    )
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });

  const [profileResult, requirementResult, auditResult] = await Promise.all([
    profilesPromise,
    requirementsPromise,
    auditPromise,
  ]);
  const { data: profiles, error: profileError } = profileResult;
  if (profileError) throw new Error(profileError.message);
  const profileMap = new Map((profiles as Profile[] | null)?.map((p) => [p.id, p]) ?? []);

  const { data: requirements, error: reqError } = requirementResult;
  if (reqError) throw new Error(reqError.message);

  const reqRows = (requirements ?? []) as unknown as Array<
    DeliveryRequirement & {
      requirement_types:
        | { code: RequirementTypeCode; guidance: string | null }
        | { code: RequirementTypeCode; guidance: string | null }[]
        | null;
    }
  >;
  const reqIds = reqRows.map((row) => row.id);

  let evidences: Array<Evidence & { uploader: { full_name: string } | { full_name: string }[] | null }> =
    [];
  if (reqIds.length > 0) {
    const { data: evs, error: evError } = await supabase
      .from("evidences")
      .select(
        "id, requirement_id, provider, storage_key, thumbnail_storage_key, thumbnail_mime_type, thumbnail_size_bytes, filename, mime_type, size_bytes, width, height, checksum, comment, uploader_id, voided_at, voided_by, void_reason, review_status, review_note, created_at, uploader:profiles!uploader_id(full_name)",
      )
      .in("requirement_id", reqIds)
      .order("created_at", { ascending: false });
    if (evError) throw new Error(evError.message);
    evidences = (evs ?? []) as unknown as typeof evidences;
  }

  const { data: audit, error: auditError } = auditResult;
  if (auditError) throw new Error(auditError.message);

  const requirementViews = reqRows.map((req) => ({
    ...req,
    type_code: unwrapRel(req.requirement_types)?.code ?? "REMITO",
    guidance: unwrapRel(req.requirement_types)?.guidance ?? null,
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
