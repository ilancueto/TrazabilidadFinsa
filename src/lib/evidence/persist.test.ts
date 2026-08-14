import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { persistEvidence } from "@/lib/evidence/persist";
import { PersistForbiddenError, PersistValidationError } from "@/lib/evidence/mime";
import { getEvidenceStorage } from "@/lib/storage";
import { solidPng } from "../../../scripts/png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const created: string[] = [];

describe("persistEvidence against local supabase", () => {
  it("tiene entorno local", () => {
    expect(url).toBeTruthy();
    expect(anon).toBeTruthy();
    expect(service).toBeTruthy();
  });

  it("guarda una foto real, la confirma en DB y se puede descargar", async () => {
    const picking = createClient(url!, anon!, { auth: { persistSession: false } });
    const login = await picking.auth.signInWithPassword({
      email: "emilio@cat.local",
      password: "CatLocal123!",
    });
    expect(login.error).toBeNull();
    const actorId = login.data.user?.id;
    expect(actorId).toBeTruthy();

    const req = await picking
      .from("delivery_requirements")
      .select("id, label, deliveries!inner(number, status)")
      .eq("label", "Evidencia final")
      .eq("deliveries.number", "806042356")
      .maybeSingle();
    expect(req.error).toBeNull();
    expect(req.data?.id).toBeTruthy();

    const bytes = new Uint8Array(solidPng(48, 32, [255, 204, 0]));
    const result = await persistEvidence(picking, {
      actorId: actorId!,
      actorRole: "PICKING",
      requirementId: req.data!.id,
      bytes,
      declaredMime: "image/png",
      filename: "test-remito.png",
      comment: "test persist",
    });
    created.push(result.evidenceId);

    expect(result.mimeType).toBe("image/png");
    expect(result.sizeBytes).toBe(bytes.byteLength);

    const row = await picking
      .from("evidences")
      .select("id, mime_type, size_bytes, comment, voided_at, checksum")
      .eq("id", result.evidenceId)
      .maybeSingle();
    expect(row.data?.comment).toBe("test persist");
    expect(row.data?.voided_at).toBeNull();
    expect(row.data?.checksum).toMatch(/^[a-f0-9]{64}$/);

    const downloaded = await getEvidenceStorage().download(result.storageKey);
    expect(downloaded.byteLength).toBe(bytes.byteLength);
    expect(downloaded[0]).toBe(0x89);
    expect(downloaded[1]).toBe(0x50);
  });

  it("rechaza un archivo que no es imagen", async () => {
    const picking = createClient(url!, anon!, { auth: { persistSession: false } });
    await picking.auth.signInWithPassword({
      email: "emilio@cat.local",
      password: "CatLocal123!",
    });
    const user = (await picking.auth.getUser()).data.user;
    await expect(
      persistEvidence(picking, {
        actorId: user!.id,
        actorRole: "PICKING",
        requirementId: "11111111-1111-4111-8111-111111111111",
        bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        declaredMime: "text/plain",
        filename: "nota.txt",
      }),
    ).rejects.toBeInstanceOf(PersistValidationError);
  });

  it("no deja a Picking cargar en una entrega cerrada", async () => {
    const picking = createClient(url!, anon!, { auth: { persistSession: false } });
    const login = await picking.auth.signInWithPassword({
      email: "emilio@cat.local",
      password: "CatLocal123!",
    });
    const req = await picking
      .from("delivery_requirements")
      .select("id, deliveries!inner(number, status)")
      .eq("deliveries.number", "806042512")
      .limit(1)
      .maybeSingle();
    expect(req.data?.id).toBeTruthy();

    const bytes = new Uint8Array(solidPng(16, 16, [20, 20, 20]));
    await expect(
      persistEvidence(picking, {
        actorId: login.data.user!.id,
        actorRole: "PICKING",
        requirementId: req.data!.id,
        bytes,
        declaredMime: "image/png",
        filename: "cerrada.png",
      }),
    ).rejects.toBeInstanceOf(PersistForbiddenError);
  });
});

afterAll(async () => {
  if (!service || created.length === 0) return;
  const admin = createClient(url!, service, { auth: { persistSession: false } });
  await admin.from("evidences").delete().in("id", created);
});
