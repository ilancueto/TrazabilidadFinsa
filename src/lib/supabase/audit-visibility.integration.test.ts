import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { persistEvidence } from "@/lib/evidence/persist";
import { solidPng } from "../../../scripts/png";

vi.mock("server-only", () => ({}));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "CatLocal123!";

function client(key = anon) { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function signIn(email: string) {
  const sb = client(); const result = await sb.auth.signInWithPassword({ email, password });
  expect(result.error, result.error?.message).toBeNull(); return sb;
}

describe.sequential("Sprint 4.5 audit visibility", () => {
  let admin: SupabaseClient; let picking: SupabaseClient; let supervisor: SupabaseClient; let service: SupabaseClient;
  let supervisorId = ""; let archivedId = ""; let archivedEvidenceId = "";

  beforeAll(async () => {
    expect(["127.0.0.1", "localhost"]).toContain(new URL(url).hostname);
    service = client(serviceKey); admin = await signIn("ilan@cat.local"); picking = await signIn("emilio@cat.local");
    const email = `audit-supervisor-${Date.now()}@cat.local`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Supervisor Auditoría" } });
    expect(created.error, created.error?.message).toBeNull(); supervisorId = created.data.user!.id;
    expect((await service.from("profiles").update({ role: "SUPERVISOR" }).eq("id", supervisorId)).error).toBeNull();
    supervisor = await signIn(email);
    const remito = await admin.from("requirement_types").select("id, label").eq("code", "REMITO").single();
    expect(remito.error, remito.error?.message).toBeNull();
    const saved = await admin.rpc("save_delivery", { p_delivery_id: null, p_expected_status: null, p_number: `AUDIT-ARCH-${Date.now()}`, p_modality: "DESPACHO", p_carrier: "ANDREANI", p_destination: "Archivo Sprint 4.5", p_packages: 1, p_priority: "NORMAL", p_assignee_id: null, p_due_at: null, p_observations: null, p_intent: "publish", p_requirements: [{ typeId: remito.data!.id, label: remito.data!.label, required: true, applicable: true, displayOrder: 10 }], p_client_id: null, p_pallet_code: null });
    expect(saved.error, saved.error?.message).toBeNull(); archivedId = saved.data as string;
    const requirement = await admin.from("delivery_requirements").select("id").eq("delivery_id", archivedId).single();
    expect(requirement.error, requirement.error?.message).toBeNull();
    const actor = await admin.auth.getUser();
    const evidence = await persistEvidence(admin, { actorId: actor.data.user!.id, actorRole: "ADMIN", requirementId: requirement.data!.id, bytes: new Uint8Array(solidPng(24, 24, [255, 204, 0])), declaredMime: "image/png", filename: "audit-archived.png" });
    archivedEvidenceId = evidence.evidenceId;
    const number = (await service.from("deliveries").select("number").eq("id", archivedId).single()).data!.number;
    expect((await admin.rpc("archive_delivery", { p_delivery_id: archivedId, p_confirm_number: number })).error).toBeNull();
  });

  afterAll(async () => { await admin?.auth.signOut(); await picking?.auth.signOut(); await supervisor?.auth.signOut(); if (supervisorId) await service?.auth.admin.deleteUser(supervisorId); });

  it("allows ADMIN and SUPERVISOR, but denies PICKING archived delivery, audit, requirements and evidences", async () => {
    for (const actor of [admin, supervisor]) {
      expect((await actor.from("deliveries").select("id, deleted_at").eq("id", archivedId).maybeSingle()).data?.deleted_at).toBeTruthy();
      expect((await actor.from("audit_events").select("id").eq("delivery_id", archivedId)).data?.length).toBeGreaterThan(0);
      expect((await actor.from("evidences").select("id").eq("id", archivedEvidenceId)).data?.map((row) => row.id)).toEqual([archivedEvidenceId]);
    }
    expect((await picking.from("deliveries").select("id").eq("id", archivedId)).data).toEqual([]);
    expect((await picking.from("audit_events").select("id").eq("delivery_id", archivedId)).data).toEqual([]);
    expect((await picking.from("delivery_requirements").select("id").eq("delivery_id", archivedId)).data).toEqual([]);
    expect((await picking.from("evidences").select("id").eq("id", archivedEvidenceId)).data).toEqual([]);
  });

  it("uses the production keyset predicate across page two and timestamp ties", async () => {
    const { auditCursorPredicate } = await import("@/lib/audit/queries");
    const createdAt = new Date(Date.now() - 30_000).toISOString();
    const inserted = await service.from("audit_events").insert(Array.from({ length: 52 }, () => ({ delivery_id: archivedId, action: "EDITED", metadata: { audit_visibility_fixture: true }, created_at: createdAt }))).select("id, created_at");
    expect(inserted.error, inserted.error?.message).toBeNull();
    expect(new Set((inserted.data ?? []).map((event) => new Date(event.created_at).getTime()))).toEqual(new Set([new Date(createdAt).getTime()]));

    const all = await admin.from("audit_events").select("id, created_at").eq("delivery_id", archivedId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    expect(all.error, all.error?.message).toBeNull();
    const pageOne = await admin.from("audit_events").select("id, created_at").eq("delivery_id", archivedId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(51);
    expect(pageOne.error, pageOne.error?.message).toBeNull();
    expect(pageOne.data).toHaveLength(51);
    const firstFifty = pageOne.data!.slice(0, 50);
    const last = firstFifty.at(-1)!;
    const pageTwo = await admin.from("audit_events").select("id, created_at").eq("delivery_id", archivedId).or(auditCursorPredicate({ createdAt: last.created_at, id: last.id })).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(51);
    expect(pageTwo.error, pageTwo.error?.message).toBeNull();
    const combined = [...firstFifty, ...(pageTwo.data ?? [])];
    expect(new Set(combined.map((event) => event.id)).size).toBe(combined.length);
    expect(combined.map((event) => event.id)).toEqual((all.data ?? []).map((event) => event.id));
    expect(combined.every((event, index) => index === 0 || event.created_at < combined[index - 1].created_at || (event.created_at === combined[index - 1].created_at && event.id < combined[index - 1].id))).toBe(true);
  });

  it("keeps direct audit INSERT blocked for a normal ADMIN client", async () => {
    const result = await admin.from("audit_events").insert({ delivery_id: archivedId, action: "EDITED", metadata: { reason: "no debe insertar" } });
    expect(result.error).toBeTruthy();
  });
});
