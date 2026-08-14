import { SupabaseEvidenceStorage } from "@/lib/storage/supabase-adapter";
import type { EvidenceStorage } from "@/lib/storage/types";

let instance: EvidenceStorage | null = null;

export function getEvidenceStorage(): EvidenceStorage {
  if (!instance) {
    const provider = process.env.EVIDENCE_STORAGE_PROVIDER ?? "supabase";
    if (provider !== "supabase") {
      throw new Error(
        `Storage "${provider}" no está implementado. Usar supabase en local o completar el adapter corporativo.`,
      );
    }
    instance = new SupabaseEvidenceStorage();
  }
  return instance;
}
