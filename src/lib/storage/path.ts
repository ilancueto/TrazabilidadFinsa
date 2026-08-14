import { sanitizeFilename } from "@/lib/utils";

export function buildEvidenceKey(input: {
  deliveredAt?: Date;
  deliveryNumber: string;
  requirementCode: string;
  filename: string;
  evidenceId: string;
}): string {
  const date = input.deliveredAt ?? new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFilename(input.filename);
  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : ".jpg";
  return `${year}/${month}/${input.deliveryNumber}/${input.requirementCode}/${input.evidenceId}${ext}`;
}

export function voidedKey(key: string): string {
  if (key.startsWith("voided/")) return key;
  return `voided/${key}`;
}
