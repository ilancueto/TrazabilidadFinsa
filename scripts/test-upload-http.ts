import { createClient } from "@supabase/supabase-js";
import { solidPng } from "./png";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const app = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const picking = createClient(url, anon, { auth: { persistSession: false } });
  const login = await picking.auth.signInWithPassword({
    email: "emilio@cat.local",
    password: "CatLocal123!",
  });
  if (login.error || !login.data.session) {
    throw new Error(login.error?.message ?? "login failed");
  }

  const req = await picking
    .from("delivery_requirements")
    .select("id, deliveries!inner(number)")
    .eq("label", "Evidencia final")
    .eq("deliveries.number", "806042356")
    .maybeSingle();
  if (!req.data) throw new Error("missing requirement");

  const png = new Uint8Array(solidPng(40, 28, [36, 36, 36]));
  const form = new FormData();
  form.set("requirementId", req.data.id);
  form.set("file", new Blob([png], { type: "image/png" }), "http-test.png");
  form.set("filename", "http-test.png");
  form.set("comment", "http e2e");

  const post = await fetch(`${app}/api/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.data.session.access_token}` },
    body: form,
  });
  const raw = await post.text();
  let posted: { error?: string; evidenceId?: string } = {};
  try {
    posted = JSON.parse(raw) as { error?: string; evidenceId?: string };
  } catch {
    throw new Error(`POST /api/evidence failed: ${post.status} ${raw.slice(0, 400)}`);
  }
  if (!post.ok || !posted.evidenceId) {
    throw new Error(`POST /api/evidence failed: ${post.status} ${posted.error}`);
  }

  try {
    const file = await fetch(`${app}/api/evidence/${posted.evidenceId}/file`, {
      headers: { Authorization: `Bearer ${login.data.session.access_token}` },
    });
    if (!file.ok) {
      throw new Error(`GET file failed: ${file.status} ${await file.text()}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) {
      throw new Error("downloaded file is not a PNG");
    }
    console.log("HTTP UPLOAD OK", posted.evidenceId, "bytes", bytes.byteLength);
  } finally {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: evidence } = await admin.from("evidences").select("storage_key, thumbnail_storage_key").eq("id", posted.evidenceId).maybeSingle();
    await admin.from("evidences").delete().eq("id", posted.evidenceId);
    await admin.from("audit_events").delete().contains("metadata", { evidenceId: posted.evidenceId });
    if (evidence?.storage_key) {
      await admin.storage.from("evidences").remove(
        [evidence.storage_key, evidence.thumbnail_storage_key].filter(Boolean) as string[],
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
