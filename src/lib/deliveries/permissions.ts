import type { DeliveryStatus, UserRole } from "@/lib/types";
import type { RequirementStage } from "@/lib/deliveries/stages";

export function canCreateDelivery(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canSeeDrafts(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canEditMasterData(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status !== "CLOSED";
}

export function canEditRequirements(role: UserRole, status: DeliveryStatus): boolean {
  return canEditMasterData(role, status);
}

export function canPublish(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && (status === "DRAFT" || status === "PUBLISHED");
}

function canMutateEvidence(role: UserRole, status: DeliveryStatus): boolean {
  return (role === "ADMIN" || role === "PICKING") && status !== "DRAFT" && status !== "CLOSED";
}

/** FLOOR: PUBLISHED / IN_PICKING. No DRAFT, READY ni CLOSED. */
export function canUploadFloor(role: UserRole, status: DeliveryStatus): boolean {
  return canMutateEvidence(role, status) && status !== "READY";
}

/** DISPATCH: PUBLISHED / IN_PICKING / READY. No DRAFT ni CLOSED. */
export function canUploadDispatch(role: UserRole, status: DeliveryStatus): boolean {
  return canMutateEvidence(role, status);
}

export function canUploadEvidence(
  role: UserRole,
  status: DeliveryStatus,
  stage?: RequirementStage,
): boolean {
  if (stage === "DISPATCH") return canUploadDispatch(role, status);
  if (stage === "FLOOR") return canUploadFloor(role, status);
  return canMutateEvidence(role, status);
}

export function canVoidEvidence(role: UserRole, status: DeliveryStatus): boolean {
  return canMutateEvidence(role, status);
}

export function canAddObservation(role: UserRole, status: DeliveryStatus): boolean {
  return status !== "CLOSED" && (role === "ADMIN" || (role === "PICKING" && status !== "DRAFT"));
}

export function canResolveObservation(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status !== "CLOSED";
}

export function canMarkReady(
  role: UserRole,
  status: DeliveryStatus,
  pendingRequired: number,
): boolean {
  return (
    (role === "ADMIN" || role === "PICKING") &&
    (status === "IN_PICKING" || status === "PUBLISHED") &&
    pendingRequired === 0
  );
}

export type ClosePreconditions = {
  hasOpenObservation?: boolean;
  pendingDispatch?: number;
  pendingRequired?: number;
};

export function closeBlockReason(preconditions: ClosePreconditions): string | null {
  if (preconditions.hasOpenObservation) return "Resolvé la observación abierta antes de cerrar";
  if ((preconditions.pendingRequired ?? 0) > 0) return "Faltan fotos de bodega";
  if ((preconditions.pendingDispatch ?? 0) > 0) return "Falta etiqueta para cerrar";
  return null;
}

export function canClose(
  role: UserRole,
  status: DeliveryStatus,
  preconditions?: ClosePreconditions,
): boolean {
  if (role !== "ADMIN" || status !== "READY") return false;
  return closeBlockReason(preconditions ?? {}) === null;
}

export function canReopen(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status === "CLOSED";
}

export function canDownloadReport(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canReviewEvidence(role: UserRole, status?: DeliveryStatus): boolean {
  if (role !== "ADMIN") return false;
  if (status && status !== "READY") return false;
  return true;
}

export function canViewDayBoard(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canDeleteDelivery(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageCatalog(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canDuplicateDelivery(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canReturnToPicking(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status === "READY";
}

function isAssignableStatus(status: DeliveryStatus): boolean {
  return status !== "DRAFT" && status !== "CLOSED";
}

export function canClaimDelivery(
  role: UserRole,
  status: DeliveryStatus,
  assigneeId: string | null,
  userId: string,
): boolean {
  void userId;
  if (role !== "PICKING") return false;
  if (status !== "PUBLISHED" && status !== "IN_PICKING") return false;
  return assigneeId === null;
}

export function canReleaseDelivery(
  role: UserRole,
  status: DeliveryStatus,
  assigneeId: string | null,
  userId: string,
): boolean {
  if (!assigneeId) return false;
  if (role === "ADMIN") return isAssignableStatus(status);
  return role === "PICKING" && (status === "PUBLISHED" || status === "IN_PICKING") && assigneeId === userId;
}

export function canReassignDelivery(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && isAssignableStatus(status);
}

export function canBulkAssignPicker(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canBulkAssignPallet(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canAccessPicking(role: UserRole): boolean {
  return role === "PICKING" || role === "ADMIN";
}

export function pickingStartedWarning(status: DeliveryStatus, hasEvidence: boolean): boolean {
  return status === "IN_PICKING" || status === "READY" || hasEvidence;
}
