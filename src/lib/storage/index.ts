import { SupabaseEvidenceStorage } from "@/lib/storage/supabase-adapter";
import { R2EvidenceStorage } from "@/lib/storage/r2-adapter";
import type { EvidenceStorage } from "@/lib/storage/types";

export type { EvidenceStorage, UploadEvidenceInput, UploadedObject } from "@/lib/storage/types";
export { SupabaseEvidenceStorage } from "@/lib/storage/supabase-adapter";
export { R2EvidenceStorage } from "@/lib/storage/r2-adapter";

let supabaseInstance: EvidenceStorage | null = null;
let r2Instance: EvidenceStorage | null = null;

export function getEvidenceStorageForProvider(provider?: string | null): EvidenceStorage {
  const normalized = (provider ?? process.env.EVIDENCE_STORAGE_PROVIDER ?? "supabase").toLowerCase();

  if (normalized === "supabase") {
    if (!supabaseInstance) {
      supabaseInstance = new SupabaseEvidenceStorage();
    }
    return supabaseInstance;
  }

  if (normalized === "r2") {
    if (!r2Instance) {
      r2Instance = new R2EvidenceStorage();
    }
    return r2Instance;
  }

  throw new Error(
    `Storage provider "${provider}" no reconocido. Valores válidos: "supabase" | "r2".`,
  );
}

export function getEvidenceStorage(): EvidenceStorage {
  return getEvidenceStorageForProvider(process.env.EVIDENCE_STORAGE_PROVIDER ?? "supabase");
}

export function resetEvidenceStorage(): void {
  supabaseInstance = null;
  r2Instance = null;
}
