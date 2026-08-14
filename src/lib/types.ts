export const USER_ROLES = ["ADMIN", "PICKING"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DELIVERY_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "IN_PICKING",
  "READY",
  "CLOSED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_MODALITIES = ["ANDREANI", "CUSTOMER_PICKUP"] as const;
export type DeliveryModality = (typeof DELIVERY_MODALITIES)[number];

export const DELIVERY_PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const;
export type DeliveryPriority = (typeof DELIVERY_PRIORITIES)[number];

export const REQUIREMENT_STATUSES = ["PENDING", "COMPLETE"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "CREATED",
  "PUBLISHED",
  "EDITED",
  "ASSIGNED",
  "PICKING_STARTED",
  "EVIDENCE_UPLOADED",
  "EVIDENCE_VOIDED",
  "OBSERVATION_ADDED",
  "OBSERVATION_RESOLVED",
  "READY",
  "CLOSED",
  "REOPENED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const REQUIREMENT_TYPE_CODES = [
  "REMITO",
  "ETIQUETAS",
  "TRIPLICADO",
  "PACKING_LIST",
  "BULTOS",
  "EVIDENCIA_FINAL",
] as const;
export type RequirementTypeCode = (typeof REQUIREMENT_TYPE_CODES)[number];

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type RequirementType = {
  id: string;
  code: RequirementTypeCode;
  label: string;
  description: string | null;
};

export type Delivery = {
  id: string;
  number: string;
  modality: DeliveryModality;
  destination: string;
  packages: number;
  priority: DeliveryPriority;
  status: DeliveryStatus;
  assignee_id: string | null;
  created_by: string;
  observations: string | null;
  has_open_observation: boolean;
  published_at: string | null;
  ready_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryRequirement = {
  id: string;
  delivery_id: string;
  requirement_type_id: string;
  label: string;
  required: boolean;
  applicable: boolean;
  status: RequirementStatus;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Evidence = {
  id: string;
  requirement_id: string;
  provider: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  checksum: string | null;
  comment: string | null;
  uploader_id: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
};

export type AuditEvent = {
  id: string;
  delivery_id: string;
  actor_id: string | null;
  action: AuditAction;
  metadata: Record<string, unknown>;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type RequirementDraft = {
  typeCode: RequirementTypeCode;
  typeId: string;
  label: string;
  required: boolean;
  applicable: boolean;
  displayOrder: number;
};

export type DeliveryProgress = {
  complete: number;
  total: number;
  pendingRequired: number;
  pendingCriticalLabels: string[];
};

export type DeliveryListItem = Delivery & {
  assignee_name: string | null;
  progress: DeliveryProgress;
};

export type DeliveryDetail = Delivery & {
  assignee: Profile | null;
  creator: Profile | null;
  closer: Profile | null;
  requirements: Array<
    DeliveryRequirement & {
      type_code: RequirementTypeCode;
      evidences: Array<
        Evidence & {
          uploader_name: string | null;
        }
      >;
    }
  >;
  audit: Array<
    AuditEvent & {
      actor_name: string | null;
    }
  >;
  progress: DeliveryProgress;
};
