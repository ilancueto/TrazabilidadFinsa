import { createClient } from "@supabase/supabase-js";
import { solidPng } from "./png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const picking = createClient(url, anon, { auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const login = await picking.auth.signInWithPassword({
    email: "emilio@cat.local",
    password: "CatLocal123!",
  });
  if (login.error) throw login.error;

  const req = await picking
    .from("delivery_requirements")
    .select("id, delivery_id, label, applicable, requirement_types(code), deliveries!inner(id, number, status)")
    .eq("label", "Evidencia final")
    .limit(1)
    .maybeSingle();
  console.log("nested query error:", req.error?.message ?? "none");
  console.log("nested query data keys:", req.data ? Object.keys(req.data) : null);
  console.log("deliveries shape:", JSON.stringify((req.data as { deliveries?: unknown } | null)?.deliveries));
  console.log("types shape:", JSON.stringify((req.data as { requirement_types?: unknown } | null)?.requirement_types));

  const simple = await picking
    .from("delivery_requirements")
    .select("id, delivery_id, label, applicable, requirement_type_id")
    .limit(1)
    .maybeSingle();
  console.log("simple query error:", simple.error?.message ?? "none");

  const png = solidPng(32, 32, [255, 204, 0]);
  const keyU8 = `diag/${Date.now()}-u8.png`;
  const keyBuf = `diag/${Date.now()}-buf.png`;

  const u8 = await admin.storage.from("evidences").upload(keyU8, new Uint8Array(png), {
    contentType: "image/png",
    upsert: true,
  });
  console.log("upload Uint8Array:", u8.error?.message ?? "ok");

  const buf = await admin.storage.from("evidences").upload(keyBuf, png, {
    contentType: "image/png",
    upsert: true,
  });
  console.log("upload Buffer:", buf.error?.message ?? "ok");

  if (!u8.error) {
    const down = await admin.storage.from("evidences").download(keyU8);
    console.log("download Uint8Array size:", down.data ? down.data.size : down.error?.message);
  }
  if (!buf.error) {
    const down = await admin.storage.from("evidences").download(keyBuf);
    console.log("download Buffer size:", down.data ? down.data.size : down.error?.message);
  }

  await admin.storage.from("evidences").remove([keyU8, keyBuf]);

  if (!simple.data) throw new Error("no requirement");
  const fakeFile = { size: png.length, type: "image/png" };
  console.log("instanceof File on plain object:", fakeFile instanceof File);
  console.log("File defined:", typeof File);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
