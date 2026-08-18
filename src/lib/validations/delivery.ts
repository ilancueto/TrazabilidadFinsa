import { z } from "zod";
import { DELIVERY_MODALITIES, DELIVERY_PRIORITIES } from "@/lib/types";

export const requirementTypeCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/, "Código: MAYÚSCULAS, números o _");

export const requirementDraftSchema = z.object({
  typeCode: requirementTypeCodeSchema,
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
  clientId: z.string().uuid().optional().nullable(),
  palletCode: z.string().trim().max(80).optional().nullable(),
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

export const returnToPickingSchema = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().trim().min(3, "Escribí el motivo").max(400),
});

export const claimDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
});

export const reassignDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
});

export const deleteDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
  confirmNumber: z.string().trim().min(3).max(40),
});

export const requirementTypeInputSchema = z.object({
  id: z.string().uuid().optional(),
  code: requirementTypeCodeSchema,
  label: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  description: z.string().trim().max(240).optional().nullable(),
  guidance: z.string().trim().max(240).optional().nullable(),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá el nombre").max(80),
  email: z.string().trim().email("Ingresá un email válido").max(160),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres").max(72),
  role: z.enum(["ADMIN", "PICKING", "SUPERVISOR"]),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "PICKING", "SUPERVISOR"]),
});

export const resetUserPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres").max(72),
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmEmail: z.string().trim().email("Ingresá el email para confirmar"),
});

export const templateSaveSchema = z.object({
  templateId: z.string().uuid(),
  requirements: z.array(
    z.object({
      typeId: z.string().uuid(),
      included: z.boolean(),
      required: z.boolean(),
      applicable: z.boolean(),
      displayOrder: z.number().int().min(0).max(1000),
    }),
  ),
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
