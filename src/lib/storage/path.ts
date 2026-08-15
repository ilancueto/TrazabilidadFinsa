import { sanitizeFilename } from "@/lib/utils";
import { pad2, toArgentinaParts } from "@/lib/time";

export function buildEvidenceKey(input: {
  deliveredAt?: Date;
  deliveryNumber: string;
  requirementCode: string;
  filename: string;
  evidenceId: string;
}): string {
  const date = input.deliveredAt ?? new Date();
  const parts = toArgentinaParts(date);
  const year = String(parts.year);
  const month = pad2(parts.month);
  const safeName = sanitizeFilename(input.filename);
  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : ".jpg";
  return `${year}/${month}/${input.deliveryNumber}/${input.requirementCode}/${input.evidenceId}${ext}`;
}

export function voidedKey(key: string): string {
  if (key.startsWith("voided/")) return key;
  return `voided/${key}`;
}

export function thumbnailKey(key: string): string {
  const dot = key.lastIndexOf(".");
  return `${dot > key.lastIndexOf("/") ? key.slice(0, dot) : key}-thumb.webp`;
}
