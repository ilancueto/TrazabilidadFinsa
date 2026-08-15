import type { DeliveryStatus, UserRole } from "@/lib/types";

export function canCreateDelivery(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canSeeDrafts(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canEditMasterData(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status !== "CLOSED";
}

export function canEditRequirements(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status !== "CLOSED";
}

export function canPublish(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && (status === "DRAFT" || status === "PUBLISHED");
}

export function canUploadEvidence(role: UserRole, status: DeliveryStatus): boolean {
  return (
    (role === "ADMIN" || role === "PICKING") &&
    status !== "DRAFT" &&
    status !== "CLOSED"
  );
}

export function canVoidEvidence(role: UserRole, status: DeliveryStatus): boolean {
  return canUploadEvidence(role, status);
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

export function canClose(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status === "READY";
}

export function canReopen(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status === "CLOSED";
}

export function canDownloadReport(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canReviewEvidence(role: UserRole): boolean {
  return role === "ADMIN";
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

export function canClaimDelivery(
  role: UserRole,
  status: DeliveryStatus,
  assigneeId: string | null,
  userId: string,
): boolean {
  if (role !== "PICKING" && role !== "ADMIN") return false;
  if (status === "DRAFT" || status === "CLOSED" || status === "READY") return false;
  if (role === "PICKING") return assigneeId === null;
  return assigneeId !== userId;
}

export function canReleaseDelivery(
  role: UserRole,
  status: DeliveryStatus,
  assigneeId: string | null,
  userId: string,
): boolean {
  if (status === "CLOSED" || status === "DRAFT") return false;
  if (role === "ADMIN") return Boolean(assigneeId);
  return role === "PICKING" && assigneeId === userId;
}

export function canReassignDelivery(role: UserRole, status: DeliveryStatus): boolean {
  return role === "ADMIN" && status !== "CLOSED" && status !== "DRAFT";
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
