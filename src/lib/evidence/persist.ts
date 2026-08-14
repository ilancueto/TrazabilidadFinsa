import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canUploadEvidence } from "@/lib/deliveries/permissions";
import { nextStatusAfterFirstEvidence } from "@/lib/deliveries/state";
import { writeAudit } from "@/lib/audit/log";
import { getEvidenceStorage } from "@/lib/storage";
import { buildEvidenceKey } from "@/lib/storage/path";
import type { DeliveryStatus, RequirementTypeCode, UserRole } from "@/lib/types";
import { isUuid, sanitizeFilename } from "@/lib/utils";
import {
  PersistForbiddenError,
  PersistNotFoundError,
  PersistValidationError,
  assertUploadSize,
} from "@/lib/evidence/mime";
import { normalizeEvidenceBytes } from "@/lib/evidence/normalize";

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
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storage = getEvidenceStorage();

  await storage.upload({
    key: storageKey,
    bytes,
    mimeType,
  });

  const { error: insertError } = await userClient.from("evidences").insert({
    id: evidenceId,
    requirement_id: input.requirementId,
    provider: "SUPABASE",
    storage_key: storageKey,
    filename,
    mime_type: mimeType,
    size_bytes: bytes.byteLength,
    width: input.width && input.width > 0 ? input.width : null,
    height: input.height && input.height > 0 ? input.height : null,
    checksum,
    comment: input.comment?.trim() || null,
    uploader_id: input.actorId,
  });

  if (insertError) {
    try {
      await storage.void(storageKey);
    } catch {
      // El archivo queda huérfano; el insert fallido es el error que importa.
    }
    throw new Error(`No se pudo registrar la evidencia: ${insertError.message}`);
  }

  const nextStatus = nextStatusAfterFirstEvidence(status);
  if (nextStatus !== status) {
    const { error: statusError } = await userClient
      .from("deliveries")
      .update({ status: nextStatus })
      .eq("id", delivery.id);
    if (statusError) {
      throw new Error(`La foto se guardó, pero no se pudo actualizar el estado: ${statusError.message}`);
    }
    await writeAudit(userClient, {
      deliveryId: delivery.id,
      actorId: input.actorId,
      action: "PICKING_STARTED",
      before: { status },
      after: { status: nextStatus },
    });
  }

  await writeAudit(userClient, {
    deliveryId: delivery.id,
    actorId: input.actorId,
    action: "EVIDENCE_UPLOADED",
    metadata: {
      requirementId: input.requirementId,
      evidenceId,
      filename,
      mime: mimeType,
      size: bytes.byteLength,
      checksum,
    },
  });

  return {
    evidenceId,
    deliveryId: delivery.id,
    storageKey,
    mimeType,
    sizeBytes: bytes.byteLength,
  };
}
