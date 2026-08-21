import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

async function readDelivery(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("deliveries")
    .select("id, status, deleted_at, destination, number")
    .eq("id", id)
    .maybeSingle();
  expect(error).toBeNull();
  expect(data?.id).toBe(id);
  return data!;
}

describe.sequential("RLS: deliveries UPDATE directo bloqueado", () => {
  let picking: SupabaseClient;
  let admin: SupabaseClient;
  let pickingId = "";
  let deliveryId = "";
  let deliveryNumber = "";
  const created: string[] = [];

  beforeAll(async () => {
    requireLocalUrl();
    const pickingSession = await signIn("emilio@cat.local");
    const adminSession = await signIn("ilan@cat.local");
    picking = pickingSession.client;
    admin = adminSession.client;
    pickingId = pickingSession.userId;

    const types = await admin
      .from("requirement_types")
      .select("id, code, label, stage")
      .eq("code", "ETIQUETAS")
      .maybeSingle();
    expect(types.error).toBeNull();
    expect(types.data?.id).toBeTruthy();
    expect(types.data?.stage).toBe("DISPATCH");

    deliveryNumber = `RLS1-${Date.now()}`;
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: deliveryNumber,
      p_modality: "CUSTOMER_PICKUP",
      p_destination: "Cliente RLS deliveries",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: pickingId,
      p_due_at: null,
      p_observations: null,
      p_intent: "publish",
      p_requirements: [
        {
          typeId: types.data!.id,
          label: types.data!.label,
          required: true,
          applicable: true,
          displayOrder: 10,
        },
      ],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    expect(saved.data).toBeTruthy();
    deliveryId = saved.data as string;
    created.push(deliveryId);

    const published = await picking
      .from("deliveries")
      .select("id, status")
      .eq("id", deliveryId)
      .maybeSingle();
    expect(published.error).toBeNull();
    expect(published.data?.id).toBe(deliveryId);
    expect(published.data?.status).toBe("PUBLISHED");
  });

  afterAll(async () => {
    await picking?.auth.signOut();
    await admin?.auth.signOut();
  });

  it("PICKING JWT no puede UPDATE status por tabla", async () => {
    const before = await readDelivery(picking, deliveryId);
    expect(before.status).toBe("PUBLISHED");
    expect(before.deleted_at).toBeNull();

    const attempt = await picking
      .from("deliveries")
      .update({ status: "READY" })
      .eq("id", deliveryId)
      .select("id, status");

    const touched = attempt.data ?? [];
    expect(touched, JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await readDelivery(picking, deliveryId);
    expect(after.status).toBe("PUBLISHED");
    expect(after.deleted_at).toBeNull();
  });

  it("PICKING JWT no puede UPDATE deleted_at por tabla", async () => {
    const before = await readDelivery(picking, deliveryId);
    const attempt = await picking
      .from("deliveries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deliveryId)
      .select("id, deleted_at");

    const touched = attempt.data ?? [];
    expect(touched, JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await readDelivery(picking, deliveryId);
    expect(after.status).toBe(before.status);
    expect(after.deleted_at).toBeNull();
  });

  it("ADMIN con anon key + JWT (no service role) no puede UPDATE directo", async () => {
    const before = await readDelivery(admin, deliveryId);
    const attempt = await admin
      .from("deliveries")
      .update({ status: "READY", destination: "hackeado" })
      .eq("id", deliveryId)
      .select("id, status, destination");

    const touched = attempt.data ?? [];
    expect(touched, JSON.stringify(attempt)).toEqual([]);
    if (attempt.error) expect(isPermissionDenied(attempt.error)).toBe(true);

    const after = await readDelivery(admin, deliveryId);
    expect(after.status).toBe(before.status);
    expect(after.destination).toBe(before.destination);
    expect(after.deleted_at).toBeNull();
  });

  it("PICKING puede transition_delivery PUBLISHED → READY", async () => {
    const before = await readDelivery(picking, deliveryId);
    expect(before.status).toBe("PUBLISHED");

    const rpc = await picking.rpc("transition_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "PUBLISHED",
      p_next_status: "READY",
      p_action: "READY",
      p_metadata: {},
    });
    expect(rpc.error, rpc.error?.message).toBeNull();
    expect(rpc.data).toBe(deliveryId);

    const after = await readDelivery(picking, deliveryId);
    expect(after.status).toBe("READY");
    expect(after.deleted_at).toBeNull();
  });

  it("ADMIN puede save_delivery sobre la entrega", async () => {
    const before = await readDelivery(admin, deliveryId);
    expect(before.status).toBe("READY");

    const types = await admin
      .from("requirement_types")
      .select("id, label")
      .eq("code", "ETIQUETAS")
      .maybeSingle();
    expect(types.data?.id).toBeTruthy();

    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: deliveryId,
      p_expected_status: "READY",
      p_number: deliveryNumber,
      p_modality: "CUSTOMER_PICKUP",
      p_destination: "Cliente RLS deliveries editado",
      p_packages: 2,
      p_priority: "HIGH",
      p_assignee_id: pickingId,
      p_due_at: null,
      p_observations: "edit por rpc",
      p_intent: "publish",
      p_requirements: [
        {
          typeId: types.data!.id,
          label: types.data!.label,
          required: true,
          applicable: true,
          displayOrder: 10,
        },
      ],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    expect(saved.data).toBe(deliveryId);

    const after = await readDelivery(admin, deliveryId);
    expect(after.status).toBe("READY");
    expect(after.destination).toBe("Cliente RLS deliveries editado");
    expect(after.deleted_at).toBeNull();
  });

  it("SELECT de entregas no DRAFT sigue funcionando para PICKING", async () => {
    const row = await readDelivery(picking, deliveryId);
    expect(row.number).toBe(deliveryNumber);
    expect(row.status).toBe("READY");

    const listed = await picking
      .from("deliveries")
      .select("id, status")
      .eq("id", deliveryId);
    expect(listed.error).toBeNull();
    expect(listed.data?.some((item) => item.id === deliveryId)).toBe(true);
  });
});
