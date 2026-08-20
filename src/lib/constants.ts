import type { DeliveryModality, DeliveryPriority, DeliveryStatus } from "@/lib/types";

export const APP_NAME = "Trazabilidad de Entregas";
export const APP_SHORT_NAME = "Entregas";

export const ROLE_LABEL: Record<"ADMIN" | "PICKING" | "SUPERVISOR", string> = {
  ADMIN: "Administración",
  PICKING: "Picking",
  SUPERVISOR: "Supervisor",
};

export const AUDIT_LABEL: Record<string, string> = {
  CREATED: "Entrega creada",
  PUBLISHED: "Publicada",
  EDITED: "Datos editados",
  ASSIGNED: "Responsable asignado",
  PICKING_STARTED: "Picking iniciado",
  EVIDENCE_UPLOADED: "Foto cargada",
  EVIDENCE_VOIDED: "Foto anulada",
  OBSERVATION_ADDED: "Observación agregada",
  OBSERVATION_RESOLVED: "Observación resuelta",
  READY: "Marcada como lista",
  CLOSED: "Entrega cerrada",
  REOPENED: "Entrega reabierta",
  RETURNED: "Devuelta a Picking",
  CLAIMED: "La tomó Picking",
  REASSIGNED: "Responsable cambiado",
  EVIDENCE_REVIEWED: "Foto revisada",
  ARCHIVED: "Entrega archivada",
};

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

export const REQUIREMENT_LABEL: Record<string, string> = {
  REMITO: "Remito",
  ETIQUETAS: "Etiquetas Andreani",
  ETIQUETAS_TECPETROL: "Etiquetas Tecpetrol",
  ETIQUETAS_PLUSPETROL: "Etiquetas Pluspetrol",
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
