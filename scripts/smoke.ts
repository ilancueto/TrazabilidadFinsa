import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function asUser(email: string, password: string) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function main() {
  const admin = await asUser("ilan@cat.local", "CatLocal123!");
  const picking = await asUser("emilio@cat.local", "CatLocal123!");

  const adminList = await admin.from("deliveries").select("number,status").order("number");
  if (adminList.error) throw adminList.error;
  const numbers = (adminList.data ?? []).map((row) => `${row.number}:${row.status}`);
  console.log("admin deliveries", numbers.join(", "));

  const embed = await admin
    .from("deliveries")
    .select("number, assignee:profiles!assignee_id(full_name)")
    .eq("number", "806042356")
    .maybeSingle();
  if (embed.error) throw embed.error;
  console.log("assignee embed", JSON.stringify(embed.data));

  const reqEmbed = await admin
    .from("delivery_requirements")
    .select("label, requirement_types(code)")
    .limit(1)
    .maybeSingle();
  if (reqEmbed.error) throw reqEmbed.error;
  console.log("requirement embed", JSON.stringify(reqEmbed.data));

  const pickingList = await picking.from("deliveries").select("number,status").order("number");
  if (pickingList.error) throw pickingList.error;
  const pickingNumbers = pickingList.data ?? [];
  if (pickingNumbers.some((row) => row.status === "DRAFT")) {
    throw new Error("Picking no debería ver borradores");
  }
  console.log("picking deliveries", pickingNumbers.map((row) => row.number).join(", "));

  const insert = await picking.from("deliveries").insert({
    number: "SHOULD-FAIL",
    modality: "DESPACHO",
    carrier: "ANDREANI",
    destination: "x",
    packages: 1,
    created_by: (await picking.auth.getUser()).data.user?.id,
  });
  if (!insert.error) throw new Error("Picking no debería poder crear entregas");
  console.log("picking create blocked:", insert.error.message);

  const closed = await admin.from("deliveries").select("id").eq("number", "806042512").single();
  if (closed.error || !closed.data) throw closed.error ?? new Error("Falta seed cerrada");
  const reopenAsPicking = await picking
    .from("deliveries")
    .update({ status: "IN_PICKING" })
    .eq("id", closed.data.id)
    .select("id,status");
  if ((reopenAsPicking.data ?? []).length > 0) {
    throw new Error("Picking no debería reabrir/cerrar");
  }
  const stillClosed = await admin
    .from("deliveries")
    .select("status")
    .eq("id", closed.data.id)
    .single();
  if (stillClosed.data?.status !== "CLOSED") {
    throw new Error("La entrega cerrada cambió de estado");
  }
  console.log("picking close/reopen blocked (0 rows)");

  const masterEdit = await picking
    .from("deliveries")
    .update({ destination: "hack" })
    .eq("number", "806042356")
    .select("id");
  if ((masterEdit.data ?? []).length > 0 || !masterEdit.error) {
    if ((masterEdit.data ?? []).length > 0) {
      throw new Error("Picking no debería editar destino");
    }
  }
  console.log("picking master edit blocked:", masterEdit.error?.message ?? "0 rows");

  const reqUpdate = await picking
    .from("delivery_requirements")
    .update({ applicable: false })
    .eq("id", "00000000-0000-0000-0000-000000000000");
  console.log("picking requirement update:", reqUpdate.error?.message ?? "sin fila");

  console.log("SMOKE OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
