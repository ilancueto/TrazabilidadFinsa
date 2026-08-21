import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistEvidence } from "@/lib/evidence/persist";
import { PersistForbiddenError } from "@/lib/evidence/mime";
import { solidPng } from "../../../scripts/png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const localPassword = "CatLocal123!";

type CatalogType = { id: string; code: string; label: string; stage: string | null };

function requireLocalUrl() {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  expect(url).toBeTruthy();
  expect(anon).toBeTruthy();
  expect(["127.0.0.1", "localhost"]).toContain(host);
}

function sessionClient() {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email: string) {
  const client = sessionClient();
  const login = await client.auth.signInWithPassword({ email, password: localPassword });
  expect(login.error).toBeNull();
  expect(login.data.user?.id).toBeTruthy();
  return { client, userId: login.data.user!.id };
}

function rpcMessage(error: { message?: string } | null) {
  return (error?.message ?? "").toLowerCase();
}

describe.sequential("reglas de negocio backend", () => {
  let picking: SupabaseClient;
  let admin: SupabaseClient;
  let supervisor: SupabaseClient | null = null;
  let pickingId = "";
  let adminId = "";
  let supervisorId = "";
  let remito: CatalogType;
  let etiquetas: CatalogType;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    requireLocalUrl();
    const pickingSession = await signIn("emilio@cat.local");
    const adminSession = await signIn("ilan@cat.local");
    picking = pickingSession.client;
    admin = adminSession.client;
    pickingId = pickingSession.userId;
    adminId = adminSession.userId;

    const types = await admin.from("requirement_types").select("id, code, label, stage");
    expect(types.error).toBeNull();
    const byCode = new Map((types.data ?? []).map((row) => [row.code, row as CatalogType]));
    remito = byCode.get("REMITO")!;
    etiquetas = byCode.get("ETIQUETAS")!;
    expect(remito?.id).toBeTruthy();
    expect(etiquetas?.id).toBeTruthy();
    expect(remito.stage ?? "FLOOR").toBe("FLOOR");
    expect(etiquetas.stage).toBe("DISPATCH");

    expect(serviceKey).toBeTruthy();
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `sup-${Date.now()}@cat.local`;
    const created = await service.auth.admin.createUser({
      email,
      password: localPassword,
      email_confirm: true,
      user_metadata: { full_name: "Supervisor 2.2" },
    });
    expect(created.error, created.error?.message).toBeNull();
    supervisorId = created.data.user?.id ?? "";
    expect(supervisorId).toBeTruthy();
    createdUsers.push(supervisorId);
    const promoted = await service.from("profiles").update({ role: "SUPERVISOR" }).eq("id", supervisorId);
    expect(promoted.error, promoted.error?.message).toBeNull();
    const supervisorSession = await signIn(email);
    supervisor = supervisorSession.client;
  });

  afterAll(async () => {
    await picking?.auth.signOut();
    await admin?.auth.signOut();
    await supervisor?.auth.signOut();
    if (serviceKey && createdUsers.length > 0) {
      const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      for (const id of createdUsers) {
        await service.auth.admin.deleteUser(id);
      }
    }
  });

  async function savePublished(options: {
    number: string;
    assigneeId?: string | null;
    intent?: "draft" | "publish";
    withDispatch?: boolean;
  }) {
    const requirements = [
      { typeId: remito.id, label: remito.label, required: true, applicable: true, displayOrder: 10 },
    ];
    if (options.withDispatch !== false) {
      requirements.push({
        typeId: etiquetas.id,
        label: etiquetas.label,
        required: true,
        applicable: true,
        displayOrder: 20,
      });
    }
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: options.number,
      p_modality: "DESPACHO",
      p_carrier: "ANDREANI",
      p_destination: "Cliente reglas 2.2",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: options.assigneeId ?? null,
      p_due_at: null,
      p_observations: null,
      p_intent: options.intent ?? "publish",
      p_requirements: requirements,
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    return saved.data as string;
  }

  async function requirementId(deliveryId: string, typeId: string) {
    const reqs = await admin
      .from("delivery_requirements")
      .select("id, requirement_type_id")
      .eq("delivery_id", deliveryId);
    expect(reqs.error).toBeNull();
    const id = reqs.data?.find((row) => row.requirement_type_id === typeId)?.id ?? "";
    expect(id).toBeTruthy();
    return id;
  }

  async function upload(actor: SupabaseClient, actorId: string, requirementIdValue: string, name: string) {
    return persistEvidence(actor, {
      actorId,
      actorRole: actor === admin ? "ADMIN" : "PICKING",
      requirementId: requirementIdValue,
      bytes: new Uint8Array(solidPng(32, 24, [0, 128, 255])),
      declaredMime: "image/png",
      filename: name,
    });
  }

  async function markReady(deliveryId: string, expected: "PUBLISHED" | "IN_PICKING" = "IN_PICKING") {
    return admin.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: expected,
      p_next_status: "READY",
      p_action: "READY",
      p_metadata: {},
    });
  }

  it("claim válido, rol inválido y estado inválido", async () => {
    const freeId = await savePublished({ number: `BR-CLAIM-${Date.now()}`, assigneeId: null });
    const claimed = await picking.rpc("assign_delivery", {
      p_delivery_id: freeId,
      p_expected_assignee: null,
      p_next_assignee: pickingId,
      p_action: "CLAIMED",
    });
    expect(claimed.error, claimed.error?.message).toBeNull();

    const adminClaim = await admin.rpc("assign_delivery", {
      p_delivery_id: freeId,
      p_expected_assignee: pickingId,
      p_next_assignee: adminId,
      p_action: "CLAIMED",
    });
    expect(adminClaim.error).toBeTruthy();
    expect(rpcMessage(adminClaim.error)).toMatch(/picking|autorizado|responsable/);

    const readySource = await savePublished({ number: `BR-CLM2-${Date.now()}`, assigneeId: pickingId });
    const remitoReq = await requirementId(readySource, remito.id);
    await upload(picking, pickingId, remitoReq, "br-claim-floor.png");
    const ready = await markReady(readySource);
    expect(ready.error, ready.error?.message).toBeNull();

    const claimReady = await picking.rpc("assign_delivery", {
      p_delivery_id: readySource,
      p_expected_assignee: pickingId,
      p_next_assignee: pickingId,
      p_action: "CLAIMED",
    });
    expect(claimReady.error).toBeTruthy();
    expect(rpcMessage(claimReady.error)).toMatch(/estado|asignaci/);
  });

  it("READY exige FLOOR completo y no exige DISPATCH", async () => {
    const deliveryId = await savePublished({ number: `BR-READY-${Date.now()}`, assigneeId: pickingId });
    const incomplete = await picking.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "PUBLISHED",
      p_next_status: "READY",
      p_action: "READY",
      p_metadata: {},
    });
    expect(incomplete.error).toBeTruthy();
    expect(rpcMessage(incomplete.error)).toMatch(/fotos de bodega|marcar lista/);

    const remitoReq = await requirementId(deliveryId, remito.id);
    await upload(picking, pickingId, remitoReq, "br-ready-floor.png");
    const complete = await markReady(deliveryId);
    expect(complete.error, complete.error?.message).toBeNull();
    const row = await admin.from("deliveries").select("status").eq("id", deliveryId).maybeSingle();
    expect(row.data?.status).toBe("READY");
  });

  it("FLOOR permitido fuera de READY y denegado en READY; DISPATCH permitido en READY", async () => {
    const deliveryId = await savePublished({ number: `BR-EV-${Date.now()}`, assigneeId: pickingId });
    const remitoReq = await requirementId(deliveryId, remito.id);
    const labelReq = await requirementId(deliveryId, etiquetas.id);

    await upload(picking, pickingId, remitoReq, "br-ev-floor-1.png");
    const ready = await markReady(deliveryId);
    expect(ready.error, ready.error?.message).toBeNull();

    await expect(upload(picking, pickingId, remitoReq, "br-ev-floor-ready.png")).rejects.toBeInstanceOf(
      PersistForbiddenError,
    );

    const dispatch = await upload(picking, pickingId, labelReq, "br-ev-dispatch-ready.png");
    expect(dispatch.deliveryId).toBe(deliveryId);

    await admin.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "READY",
      p_next_status: "CLOSED",
      p_action: "CLOSED",
      p_metadata: {},
    });
    await expect(upload(picking, pickingId, labelReq, "br-ev-dispatch-closed.png")).rejects.toBeInstanceOf(
      PersistForbiddenError,
    );
  });

  it("cierre normal: válido, observación abierta, requisitos pendientes, rol inválido", async () => {
    const deliveryId = await savePublished({ number: `BR-CLOSE-${Date.now()}`, assigneeId: pickingId });
    const remitoReq = await requirementId(deliveryId, remito.id);
    const labelReq = await requirementId(deliveryId, etiquetas.id);
    await upload(picking, pickingId, remitoReq, "br-close-floor.png");
    const ready = await markReady(deliveryId);
    expect(ready.error, ready.error?.message).toBeNull();

    const pickingClose = await picking.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "READY",
      p_next_status: "CLOSED",
      p_action: "CLOSED",
      p_metadata: {},
    });
    expect(pickingClose.error).toBeTruthy();
    expect(rpcMessage(pickingClose.error)).toMatch(/admin|cerrar|autorizado/);

    const pendingDispatch = await admin.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "READY",
      p_next_status: "CLOSED",
      p_action: "CLOSED",
      p_metadata: {},
    });
    expect(pendingDispatch.error).toBeTruthy();
    expect(rpcMessage(pendingDispatch.error)).toMatch(/etiqueta|cerrar|obligator/);

    await upload(picking, pickingId, labelReq, "br-close-dispatch.png");

    const noted = await picking.rpc("record_observation", {
      p_delivery_id: deliveryId,
      p_text: "Falta revisar bulto",
      p_resolve: false,
    });
    expect(noted.error, noted.error?.message).toBeNull();

    const withObs = await admin.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "READY",
      p_next_status: "CLOSED",
      p_action: "CLOSED",
      p_metadata: {},
    });
    expect(withObs.error).toBeTruthy();
    expect(rpcMessage(withObs.error)).toMatch(/observaci/);

    const resolved = await admin.rpc("record_observation", {
      p_delivery_id: deliveryId,
      p_text: "",
      p_resolve: true,
    });
    expect(resolved.error, resolved.error?.message).toBeNull();

    const closed = await admin.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "READY",
      p_next_status: "CLOSED",
      p_action: "CLOSED",
      p_metadata: {},
    });
    expect(closed.error, closed.error?.message).toBeNull();
  });

  it("PICKING no suelta en READY; sí en IN_PICKING", async () => {
    const deliveryId = await savePublished({ number: `BR-REL-${Date.now()}`, assigneeId: pickingId });
    const remitoReq = await requirementId(deliveryId, remito.id);
    await upload(picking, pickingId, remitoReq, "br-rel-floor.png");

    const releasePicking = await picking.rpc("assign_delivery", {
      p_delivery_id: deliveryId,
      p_expected_assignee: pickingId,
      p_next_assignee: null,
      p_action: "REASSIGNED",
    });
    expect(releasePicking.error, releasePicking.error?.message).toBeNull();

    const reclaim = await picking.rpc("assign_delivery", {
      p_delivery_id: deliveryId,
      p_expected_assignee: null,
      p_next_assignee: pickingId,
      p_action: "CLAIMED",
    });
    expect(reclaim.error, reclaim.error?.message).toBeNull();

    const ready = await markReady(deliveryId);
    expect(ready.error, ready.error?.message).toBeNull();

    const releaseReady = await picking.rpc("assign_delivery", {
      p_delivery_id: deliveryId,
      p_expected_assignee: pickingId,
      p_next_assignee: null,
      p_action: "REASSIGNED",
    });
    expect(releaseReady.error).toBeTruthy();
    expect(rpcMessage(releaseReady.error)).toMatch(/estado|asignaci/);

    const adminRelease = await admin.rpc("assign_delivery", {
      p_delivery_id: deliveryId,
      p_expected_assignee: pickingId,
      p_next_assignee: null,
      p_action: "REASSIGNED",
    });
    expect(adminRelease.error, adminRelease.error?.message).toBeNull();
  });

  it("Supervisor puede asignar en lote; Picking no; DRAFT y no-PICKING se rechazan", async () => {
    expect(supervisor).toBeTruthy();
    const publishedId = await savePublished({ number: `BR-BULK-${Date.now()}`, assigneeId: null });
    const draftId = await savePublished({
      number: `BR-DRAFT-${Date.now()}`,
      assigneeId: null,
      intent: "draft",
    });

    const pickingBulk = await picking.rpc("bulk_assign_picker", {
      p_delivery_ids: [publishedId],
      p_assignee_id: pickingId,
    });
    expect(pickingBulk.error).toBeTruthy();
    expect(rpcMessage(pickingBulk.error)).toMatch(/autorizado/);

    const badAssignee = await supervisor!.rpc("bulk_assign_picker", {
      p_delivery_ids: [publishedId],
      p_assignee_id: adminId,
    });
    expect(badAssignee.error).toBeTruthy();
    expect(rpcMessage(badAssignee.error)).toMatch(/picking|responsable/);

    const ok = await supervisor!.rpc("bulk_assign_picker", {
      p_delivery_ids: [publishedId, draftId],
      p_assignee_id: pickingId,
    });
    expect(ok.error, ok.error?.message).toBeNull();
    expect(ok.data).toBe(1);

    const published = await admin.from("deliveries").select("assignee_id, status").eq("id", publishedId).maybeSingle();
    const draft = await admin.from("deliveries").select("assignee_id, status").eq("id", draftId).maybeSingle();
    expect(published.data?.assignee_id).toBe(pickingId);
    expect(draft.data?.status).toBe("DRAFT");
    expect(draft.data?.assignee_id).toBeNull();
  });
});
