import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistEvidence } from "@/lib/evidence/persist";
import { solidPng } from "../../../scripts/png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const localPassword = "CatLocal123!";

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

async function readEvidence(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("evidences")
    .select(
      "id, voided_at, void_reason, review_status, review_note, thumbnail_storage_key, thumbnail_mime_type, thumbnail_size_bytes, requirement_id",
    )
    .eq("id", id)
    .maybeSingle();
  expect(error).toBeNull();
  expect(data?.id).toBe(id);
  return data!;
}

type CatalogType = { id: string; code: string; label: string; stage: string };

describe.sequential("RLS: evidences UPDATE directo bloqueado", () => {
  let picking: SupabaseClient;
  let admin: SupabaseClient;
  let pickingId = "";
  let deliveryId = "";
  let remitoReqId = "";
  let packingReqId = "";
  let evidenceA = "";
  let evidenceC = "";

  async function uploadPhoto(requirementId: string, filename: string, comment: string) {
    const bytes = new Uint8Array(solidPng(48, 32, [255, 204, 0]));
    const result = await persistEvidence(picking, {
      actorId: pickingId,
      actorRole: "PICKING",
      requirementId,
      bytes,
      declaredMime: "image/png",
      filename,
      comment,
    });
    expect(result.evidenceId).toBeTruthy();
    expect(result.deliveryId).toBe(deliveryId);
    const row = await readEvidence(picking, result.evidenceId);
    expect(row.voided_at).toBeNull();
    expect(row.thumbnail_storage_key).toBeTruthy();
    expect(row.thumbnail_mime_type).toBe("image/webp");
    expect(row.thumbnail_size_bytes).toBeGreaterThan(0);
    return result.evidenceId;
  }

  beforeAll(async () => {
    requireLocalUrl();
    const pickingSession = await signIn("emilio@cat.local");
    const adminSession = await signIn("ilan@cat.local");
    picking = pickingSession.client;
    admin = adminSession.client;
    pickingId = pickingSession.userId;

    const types = await admin.from("requirement_types").select("id, code, label, stage");
    expect(types.error).toBeNull();
    const byCode = new Map((types.data ?? []).map((row) => [row.code, row as CatalogType]));
    const remito = byCode.get("REMITO");
    const bultos = byCode.get("BULTOS");
    const packing = byCode.get("PACKING_LIST");
    expect(remito?.stage).toBe("FLOOR");
    expect(bultos?.stage).toBe("FLOOR");
    expect(packing?.id).toBeTruthy();

    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `RLS2-${Date.now()}`,
      p_modality: "CUSTOMER_PICKUP",
      p_destination: "Cliente RLS evidences",
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
    expect(remitoReqId).toBeTruthy();
    expect(bultosReqId).toBeTruthy();
    expect(packingReqId).toBeTruthy();

    evidenceA = await uploadPhoto(remitoReqId, "rls2-remito.png", "foto A");
    await uploadPhoto(bultosReqId, "rls2-bultos.png", "foto B");
  });

  afterAll(async () => {
    await picking?.auth.signOut();
    await admin?.auth.signOut();
  });

  it("PICKING JWT no puede anular por UPDATE directo", async () => {
    const before = await readEvidence(picking, evidenceA);
    expect(before.voided_at).toBeNull();
    expect(before.void_reason).toBeNull();

    const attempt = await picking
      .from("evidences")
      .update({ voided_at: new Date().toISOString(), void_reason: "x" })
      .eq("id", evidenceA)
      .select("id, voided_at, void_reason");

    expect(attempt.data ?? [], JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await readEvidence(picking, evidenceA);
    expect(after.voided_at).toBeNull();
    expect(after.void_reason).toBeNull();
    expect(after.review_status).toBe(before.review_status);
  });

  it("PICKING JWT no puede cambiar review_status por UPDATE directo", async () => {
    const before = await readEvidence(picking, evidenceA);
    const attempt = await picking
      .from("evidences")
      .update({ review_status: "ACCEPTED" })
      .eq("id", evidenceA)
      .select("id, review_status");

    expect(attempt.data ?? [], JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await readEvidence(picking, evidenceA);
    expect(after.review_status).toBe(before.review_status);
    expect(after.voided_at).toBeNull();
  });

  it("ADMIN con anon key + JWT no puede review directo", async () => {
    const before = await readEvidence(admin, evidenceA);
    expect(before.review_status).not.toBe("ACCEPTED");

    const attempt = await admin
      .from("evidences")
      .update({ review_status: "ACCEPTED" })
      .eq("id", evidenceA)
      .select("id, review_status");

    expect(attempt.data ?? [], JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await readEvidence(admin, evidenceA);
    expect(after.review_status).toBe(before.review_status);
    expect(after.voided_at).toBeNull();
  });

  it("persistEvidence / register_evidence_v2 sigue cargando y persiste thumbnail", async () => {
    evidenceC = await uploadPhoto(packingReqId, "rls2-packing.png", "foto C carga");
    const row = await readEvidence(picking, evidenceC);
    expect(row.thumbnail_storage_key).toMatch(/thumb/i);
    expect(row.review_status).toBe("PENDING");
  });

  it("PICKING puede void_evidence por RPC", async () => {
    expect(evidenceC).toBeTruthy();
    const before = await readEvidence(picking, evidenceC);
    expect(before.voided_at).toBeNull();

    const rpc = await picking.rpc("void_evidence", {
      p_evidence_id: evidenceC,
      p_reason: "anulación de prueba rls2",
    });
    expect(rpc.error, rpc.error?.message).toBeNull();
    expect(rpc.data).toBe(deliveryId);

    const after = await readEvidence(picking, evidenceC);
    expect(after.voided_at).toBeTruthy();
    expect(after.void_reason).toBe("anulación de prueba rls2");
  });

  it("ADMIN puede review_evidence por RPC en READY", async () => {
    const ready = await picking.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "IN_PICKING",
      p_next_status: "READY",
      p_action: "READY",
      p_metadata: {},
    });
    expect(ready.error, ready.error?.message).toBeNull();

    const before = await readEvidence(admin, evidenceA);
    expect(before.voided_at).toBeNull();
    expect(before.review_status).toBe("PENDING");

    const rpc = await admin.rpc("review_evidence", {
      p_evidence_id: evidenceA,
      p_decision: "ACCEPTED",
      p_note: null,
      p_markup: null,
    });
    expect(rpc.error, rpc.error?.message).toBeNull();
    expect(rpc.data).toBe(deliveryId);

    const after = await readEvidence(admin, evidenceA);
    expect(after.review_status).toBe("ACCEPTED");
    expect(after.voided_at).toBeNull();
    expect(after.thumbnail_storage_key).toBe(before.thumbnail_storage_key);
  });

  it("SELECT de evidencias sigue funcionando", async () => {
    const a = await readEvidence(picking, evidenceA);
    expect(a.review_status).toBe("ACCEPTED");
    const c = await readEvidence(picking, evidenceC);
    expect(c.voided_at).toBeTruthy();
  });
});
