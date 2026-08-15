import { createClient } from "@supabase/supabase-js";
import { solidPng } from "./png";

type DeliveryModality = "ANDREANI" | "CUSTOMER_PICKUP";
type DeliveryStatus = "DRAFT" | "PUBLISHED" | "IN_PICKING" | "READY" | "CLOSED";
type RequirementTypeCode =
  | "REMITO"
  | "ETIQUETAS"
  | "TRIPLICADO"
  | "PACKING_LIST"
  | "BULTOS"
  | "EVIDENCIA_FINAL";

const TEMPLATE_SPECS: Record<
  DeliveryModality,
  Array<{
    typeCode: RequirementTypeCode;
    required: boolean;
    applicable: boolean;
    displayOrder: number;
  }>
> = {
  ANDREANI: [
    { typeCode: "REMITO", required: true, applicable: true, displayOrder: 10 },
    { typeCode: "ETIQUETAS", required: true, applicable: true, displayOrder: 20 },
    { typeCode: "TRIPLICADO", required: true, applicable: true, displayOrder: 30 },
    { typeCode: "PACKING_LIST", required: false, applicable: true, displayOrder: 40 },
    { typeCode: "BULTOS", required: true, applicable: true, displayOrder: 50 },
    { typeCode: "EVIDENCIA_FINAL", required: true, applicable: true, displayOrder: 60 },
  ],
  CUSTOMER_PICKUP: [
    { typeCode: "REMITO", required: true, applicable: true, displayOrder: 10 },
    { typeCode: "TRIPLICADO", required: true, applicable: true, displayOrder: 20 },
    { typeCode: "PACKING_LIST", required: false, applicable: true, displayOrder: 30 },
    { typeCode: "BULTOS", required: true, applicable: true, displayOrder: 40 },
    { typeCode: "EVIDENCIA_FINAL", required: true, applicable: true, displayOrder: 50 },
  ],
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ILAN = "11111111-1111-4111-8111-111111111111";
const EMILIO = "22222222-2222-4222-8222-222222222222";

const USERS = [
  {
    id: ILAN,
    email: "ilan@cat.local",
    password: "CatLocal123!",
    name: "Ilan Cueto",
    role: "ADMIN" as const,
  },
  {
    id: EMILIO,
    email: "emilio@cat.local",
    password: "CatLocal123!",
    name: "Emilio Chejolan",
    role: "PICKING" as const,
  },
];

type SeedDelivery = {
  id: string;
  number: string;
  modality: DeliveryModality;
  destination: string;
  packages: number;
  priority: "NORMAL" | "HIGH" | "URGENT";
  status: DeliveryStatus;
  assignee: string;
  createdBy: string;
  observations: string | null;
  hasObservation: boolean;
  completeAll: boolean;
  skipCodes?: RequirementTypeCode[];
};

const SEEDS: SeedDelivery[] = [
  {
    id: "d0000000-0000-4000-8000-000000000001",
    number: "806042356",
    modality: "ANDREANI",
    destination: "Cliente Norte Demo",
    packages: 4,
    priority: "URGENT",
    status: "IN_PICKING",
    assignee: ILAN,
    createdBy: ILAN,
    observations: null,
    hasObservation: false,
    completeAll: false,
    skipCodes: ["EVIDENCIA_FINAL"],
  },
  {
    id: "d0000000-0000-4000-8000-000000000002",
    number: "806042401",
    modality: "CUSTOMER_PICKUP",
    destination: "Cliente Retiro Demo",
    packages: 2,
    priority: "NORMAL",
    status: "READY",
    assignee: EMILIO,
    createdBy: ILAN,
    observations: null,
    hasObservation: false,
    completeAll: true,
  },
  {
    id: "d0000000-0000-4000-8000-000000000003",
    number: "806042487",
    modality: "ANDREANI",
    destination: "Cliente Litoral Demo",
    packages: 3,
    priority: "HIGH",
    status: "IN_PICKING",
    assignee: ILAN,
    createdBy: ILAN,
    observations: "[seed] Observación de etiqueta: falta reimprimir etiqueta Andreani.",
    hasObservation: true,
    completeAll: false,
    skipCodes: ["ETIQUETAS", "EVIDENCIA_FINAL"],
  },
  {
    id: "d0000000-0000-4000-8000-000000000004",
    number: "806042512",
    modality: "ANDREANI",
    destination: "Cliente Sur Demo",
    packages: 1,
    priority: "NORMAL",
    status: "CLOSED",
    assignee: EMILIO,
    createdBy: ILAN,
    observations: null,
    hasObservation: false,
    completeAll: true,
  },
];

async function ensureUser(user: (typeof USERS)[number]) {
  const { data: existing } = await supabase.auth.admin.getUserById(user.id);
  if (!existing.user) {
    const created = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.name },
    });
    if (created.error) throw created.error;
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: user.name,
    role: user.role,
    must_change_password: false,
  });
  if (error) throw error;
}

async function main() {
  for (const user of USERS) {
    await ensureUser(user);
  }

  const { data: types, error: typeError } = await supabase
    .from("requirement_types")
    .select("id, code, label");
  if (typeError || !types) throw typeError ?? new Error("Sin requirement_types");
  const typeByCode = new Map(types.map((row) => [row.code as RequirementTypeCode, row]));

  const numbers = SEEDS.map((item) => item.number);
  const { data: existing } = await supabase.from("deliveries").select("id").in("number", numbers);
  const existingIds = (existing ?? []).map((row) => row.id);
  if (existingIds.length > 0) {
    const { data: reqs } = await supabase
      .from("delivery_requirements")
      .select("id")
      .in("delivery_id", existingIds);
    const reqIds = (reqs ?? []).map((row) => row.id);
    if (reqIds.length > 0) {
      const { data: stored } = await supabase
        .from("evidences")
        .select("storage_key, thumbnail_storage_key")
        .in("requirement_id", reqIds);
      await supabase.from("evidences").delete().in("requirement_id", reqIds);
      const keys = (stored ?? []).flatMap((row) =>
        [row.storage_key, row.thumbnail_storage_key].filter(Boolean) as string[],
      );
      if (keys.length > 0) await supabase.storage.from("evidences").remove(keys);
    }
    await supabase.from("audit_events").delete().in("delivery_id", existingIds);
    await supabase.from("delivery_requirements").delete().in("delivery_id", existingIds);
    await supabase.from("deliveries").delete().in("id", existingIds);
  }

  const placeholder = solidPng(640, 400, [255, 204, 0]);

  for (const seed of SEEDS) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("deliveries").insert({
      id: seed.id,
      number: seed.number,
      modality: seed.modality,
      destination: seed.destination,
      packages: seed.packages,
      priority: seed.priority,
      status: seed.status,
      assignee_id: seed.assignee,
      created_by: seed.createdBy,
      observations: seed.observations,
      has_open_observation: seed.hasObservation,
      published_at: now,
      ready_at: seed.status === "READY" || seed.status === "CLOSED" ? now : null,
      closed_at: seed.status === "CLOSED" ? now : null,
      closed_by: seed.status === "CLOSED" ? ILAN : null,
    });
    if (error) throw error;

    const specs = TEMPLATE_SPECS[seed.modality];
    for (const spec of specs) {
      const type = typeByCode.get(spec.typeCode);
      if (!type) throw new Error(`Falta tipo ${spec.typeCode}`);
      const reqId = crypto.randomUUID();
      const { error: reqError } = await supabase.from("delivery_requirements").insert({
        id: reqId,
        delivery_id: seed.id,
        requirement_type_id: type.id,
        label: type.label,
        required: spec.required,
        applicable: spec.applicable,
        display_order: spec.displayOrder,
      });
      if (reqError) throw reqError;

      const shouldComplete =
        spec.applicable && (seed.completeAll || !seed.skipCodes?.includes(spec.typeCode));
      if (!shouldComplete) continue;

      const evidenceId = crypto.randomUUID();
      const key = `2026/08/${seed.number}/${spec.typeCode}/${evidenceId}.png`;
      const upload = await supabase.storage.from("evidences").upload(key, placeholder, {
        contentType: "image/png",
        upsert: true,
      });
      if (upload.error) throw upload.error;

      const { error: evError } = await supabase.from("evidences").insert({
        id: evidenceId,
        requirement_id: reqId,
        provider: "SUPABASE",
        storage_key: key,
        filename: `${spec.typeCode.toLowerCase()}-demo.png`,
        mime_type: "image/png",
        size_bytes: placeholder.length,
        width: 640,
        height: 400,
        comment: "Evidencia dummy de seed",
        uploader_id: seed.assignee,
      });
      if (evError) throw evError;
    }

    const events = [
      { action: "CREATED", actor_id: ILAN },
      { action: "PUBLISHED", actor_id: ILAN },
      { action: "ASSIGNED", actor_id: ILAN },
    ];
    if (seed.status === "IN_PICKING" || seed.status === "READY" || seed.status === "CLOSED") {
      events.push({ action: "PICKING_STARTED", actor_id: seed.assignee });
      events.push({ action: "EVIDENCE_UPLOADED", actor_id: seed.assignee });
    }
    if (seed.hasObservation) {
      events.push({ action: "OBSERVATION_ADDED", actor_id: seed.assignee });
    }
    if (seed.status === "READY" || seed.status === "CLOSED") {
      events.push({ action: "READY", actor_id: seed.assignee });
    }
    if (seed.status === "CLOSED") {
      events.push({ action: "CLOSED", actor_id: ILAN });
    }

    const { error: auditError } = await supabase.from("audit_events").insert(
      events.map((event) => ({
        delivery_id: seed.id,
        actor_id: event.actor_id,
        action: event.action,
        metadata: { seed: true },
      })),
    );
    if (auditError) throw auditError;
  }

  console.log("Seed OK: usuarios Ilan/Emilio + 4 entregas demo");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
