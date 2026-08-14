import { z } from "zod";
import {
  DELIVERY_MODALITIES,
  DELIVERY_PRIORITIES,
  REQUIREMENT_TYPE_CODES,
} from "@/lib/types";

export const requirementDraftSchema = z.object({
  typeCode: z.enum(REQUIREMENT_TYPE_CODES),
  typeId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  required: z.boolean(),
  applicable: z.boolean(),
  displayOrder: z.number().int().min(0).max(1000),
});

export const deliveryInputSchema = z.object({
  id: z.string().uuid().optional(),
  number: z
    .string()
    .trim()
    .min(3, "El número de entrega es obligatorio")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "Usá sólo letras, números, punto, guion o guion bajo"),
  modality: z.enum(DELIVERY_MODALITIES),
  destination: z.string().trim().min(2, "El destino / cliente es obligatorio").max(160),
  packages: z.coerce.number().int().min(1, "Los bultos deben ser mayores a 0").max(9999),
  priority: z.enum(DELIVERY_PRIORITIES),
  assigneeId: z.string().uuid().nullable(),
  observations: z.string().trim().max(2000).optional().nullable(),
  requirements: z.array(requirementDraftSchema).min(1, "La entrega necesita requisitos"),
  intent: z.enum(["draft", "publish"]),
});

export type DeliveryInput = z.infer<typeof deliveryInputSchema>;

export const observationSchema = z.object({
  deliveryId: z.string().uuid(),
  text: z.string().trim().min(2).max(2000),
});

export const voidEvidenceSchema = z.object({
  evidenceId: z.string().uuid(),
  reason: z.string().trim().min(2).max(400),
});

export const reopenSchema = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().trim().min(3).max(400),
});

export function assertPublishableRequirements(
  requirements: DeliveryInput["requirements"],
): string | null {
  const applicableRequired = requirements.filter((item) => item.applicable && item.required);
  if (applicableRequired.length === 0) {
    return "Para publicar hace falta al menos un requisito obligatorio aplicable";
  }
  return null;
}
