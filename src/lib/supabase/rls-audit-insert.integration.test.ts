import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistEvidence } from "@/lib/evidence/persist";
import { solidPng } from "../../../scripts/png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const localPassword = "CatLocal123!";
const FAKE_MARKER = "rls3-fake-audit";

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
  expect(login.data.session?.access_token).toBeTruthy();
  return { client, userId: login.data.user!.id };
}

function isPermissionDenied(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    code === "42503" ||
    code === "PGRST301" ||
    message.includes("permission denied") ||
    message.includes("not allowed")
  );
}

type AuditRow = { id: string; action: string; metadata: Record<string, unknown> | null };

async function listAudit(client: SupabaseClient, deliveryId: string): Promise<AuditRow[]> {
  const { data, error } = await client
    .from("audit_events")
    .select("id, action, metadata")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });
  expect(error).toBeNull();
  return (data ?? []) as AuditRow[];
}

function countAction(rows: AuditRow[], action: string) {
  return rows.filter((row) => row.action === action).length;
}

describe.sequential("RLS: audit_events INSERT directo bloqueado", () => {
  let picking: SupabaseClient;
  let admin: SupabaseClient;
  let pickingId = "";
  let deliveryId = "";
  let remitoReqId = "";
  let packingReqId = "";
  let baselineIds = new Set<string>();

  beforeAll(async () => {
    requireLocalUrl();
    const pickingSession = await signIn("emilio@cat.local");
    const adminSession = await signIn("ilan@cat.local");
    picking = pickingSession.client;
    admin = adminSession.client;
    pickingId = pickingSession.userId;

    const types = await admin.from("requirement_types").select("id, code, label, stage");
    expect(types.error).toBeNull();
    const byCode = new Map((types.data ?? []).map((row) => [row.code, row]));
    const remito = byCode.get("REMITO");
    const bultos = byCode.get("BULTOS");
    const packing = byCode.get("PACKING_LIST");
    expect(remito?.id).toBeTruthy();
    expect(bultos?.id).toBeTruthy();
    expect(packing?.id).toBeTruthy();

    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `RLS3-${Date.now()}`,
      p_modality: "CUSTOMER_PICKUP",
      p_destination: "Cliente RLS audit",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: pickingId,
      p_due_at: null,
      p_observations: null,
      p_intent: "publish",
      p_requirements: [
        { typeId: remito!.id, label: remito!.label, required: true, applicable: true, displayOrder: 10 },
        { typeId: bultos!.id, label: bultos!.label, required: true, applicable: true, displayOrder: 20 },
        { typeId: packing!.id, label: packing!.label, required: false, applicable: true, displayOrder: 30 },
      ],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    deliveryId = saved.data as string;

    const reqs = await picking
      .from("delivery_requirements")
      .select("id, requirement_type_id")
      .eq("delivery_id", deliveryId);
    expect(reqs.error).toBeNull();
    remitoReqId = reqs.data?.find((row) => row.requirement_type_id === remito!.id)?.id ?? "";
    packingReqId = reqs.data?.find((row) => row.requirement_type_id === packing!.id)?.id ?? "";
    const bultosReqId = reqs.data?.find((row) => row.requirement_type_id === bultos!.id)?.id ?? "";
    expect(remitoReqId && bultosReqId && packingReqId).toBeTruthy();

    const created = await listAudit(admin, deliveryId);
    expect(countAction(created, "CREATED")).toBe(1);
    expect(countAction(created, "PUBLISHED")).toBe(1);
    baselineIds = new Set(created.map((row) => row.id));

    const png = new Uint8Array(solidPng(48, 32, [255, 204, 0]));
    await persistEvidence(picking, {
      actorId: pickingId,
      actorRole: "PICKING",
      requirementId: remitoReqId,
      bytes: png,
      declaredMime: "image/png",
      filename: "rls3-remito.png",
    });
    await persistEvidence(picking, {
      actorId: pickingId,
      actorRole: "PICKING",
      requirementId: bultosReqId,
      bytes: png,
      declaredMime: "image/png",
      filename: "rls3-bultos.png",
    });
  });

  afterAll(async () => {
    await picking?.auth.signOut();
    await admin?.auth.signOut();
  });

  async function assertFakeInsertRejected(client: SupabaseClient) {
    const before = await listAudit(client, deliveryId);
    const beforeFake = before.filter((row) => row.metadata?.fake === FAKE_MARKER);
    expect(beforeFake).toHaveLength(0);
    const closedBefore = countAction(before, "CLOSED");

    const attempt = await client.from("audit_events").insert({
      delivery_id: deliveryId,
      action: "CLOSED",
      metadata: { fake: FAKE_MARKER },
    }).select("id, action, metadata");

    expect(attempt.data ?? [], JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await listAudit(client, deliveryId);
    expect(after.filter((row) => row.metadata?.fake === FAKE_MARKER)).toHaveLength(0);
    expect(countAction(after, "CLOSED")).toBe(closedBefore);
    expect(after.length).toBe(before.length);
  }

  it("PICKING JWT no puede fabricar auditoría por INSERT directo", async () => {
    await assertFakeInsertRejected(picking);
  });

  it("ADMIN JWT no puede INSERT directo en audit_events", async () => {
    await assertFakeInsertRejected(admin);
  });

  it("void_evidence crea EVIDENCE_VOIDED", async () => {
    const png = new Uint8Array(solidPng(48, 32, [0, 128, 255]));
    const uploaded = await persistEvidence(picking, {
      actorId: pickingId,
      actorRole: "PICKING",
      requirementId: packingReqId,
      bytes: png,
      declaredMime: "image/png",
      filename: "rls3-packing.png",
    });

    const before = await listAudit(picking, deliveryId);
    const voidedBefore = countAction(before, "EVIDENCE_VOIDED");

    const rpc = await picking.rpc("void_evidence", {
      p_evidence_id: uploaded.evidenceId,
      p_reason: "anulación rls3",
    });
    expect(rpc.error, rpc.error?.message).toBeNull();
    expect(rpc.data).toBe(deliveryId);

    const evidence = await picking
      .from("evidences")
      .select("id, voided_at, void_reason")
      .eq("id", uploaded.evidenceId)
      .maybeSingle();
    expect(evidence.error).toBeNull();
    expect(evidence.data?.voided_at).toBeTruthy();
    expect(evidence.data?.void_reason).toBe("anulación rls3");

    const after = await listAudit(picking, deliveryId);
    expect(countAction(after, "EVIDENCE_VOIDED")).toBe(voidedBefore + 1);
    const created = after.filter((row) => !before.some((prev) => prev.id === row.id));
    expect(created.some((row) => row.action === "EVIDENCE_VOIDED")).toBe(true);
  });

  it("transition_delivery crea el evento READY", async () => {
    const before = await listAudit(picking, deliveryId);
    expect(countAction(before, "READY")).toBe(0);

    const rpc = await picking.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "IN_PICKING",
      p_next_status: "READY",
      p_action: "READY",
      p_metadata: {},
    });
    expect(rpc.error, rpc.error?.message).toBeNull();
    expect(rpc.data).toBe(deliveryId);

    const after = await listAudit(picking, deliveryId);
    expect(countAction(after, "READY")).toBe(1);
    expect(after.length).toBe(before.length + 1);
    const created = after.filter((row) => !before.some((prev) => prev.id === row.id));
    expect(created).toHaveLength(1);
    expect(created[0]?.action).toBe("READY");
  });

  it("record_observation crea OBSERVATION_ADDED", async () => {
    const before = await listAudit(picking, deliveryId);
    expect(countAction(before, "OBSERVATION_ADDED")).toBe(0);

    const rpc = await picking.rpc("record_observation", {
      p_delivery_id: deliveryId,
      p_text: "observación rls3",
      p_resolve: false,
    });
    expect(rpc.error, rpc.error?.message).toBeNull();
    expect(rpc.data).toBe(deliveryId);

    const after = await listAudit(picking, deliveryId);
    expect(countAction(after, "OBSERVATION_ADDED")).toBe(1);
    const created = after.filter((row) => !before.some((prev) => prev.id === row.id));
    expect(created).toHaveLength(1);
    expect(created[0]?.action).toBe("OBSERVATION_ADDED");
    expect(created[0]?.metadata?.text).toBe("observación rls3");
  });

  it("SELECT de audit_events sigue funcionando", async () => {
    const rows = await listAudit(picking, deliveryId);
    expect(rows.length).toBeGreaterThan(0);
    expect(countAction(rows, "CREATED")).toBe(1);
    expect(countAction(rows, "READY")).toBe(1);
    expect(countAction(rows, "OBSERVATION_ADDED")).toBe(1);
    expect(countAction(rows, "EVIDENCE_VOIDED")).toBeGreaterThanOrEqual(1);
    expect(rows.filter((row) => row.metadata?.fake === FAKE_MARKER)).toHaveLength(0);
    expect(rows.every((row) => baselineIds.has(row.id) || row.id)).toBe(true);
  });
});
