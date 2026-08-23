import "server-only";

import { isUuid } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";
import { AUDIT_FILTER_ACTIONS, type AuditFilterAction } from "@/lib/audit/presentation";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
export const DEFAULT_AUDIT_PAGE_SIZE = 50;
export const MAX_AUDIT_PAGE_SIZE = 100;
const MAX_AUDIT_DAYS = 366;

export type AuditCursor = { createdAt: string; id: string };
export type AuditFilters = {
  from?: string;
  to?: string;
  actorId?: string;
  delivery?: string;
  action?: AuditFilterAction;
  reason?: string;
  pageSize?: number;
  cursor?: string;
};
export type ResolvedAuditFilters = Omit<AuditFilters, "from" | "to" | "cursor" | "pageSize"> & {
  from: string;
  to: string;
  pageSize: number;
  cursor: AuditCursor | null;
};
export type AuditPanelEvent = {
  id: string;
  delivery_id: string;
  actor_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  delivery: { id: string; number: string; deleted_at: string | null } | null;
  actor: { id: string; full_name: string; deleted_at: string | null } | null;
};

export class AuditFilterError extends Error {}

function argentinaDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addCalendarDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function parseDay(day: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(`${day}T12:00:00Z`).getTime())) {
    throw new AuditFilterError(`${name} debe tener formato YYYY-MM-DD`);
  }
  return day;
}

function argentinaMidnight(day: string) {
  // Argentina/Buenos_Aires is UTC-03:00; this explicit conversion prevents the server timezone changing the date boundary.
  return new Date(`${day}T00:00:00-03:00`).toISOString();
}

export function encodeAuditCursor(cursor: AuditCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function parseAuditCursor(raw: string | undefined): AuditCursor | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AuditCursor;
    if (!value || typeof value.createdAt !== "string" || typeof value.id !== "string" || !isUuid(value.id) || Number.isNaN(new Date(value.createdAt).getTime())) {
      throw new Error("invalid");
    }
    return value;
  } catch {
    throw new AuditFilterError("Cursor de auditoría inválido");
  }
}

export function escapeIlikeLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/\*/g, "\\*").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function cleanReason(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  if (trimmed.length > 200) throw new AuditFilterError("El motivo admite hasta 200 caracteres");
  if (/\p{C}/u.test(trimmed)) throw new AuditFilterError("El motivo contiene caracteres de control no permitidos");
  return trimmed;
}

export function resolveAuditFilters(input: AuditFilters = {}, now = new Date()): ResolvedAuditFilters {
  const today = argentinaDay(now);
  const fromDay = parseDay(input.from ?? addCalendarDays(today, -29), "Desde");
  const toDay = parseDay(input.to ?? today, "Hasta");
  const diff = Math.round((new Date(`${toDay}T12:00:00Z`).getTime() - new Date(`${fromDay}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff < 0) throw new AuditFilterError("Hasta no puede ser anterior a Desde");
  if (diff + 1 > MAX_AUDIT_DAYS) throw new AuditFilterError("El rango máximo es de 366 días");
  if (input.actorId && !isUuid(input.actorId)) throw new AuditFilterError("Usuario inválido");
  const delivery = input.delivery?.trim();
  if (delivery && delivery.length > 100) throw new AuditFilterError("La entrega admite hasta 100 caracteres");
  if (input.action && !(AUDIT_FILTER_ACTIONS as readonly string[]).includes(input.action)) throw new AuditFilterError("Acción inválida");
  const requestedPageSize = input.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE;
  const pageSize = Math.min(MAX_AUDIT_PAGE_SIZE, Math.max(1, Number.isInteger(requestedPageSize) ? requestedPageSize : DEFAULT_AUDIT_PAGE_SIZE));
  return { from: argentinaMidnight(fromDay), to: argentinaMidnight(addCalendarDays(toDay, 1)), actorId: input.actorId, delivery: delivery || undefined, action: input.action, reason: cleanReason(input.reason), pageSize, cursor: parseAuditCursor(input.cursor) };
}

type Clause = [field: string, operator: "eq" | "neq" | "or", value: string];
type AuditResult = { data: unknown[] | null; error: { message: string } | null };
type AuditQuery = PromiseLike<AuditResult> & {
  select(columns: string): AuditQuery;
  gte(field: string, value: string): AuditQuery;
  lt(field: string, value: string): AuditQuery;
  eq(field: string, value: string): AuditQuery;
  neq(field: string, value: string): AuditQuery;
  or(expression: string): AuditQuery;
  ilike(field: string, value: string): AuditQuery;
  order(field: string, options: { ascending: boolean }): AuditQuery;
  limit(count: number): AuditQuery;
};
type AuditSupabase = { from(table: "audit_events"): AuditQuery };
export function auditActionClauses(action: AuditFilterAction): Clause[] {
  const kindNot = (kind: string): Clause => ["metadata->>kind", "or", `metadata->>kind.is.null,metadata->>kind.neq.${kind}`];
  switch (action) {
    case "EDITED": return [["action", "eq", "EDITED"], kindNot("ARCHIVED")];
    case "ASSIGNED": return [["action", "eq", "ASSIGNED"], kindNot("CLAIMED"), kindNot("REASSIGNED")];
    case "CLAIMED": return [["action", "or", "action.eq.CLAIMED,and(action.eq.ASSIGNED,metadata->>kind.eq.CLAIMED)"]];
    case "REASSIGNED": return [["action", "or", "action.eq.REASSIGNED,and(action.eq.ASSIGNED,metadata->>kind.eq.REASSIGNED)"]];
    case "EVIDENCE_VOIDED": return [["action", "eq", "EVIDENCE_VOIDED"], kindNot("EVIDENCE_REVIEWED")];
    case "EVIDENCE_REVIEWED": return [["action", "or", "action.eq.EVIDENCE_REVIEWED,and(action.eq.EVIDENCE_VOIDED,metadata->>kind.eq.EVIDENCE_REVIEWED)"]];
    case "OBSERVATION_ADDED": return [["action", "eq", "OBSERVATION_ADDED"], kindNot("RETURNED")];
    case "RETURNED": return [["action", "or", "action.eq.RETURNED,and(action.eq.OBSERVATION_ADDED,metadata->>kind.eq.RETURNED)"]];
    case "ARCHIVED": return [["action", "eq", "EDITED"], ["metadata->>kind", "eq", "ARCHIVED"]];
    default: return [["action", "eq", action]];
  }
}

function applyClauses(query: AuditQuery, clauses: Clause[]) {
  for (const [field, operator, value] of clauses) query = operator === "or" ? query.or(value) : query[operator](field, value);
  return query;
}

export function auditCursorPredicate(cursor: AuditCursor) {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

function buildAuditQuery(supabase: AuditSupabase, filters: ResolvedAuditFilters, reasonField?: "reason" | "text" | "note") {
  let query = supabase
    .from("audit_events")
    .select("id, delivery_id, actor_id, action, metadata, before, after, created_at, delivery:deliveries!inner(id, number, deleted_at), actor:profiles!actor_id(id, full_name, deleted_at)")
    .gte("created_at", filters.from)
    .lt("created_at", filters.to);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.delivery) query = isUuid(filters.delivery) ? query.eq("delivery_id", filters.delivery) : query.ilike("delivery.number", `%${escapeIlikeLiteral(filters.delivery)}%`);
  if (filters.action) query = applyClauses(query, auditActionClauses(filters.action));
  if (filters.cursor) query = query.or(auditCursorPredicate(filters.cursor));
  if (reasonField && filters.reason) query = query.ilike(`metadata->>${reasonField}`, `%${escapeIlikeLiteral(filters.reason)}%`);
  return query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(filters.pageSize + 1);
}

export async function listAuditEvents(input: AuditFilters = {}) {
  const filters = resolveAuditFilters(input);
  const supabase = await createServerSupabase();
  const reasonFields: Array<"reason" | "text" | "note" | undefined> = filters.reason ? ["reason", "text", "note"] : [undefined];
  const results = await Promise.all(reasonFields.map(async (field) => await buildAuditQuery(supabase as unknown as AuditSupabase, filters, field)));
  for (const result of results) if (result.error) throw new Error(result.error.message);
  const byId = new Map<string, AuditPanelEvent>();
  for (const result of results) for (const event of (result.data ?? []) as AuditPanelEvent[]) byId.set(event.id, event);
  const ordered = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const hasMore = ordered.length > filters.pageSize;
  const events = ordered.slice(0, filters.pageSize);
  const last = events.at(-1);
  return { events, filters, hasMore, nextCursor: hasMore && last ? encodeAuditCursor({ createdAt: last.created_at, id: last.id }) : null };
}

export async function listAuditProfiles() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("profiles").select("id, full_name, deleted_at").order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; full_name: string; deleted_at: string | null }>;
}
