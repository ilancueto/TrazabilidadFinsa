import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistEvidence } from "@/lib/evidence/persist";
import { solidPng } from "../../../scripts/png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "CatLocal123!";

type RequirementType = { id: string; code: string; label: string };

function requireLocal() {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  expect(["127.0.0.1", "localhost"]).toContain(host);
  expect(anon).toBeTruthy();
  expect(serviceKey).toBeTruthy();
}

function client(key = anon) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email: string) {
  const sb = client();
  const login = await sb.auth.signInWithPassword({ email, password });
  expect(login.error, login.error?.message).toBeNull();
  return { sb, id: login.data.user!.id };
}

describe.sequential("workflow lifecycle integration", () => {
  let admin: SupabaseClient;
  let picking: SupabaseClient;
  let service: SupabaseClient;
  let adminId = "";
  let pickingId = "";
  let remito: RequirementType;
  let etiquetas: RequirementType;

  beforeAll(async () => {
    requireLocal();
    const adminSession = await signIn("ilan@cat.local");
    const pickingSession = await signIn("emilio@cat.local");
    admin = adminSession.sb;
    picking = pickingSession.sb;
    adminId = adminSession.id;
    pickingId = pickingSession.id;
    service = client(serviceKey);

    const types = await admin.from("requirement_types").select("id, code, label").in("code", ["REMITO", "ETIQUETAS"]);
    expect(types.error, types.error?.message).toBeNull();
    remito = (types.data ?? []).find((row) => row.code === "REMITO") as RequirementType;
    etiquetas = (types.data ?? []).find((row) => row.code === "ETIQUETAS") as RequirementType;
    expect(remito?.id).toBeTruthy();
    expect(etiquetas?.id).toBeTruthy();
  });

  afterAll(async () => {
    await admin?.auth.signOut();
    await picking?.auth.signOut();
  });

  function requirements(withDispatch = true) {
    const rows = [
      { typeId: remito.id, label: remito.label, required: true, applicable: true, displayOrder: 10 },
    ];
    if (withDispatch) {
      rows.push({ typeId: etiquetas.id, label: etiquetas.label, required: true, applicable: true, displayOrder: 20 });
    }
    return rows;
  }

  async function save(options: {
    number: string;
    intent?: "draft" | "publish";
    deliveryId?: string | null;
    expectedStatus?: "DRAFT" | "PUBLISHED" | null;
    destination?: string;
    assigneeId?: string | null;
    withDispatch?: boolean;
  }) {
    const result = await admin.rpc("save_delivery", {
      p_delivery_id: options.deliveryId ?? null,
      p_expected_status: options.expectedStatus ?? null,
      p_number: options.number,
      p_modality: "DESPACHO",
      p_carrier: "ANDREANI",
      p_destination: options.destination ?? "Cliente integración 3.2",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: options.assigneeId ?? null,
      p_due_at: null,
      p_observations: null,
      p_intent: options.intent ?? "publish",
      p_requirements: requirements(options.withDispatch !== false),
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(result.error, result.error?.message).toBeNull();
    expect(result.data).toBeTruthy();
    return result.data as string;
  }

  async function requirementId(deliveryId: string, typeId: string) {
    const req = await admin
      .from("delivery_requirements")
      .select("id")
      .eq("delivery_id", deliveryId)
      .eq("requirement_type_id", typeId)
      .maybeSingle();
    expect(req.error, req.error?.message).toBeNull();
    expect(req.data?.id).toBeTruthy();
    return req.data!.id as string;
  }

  async function upload(actor: SupabaseClient, actorId: string, reqId: string, filename: string) {
    return persistEvidence(actor, {
      actorId,
      actorRole: actor === admin ? "ADMIN" : "PICKING",
      requirementId: reqId,
      bytes: new Uint8Array(solidPng(40, 30, [200, 160, 20])),
      declaredMime: "image/png",
      filename,
    });
  }

  it("save_delivery crea y edita un DRAFT con control de estado esperado", async () => {
    const number = `I32-EDIT-${Date.now()}`;
    const id = await save({ number, intent: "draft", destination: "Destino inicial", withDispatch: false });

    const editedId = await save({
      number,
      intent: "draft",
      deliveryId: id,
      expectedStatus: "DRAFT",
      destination: "Destino editado",
      withDispatch: false,
    });
    expect(editedId).toBe(id);

    const row = await admin.from("deliveries").select("status, destination").eq("id", id).maybeSingle();
    expect(row.error).toBeNull();
    expect(row.data).toMatchObject({ status: "DRAFT", destination: "Destino editado" });

    const stale = await admin.rpc("save_delivery", {
      p_delivery_id: id,
      p_expected_status: "PUBLISHED",
      p_number: number,
      p_modality: "DESPACHO",
      p_carrier: "ANDREANI",
      p_destination: "No debe aplicar",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: null,
      p_due_at: null,
      p_observations: null,
      p_intent: "draft",
      p_requirements: requirements(false),
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(stale.error).toBeTruthy();
  });

  it("review, cierre normal y reapertura respetan RBAC y estado", async () => {
    const id = await save({ number: `I32-LIFE-${Date.now()}`, assigneeId: pickingId });
    const floorReq = await requirementId(id, remito.id);
    const dispatchReq = await requirementId(id, etiquetas.id);

    await upload(picking, pickingId, floorReq, "i32-floor.png");
    const ready = await picking.rpc("transition_delivery", {
      p_delivery_id: id,
      p_expected_status: "IN_PICKING",
      p_next_status: "READY",
      p_action: "READY",
      p_metadata: {},
    });
    expect(ready.error, ready.error?.message).toBeNull();

    const dispatch = await upload(picking, pickingId, dispatchReq, "i32-dispatch.png");

    const pickingReview = await picking.rpc("review_evidence", {
      p_evidence_id: dispatch.evidenceId,
      p_decision: "ACCEPTED",
      p_note: null,
      p_markup: null,
    });
    expect(pickingReview.error).toBeTruthy();

    const reviewed = await admin.rpc("review_evidence", {
      p_evidence_id: dispatch.evidenceId,
      p_decision: "ACCEPTED",
      p_note: null,
      p_markup: null,
    });
    expect(reviewed.error, reviewed.error?.message).toBeNull();

    const closed = await admin.rpc("transition_delivery", {
      p_delivery_id: id,
      p_expected_status: "READY",
      p_next_status: "CLOSED",
      p_action: "CLOSED",
      p_metadata: {},
    });
    expect(closed.error, closed.error?.message).toBeNull();

    const pickingReopen = await picking.rpc("transition_delivery", {
      p_delivery_id: id,
      p_expected_status: "CLOSED",
      p_next_status: "IN_PICKING",
      p_action: "REOPENED",
      p_metadata: { reason: "intento picking" },
    });
    expect(pickingReopen.error).toBeTruthy();

    const reopened = await admin.rpc("transition_delivery", {
      p_delivery_id: id,
      p_expected_status: "CLOSED",
      p_next_status: "IN_PICKING",
      p_action: "REOPENED",
      p_metadata: { reason: "prueba integración 3.2" },
    });
    expect(reopened.error, reopened.error?.message).toBeNull();

    const row = await admin.from("deliveries").select("status").eq("id", id).maybeSingle();
    expect(row.data?.status).toBe("IN_PICKING");
    const audit = await admin
      .from("audit_events")
      .select("action, metadata")
      .eq("delivery_id", id)
      .eq("action", "REOPENED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(audit.data?.action).toBe("REOPENED");
  });

  it("archive_delivery es Admin-only y deja soft-delete auditable", async () => {
    const number = `I32-ARCH-${Date.now()}`;
    const id = await save({ number, intent: "draft", withDispatch: false });

    const denied = await picking.rpc("archive_delivery", { p_delivery_id: id, p_confirm_number: number });
    expect(denied.error).toBeTruthy();

    const archived = await admin.rpc("archive_delivery", { p_delivery_id: id, p_confirm_number: number });
    expect(archived.error, archived.error?.message).toBeNull();
    expect(archived.data).toBe(id);

    const row = await service.from("deliveries").select("deleted_at, deleted_by").eq("id", id).maybeSingle();
    expect(row.error, row.error?.message).toBeNull();
    expect(row.data?.deleted_at).toBeTruthy();
    expect(row.data?.deleted_by).toBe(adminId);

    const audit = await service
      .from("audit_events")
      .select("action, metadata")
      .eq("delivery_id", id)
      .eq("action", "EDITED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(audit.data?.metadata).toMatchObject({ kind: "ARCHIVED" });
  });

  it("cierre excepcional sólo Admin, exige confirmación y audita bypass", async () => {
    const draftId = await save({ number: `I32-FORCE-D-${Date.now()}`, intent: "draft", withDispatch: false });
    const publishedId = await save({ number: `I32-FORCE-P-${Date.now()}`, assigneeId: pickingId });

    const denied = await picking.rpc("bulk_close_ready_deliveries", {
      p_reason: "prueba integración",
      p_confirmation: "CERRAR TODAS",
    });
    expect(denied.error).toBeTruthy();

    const badConfirmation = await admin.rpc("bulk_close_ready_deliveries", {
      p_reason: "prueba integración",
      p_confirmation: "NO",
    });
    expect(badConfirmation.error).toBeTruthy();

    const forced = await admin.rpc("bulk_close_ready_deliveries", {
      p_reason: "prueba integración 3.2",
      p_confirmation: "CERRAR TODAS",
    });
    expect(forced.error, forced.error?.message).toBeNull();
    expect(Number((forced.data as { closedCount?: number } | null)?.closedCount ?? 0)).toBeGreaterThanOrEqual(2);

    const rows = await service.from("deliveries").select("id, status").in("id", [draftId, publishedId]);
    expect(rows.error).toBeNull();
    expect((rows.data ?? []).every((row) => row.status === "CLOSED")).toBe(true);

    const audit = await service
      .from("audit_events")
      .select("metadata")
      .eq("delivery_id", draftId)
      .eq("action", "CLOSED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(audit.data?.metadata).toMatchObject({ exceptional: true, forced: true, bulk: true });
  });
});
