import type {
  DeliveryModality,
  DeliveryPriority,
  DeliveryStatus,
  RequirementTypeCode,
} from "@/lib/types";

export const APP_NAME = "Trazabilidad de Entregas";
export const APP_SHORT_NAME = "Trazas";

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  IN_PICKING: "En Picking",
  READY: "Lista",
  CLOSED: "Cerrada",
};

export const MODALITY_LABEL: Record<DeliveryModality, string> = {
  ANDREANI: "Andreani",
  CUSTOMER_PICKUP: "Retira cliente",
};

export const PRIORITY_LABEL: Record<DeliveryPriority, string> = {
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const REQUIREMENT_LABEL: Record<RequirementTypeCode, string> = {
  REMITO: "Remito",
  ETIQUETAS: "Etiquetas",
  TRIPLICADO: "Triplicado",
  PACKING_LIST: "Packing List",
  BULTOS: "Bultos / Pallet",
  EVIDENCIA_FINAL: "Evidencia final",
};

export const ALLOWED_EVIDENCE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
export const COMPRESS_MAX_EDGE = 1800;
export const COMPRESS_QUALITY = 0.82;

export const LOCAL_DEMO_USERS = [
  {
    email: "ilan@cat.local",
    password: "CatLocal123!",
    name: "Ilan Cueto",
    role: "ADMIN" as const,
  },
  {
    email: "emilio@cat.local",
    password: "CatLocal123!",
    name: "Emilio Chejolan",
    role: "PICKING" as const,
  },
] as const;
