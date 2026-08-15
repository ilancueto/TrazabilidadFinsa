import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shouldDelete = process.argv.includes("--delete");
if (!url || !service) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, service, { auth: { persistSession: false } });

async function databaseKeys() {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("evidences")
      .select("storage_key, thumbnail_storage_key, voided_at")
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      keys.add(row.storage_key);
      if (row.thumbnail_storage_key) keys.add(row.thumbnail_storage_key);
      if (row.voided_at) {
        keys.add(`voided/${row.storage_key}`);
        if (row.thumbnail_storage_key) keys.add(`voided/${row.thumbnail_storage_key}`);
      }
    }
    if ((data ?? []).length < 1000) break;
  }
  return keys;
}

async function storageKeys(path = ""): Promise<string[]> {
  const keys: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from("evidences").list(path, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const entry of data ?? []) {
      const key = path ? `${path}/${entry.name}` : entry.name;
      if (entry.id) keys.push(key);
      else keys.push(...await storageKeys(key));
    }
    if ((data ?? []).length < 1000) break;
  }
  return keys;
}

async function main() {
  const [known, stored] = await Promise.all([databaseKeys(), storageKeys()]);
  const orphaned = stored.filter((key) => !known.has(key));
  console.log(JSON.stringify({ mode: shouldDelete ? "delete" : "dry-run", stored: stored.length, known: known.size, orphaned }, null, 2));
  if (!shouldDelete || orphaned.length === 0) return;
  for (let index = 0; index < orphaned.length; index += 100) {
    const { error } = await supabase.storage.from("evidences").remove(orphaned.slice(index, index + 100));
    if (error) throw error;
  }
  console.log(`Eliminados ${orphaned.length} objetos huérfanos.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
