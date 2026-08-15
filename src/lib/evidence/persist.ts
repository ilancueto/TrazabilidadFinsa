import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canUploadEvidence } from "@/lib/deliveries/permissions";
import { getEvidenceStorage } from "@/lib/storage";
import { buildEvidenceKey, thumbnailKey } from "@/lib/storage/path";
import type { DeliveryStatus, RequirementTypeCode, UserRole } from "@/lib/types";
import { isUuid, sanitizeFilename } from "@/lib/utils";
import {
  PersistForbiddenError,
  PersistNotFoundError,
  PersistValidationError,
  assertUploadSize,
} from "@/lib/evidence/mime";
import { normalizeEvidenceBytes } from "@/lib/evidence/normalize";
import { logServerError } from "@/lib/observability";

export type PersistEvidenceInput = {
  actorId: string;
  actorRole: UserRole;
  requirementId: string;
  bytes: Uint8Array;
  declaredMime?: string | null;
  filename: string;
  width?: number | null;
  height?: number | null;
  comment?: string | null;
};

export type PersistEvidenceResult = {
  evidenceId: string;
  deliveryId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  nextRequirementId: string | null;
};

export async function persistEvidence(
  userClient: SupabaseClient,
  input: PersistEvidenceInput,
): Promise<PersistEvidenceResult> {
  if (!isUuid(input.requirementId)) {
    throw new PersistValidationError("Requisito inválido");
  }
  assertUploadSize(input.bytes.byteLength);

  let bytes = input.bytes;
  let mimeType: string;
  try {
    const normalized = await normalizeEvidenceBytes(bytes, input.declaredMime);
    bytes = normalized.bytes;
    mimeType = normalized.mimeType;
    assertUploadSize(bytes.byteLength);
  } catch (error) {
    throw new PersistValidationError(
      error instanceof Error ? error.message : "Formato de imagen no permitido",
    );
  }

  const { data: requirement, error: reqError } = await userClient
    .from("delivery_requirements")
    .select("id, delivery_id, label, applicable, requirement_type_id")
    .eq("id", input.requirementId)
    .maybeSingle();

  if (reqError) {
    throw new Error(`No se pudo leer el requisito: ${reqError.message}`);
  }
  if (!requirement) {
    throw new PersistNotFoundError("Requisito no encontrado");
  }
  if (!requirement.applicable) {
    throw new PersistForbiddenError("Ese requisito no aplica");
  }

  const { data: delivery, error: deliveryError } = await userClient
    .from("deliveries")
    .select("id, number, status")
    .eq("id", requirement.delivery_id)
    .maybeSingle();

  if (deliveryError) {
    throw new Error(`No se pudo leer la entrega: ${deliveryError.message}`);
  }
  if (!delivery) {
    throw new PersistNotFoundError("Entrega no encontrada");
  }

  const status = delivery.status as DeliveryStatus;
  if (!canUploadEvidence(input.actorRole, status)) {
    throw new PersistForbiddenError("No se pueden cargar evidencias en este estado");
  }

  const { data: typeRow, error: typeError } = await userClient
    .from("requirement_types")
    .select("code")
    .eq("id", requirement.requirement_type_id)
    .maybeSingle();
  if (typeError) {
    throw new Error(`No se pudo leer el tipo de requisito: ${typeError.message}`);
  }

  const typeCode = (typeRow?.code as RequirementTypeCode | undefined) ?? "REMITO";
  const evidenceId = crypto.randomUUID();
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const filename = sanitizeFilename(input.filename || `evidencia-${typeCode}${extension}`);
  const storageKey = buildEvidenceKey({
    deliveryNumber: delivery.number,
    requirementCode: typeCode,
    filename,
    evidenceId,
  });
  const thumbKey = thumbnailKey(storageKey);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storage = getEvidenceStorage();

  await storage.upload({
    key: storageKey,
    bytes,
    mimeType,
  });

  let thumbnailBytes: Uint8Array | null = null;
  try {
    const sharp = (await import("sharp")).default;
    const generated = await sharp(bytes)
      .rotate()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    thumbnailBytes = new Uint8Array(generated);
    await storage.upload({ key: thumbKey, bytes: thumbnailBytes, mimeType: "image/webp" });
  } catch (error) {
    logServerError("evidence.thumbnail_failed", error, { evidenceId });
  }

  const { data: registeredDeliveryId, error: insertError } = await userClient.rpc("register_evidence_v2", {
    p_evidence_id: evidenceId,
    p_requirement_id: input.requirementId,
    p_storage_key: storageKey,
    p_filename: filename,
    p_mime_type: mimeType,
    p_size_bytes: bytes.byteLength,
    p_width: input.width && input.width > 0 ? input.width : null,
    p_height: input.height && input.height > 0 ? input.height : null,
    p_checksum: checksum,
    p_comment: input.comment?.trim() || null,
    p_thumbnail_storage_key: thumbnailBytes ? thumbKey : null,
    p_thumbnail_mime_type: thumbnailBytes ? "image/webp" : null,
    p_thumbnail_size_bytes: thumbnailBytes?.byteLength ?? null,
  });

  if (insertError) {
    try {
      if (storage.remove) {
        await storage.remove(storageKey);
        if (thumbnailBytes) await storage.remove(thumbKey);
      } else {
        await storage.void(storageKey);
      }
    } catch {
      // El archivo queda huérfano; el insert fallido es el error que importa.
    }
    throw new Error(`No se pudo registrar la evidencia: ${insertError.message}`);
  }

  if (!registeredDeliveryId) throw new Error("No se pudo confirmar la evidencia");

  const { data: pending } = await userClient
    .from("delivery_requirements")
    .select("id")
    .eq("delivery_id", delivery.id)
    .eq("applicable", true)
    .eq("status", "PENDING")
    .order("required", { ascending: false })
    .order("display_order", { ascending: true })
    .limit(1);

  return {
    evidenceId,
    deliveryId: registeredDeliveryId,
    storageKey,
    mimeType,
    sizeBytes: bytes.byteLength,
    nextRequirementId: pending?.[0]?.id ?? null,
  };
}
