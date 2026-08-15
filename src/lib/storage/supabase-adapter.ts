import { createAdminClient } from "@/lib/supabase/admin";
import type { EvidenceStorage, UploadEvidenceInput, UploadedObject } from "@/lib/storage/types";
import { voidedKey } from "@/lib/storage/path";

const BUCKET = "evidences";

export class SupabaseEvidenceStorage implements EvidenceStorage {
  async upload(input: UploadEvidenceInput): Promise<UploadedObject> {
    const supabase = createAdminClient();
    const body = Buffer.from(input.bytes);
    const { error } = await supabase.storage.from(BUCKET).upload(input.key, body, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (error) {
      throw new Error(`No se pudo guardar la evidencia: ${error.message}`);
    }
    return { key: input.key };
  }

  async getAuthorizedUrl(key: string, expiresInSeconds = 120): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`No se pudo firmar el acceso a la evidencia: ${error?.message ?? "sin URL"}`);
    }
    return data.signedUrl;
  }

  async download(key: string): Promise<Uint8Array> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(key);
    if (error || !data) {
      throw new Error(`No se pudo leer la evidencia: ${error?.message ?? "archivo vacío"}`);
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async void(key: string): Promise<void> {
    const supabase = createAdminClient();
    const target = voidedKey(key);
    if (target === key) return;
    const { error } = await supabase.storage.from(BUCKET).move(key, target);
    if (error) {
      // El registro en DB sigue anulado aunque el archivo no se mueva.
      console.error("storage.void move failed", { key, message: error.message });
    }
  }

  async remove(key: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(BUCKET).remove([key, voidedKey(key)]);
    if (error) {
      console.error("storage.remove failed", { key, message: error.message });
    }
  }
}
