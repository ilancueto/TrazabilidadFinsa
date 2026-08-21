import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEMPLATE_SPECS } from "@/lib/deliveries/templates";

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
  expect(["127.0.0.1", "localhost"]).toContain(host);
}

function sessionClient() {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

describe.sequential("modalidad DESPACHO y carrier", () => {
  let admin: SupabaseClient;
  let pickingId = "";
  const remito = {
    typeId: "",
    label: "Remito",
    required: true,
    applicable: true,
    displayOrder: 10,
  };

  beforeAll(async () => {
    requireLocalUrl();
    admin = sessionClient();
    const login = await admin.auth.signInWithPassword({
      email: "ilan@cat.local",
      password: localPassword,
    });
    expect(login.error).toBeNull();
    const picking = await admin.from("profiles").select("id").eq("role", "PICKING").eq("active", true).limit(1).maybeSingle();
    pickingId = picking.data?.id ?? "";
    const type = await admin.from("requirement_types").select("id, label").eq("code", "REMITO").maybeSingle();
    remito.typeId = type.data?.id ?? "";
    remito.label = type.data?.label ?? "Remito";
    expect(remito.typeId).toBeTruthy();
  });

  afterAll(async () => {
    await admin?.auth.signOut();
  });

  it("el seed histórico despacho quedó DESPACHO + ANDREANI", async () => {
    const row = await admin
      .from("deliveries")
      .select("modality, carrier")
      .eq("number", "806042356")
      .maybeSingle();
    expect(row.error).toBeNull();
    expect(row.data?.modality).toBe("DESPACHO");
    expect(row.data?.carrier).toBe("ANDREANI");
  });

  it("CUSTOMER_PICKUP del seed queda sin carrier", async () => {
    const row = await admin
      .from("deliveries")
      .select("modality, carrier")
      .eq("number", "806042401")
      .maybeSingle();
    expect(row.error).toBeNull();
    expect(row.data?.modality).toBe("CUSTOMER_PICKUP");
    expect(row.data?.carrier).toBeNull();
  });

  it("cero filas con modalidad ANDREANI", async () => {
    const rows = await admin.from("deliveries").select("id").eq("modality", "ANDREANI");
    expect(rows.error).toBeNull();
    expect(rows.data ?? []).toEqual([]);
  });

  it("save_delivery DESPACHO + ANDREANI funciona", async () => {
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `M21D-${Date.now()}`,
      p_modality: "DESPACHO",
      p_carrier: "ANDREANI",
      p_destination: "Cliente 2.1 despacho",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: pickingId || null,
      p_due_at: null,
      p_observations: null,
      p_intent: "draft",
      p_requirements: [remito],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    const row = await admin.from("deliveries").select("modality, carrier").eq("id", saved.data).maybeSingle();
    expect(row.data?.modality).toBe("DESPACHO");
    expect(row.data?.carrier).toBe("ANDREANI");
  });

  it("save_delivery CUSTOMER_PICKUP + NULL funciona", async () => {
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `M21P-${Date.now()}`,
      p_modality: "CUSTOMER_PICKUP",
      p_carrier: null,
      p_destination: "Cliente 2.1 retiro",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: null,
      p_due_at: null,
      p_observations: null,
      p_intent: "draft",
      p_requirements: [remito],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    const row = await admin.from("deliveries").select("modality, carrier").eq("id", saved.data).maybeSingle();
    expect(row.data?.modality).toBe("CUSTOMER_PICKUP");
    expect(row.data?.carrier).toBeNull();
  });

  it("rechaza DESPACHO sin carrier", async () => {
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `M21X-${Date.now()}`,
      p_modality: "DESPACHO",
      p_carrier: null,
      p_destination: "Cliente inválido",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: null,
      p_due_at: null,
      p_observations: null,
      p_intent: "draft",
      p_requirements: [remito],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error).toBeTruthy();
  });

  it("rechaza CUSTOMER_PICKUP con carrier", async () => {
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `M21Y-${Date.now()}`,
      p_modality: "CUSTOMER_PICKUP",
      p_carrier: "ANDREANI",
      p_destination: "Cliente inválido",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: null,
      p_due_at: null,
      p_observations: null,
      p_intent: "draft",
      p_requirements: [remito],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error).toBeTruthy();
  });

  it("mapea modalidad ANDREANI de entrada a DESPACHO + ANDREANI", async () => {
    const saved = await admin.rpc("save_delivery", {
      p_delivery_id: null,
      p_expected_status: null,
      p_number: `M21L-${Date.now()}`,
      p_modality: "ANDREANI",
      p_carrier: null,
      p_destination: "Cliente legado",
      p_packages: 1,
      p_priority: "NORMAL",
      p_assignee_id: null,
      p_due_at: null,
      p_observations: null,
      p_intent: "draft",
      p_requirements: [remito],
      p_client_id: null,
      p_pallet_code: null,
    });
    expect(saved.error, saved.error?.message).toBeNull();
    const row = await admin.from("deliveries").select("modality, carrier").eq("id", saved.data).maybeSingle();
    expect(row.data?.modality).toBe("DESPACHO");
    expect(row.data?.carrier).toBe("ANDREANI");
  });

  it("filtros despacho vs retiro", async () => {
    const despacho = await admin.from("deliveries").select("id, modality").eq("modality", "DESPACHO").limit(5);
    const retiro = await admin.from("deliveries").select("id, modality").eq("modality", "CUSTOMER_PICKUP").limit(5);
    expect(despacho.error).toBeNull();
    expect(retiro.error).toBeNull();
    expect((despacho.data ?? []).every((row) => row.modality === "DESPACHO")).toBe(true);
    expect((retiro.data ?? []).every((row) => row.modality === "CUSTOMER_PICKUP")).toBe(true);
    expect((despacho.data ?? []).length).toBeGreaterThan(0);
    expect((retiro.data ?? []).length).toBeGreaterThan(0);
  });

  it("plantilla DESPACHO incluye ETIQUETAS", async () => {
    const codes = TEMPLATE_SPECS.DESPACHO.map((item) => item.typeCode);
    expect(codes).toContain("ETIQUETAS");
    const template = await admin
      .from("delivery_templates")
      .select("code, modality")
      .eq("modality", "DESPACHO")
      .maybeSingle();
    expect(template.data?.code).toBe("DESPACHO");
    expect(template.data?.modality).toBe("DESPACHO");
  });
});
