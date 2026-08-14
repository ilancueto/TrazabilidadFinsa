import type { DeliveryModality, RequirementDraft, RequirementTypeCode } from "@/lib/types";

export type TemplateRequirementSpec = {
  typeCode: RequirementTypeCode;
  required: boolean;
  applicable: boolean;
  displayOrder: number;
};

export const TEMPLATE_SPECS: Record<DeliveryModality, TemplateRequirementSpec[]> = {
  ANDREANI: [
    { typeCode: "REMITO", required: true, applicable: true, displayOrder: 10 },
    { typeCode: "ETIQUETAS", required: true, applicable: true, displayOrder: 20 },
    { typeCode: "TRIPLICADO", required: true, applicable: true, displayOrder: 30 },
    { typeCode: "PACKING_LIST", required: false, applicable: true, displayOrder: 40 },
    { typeCode: "BULTOS", required: true, applicable: true, displayOrder: 50 },
    { typeCode: "EVIDENCIA_FINAL", required: true, applicable: true, displayOrder: 60 },
  ],
  CUSTOMER_PICKUP: [
    { typeCode: "REMITO", required: true, applicable: true, displayOrder: 10 },
    { typeCode: "TRIPLICADO", required: true, applicable: true, displayOrder: 20 },
    { typeCode: "PACKING_LIST", required: false, applicable: true, displayOrder: 30 },
    { typeCode: "BULTOS", required: true, applicable: true, displayOrder: 40 },
    { typeCode: "EVIDENCIA_FINAL", required: true, applicable: true, displayOrder: 50 },
  ],
};

export function buildRequirementDrafts(
  modality: DeliveryModality,
  typeIds: Record<RequirementTypeCode, string>,
  labels: Record<RequirementTypeCode, string>,
): RequirementDraft[] {
  return TEMPLATE_SPECS[modality].map((spec) => ({
    typeCode: spec.typeCode,
    typeId: typeIds[spec.typeCode],
    label: labels[spec.typeCode],
    required: spec.required,
    applicable: spec.applicable,
    displayOrder: spec.displayOrder,
  }));
}
