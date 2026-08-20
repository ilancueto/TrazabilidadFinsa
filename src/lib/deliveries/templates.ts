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
    { typeCode: "TRIPLICADO", required: true, applicable: true, displayOrder: 30 },
    { typeCode: "PACKING_LIST", required: false, applicable: true, displayOrder: 40 },
    { typeCode: "BULTOS", required: true, applicable: true, displayOrder: 50 },
    { typeCode: "EVIDENCIA_FINAL", required: true, applicable: true, displayOrder: 60 },
    { typeCode: "ETIQUETAS", required: true, applicable: true, displayOrder: 70 },
    { typeCode: "ETIQUETAS_TECPETROL", required: true, applicable: false, displayOrder: 80 },
    { typeCode: "ETIQUETAS_PLUSPETROL", required: true, applicable: false, displayOrder: 90 },
  ],
  CUSTOMER_PICKUP: [
    { typeCode: "REMITO", required: true, applicable: true, displayOrder: 10 },
    { typeCode: "TRIPLICADO", required: true, applicable: true, displayOrder: 20 },
    { typeCode: "PACKING_LIST", required: false, applicable: true, displayOrder: 30 },
    { typeCode: "BULTOS", required: true, applicable: true, displayOrder: 40 },
    { typeCode: "EVIDENCIA_FINAL", required: true, applicable: true, displayOrder: 50 },
    { typeCode: "ETIQUETAS_TECPETROL", required: true, applicable: false, displayOrder: 80 },
    { typeCode: "ETIQUETAS_PLUSPETROL", required: true, applicable: false, displayOrder: 90 },
  ],
};

export function buildRequirementDrafts(
  modality: DeliveryModality,
  typeIds: Record<string, string>,
  labels: Record<string, string>,
  specs: TemplateRequirementSpec[] = TEMPLATE_SPECS[modality],
): RequirementDraft[] {
  return specs
    .filter((spec) => typeIds[spec.typeCode])
    .map((spec) => ({
      typeCode: spec.typeCode,
      typeId: typeIds[spec.typeCode],
      label: labels[spec.typeCode] || spec.typeCode,
      required: spec.required,
      applicable: spec.applicable,
      displayOrder: spec.displayOrder,
    }));
}

export function mergeDraftsWithTemplate(
  current: RequirementDraft[],
  template: RequirementDraft[],
): RequirementDraft[] {
  const have = new Set(current.map((item) => item.typeId));
  const extras = template
    .filter((item) => !have.has(item.typeId))
    .map((item) => ({ ...item, applicable: false, required: false }));
  return [...current, ...extras].sort((a, b) => a.displayOrder - b.displayOrder);
}
