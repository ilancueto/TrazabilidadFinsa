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
  return role === "ADMIN";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canAccessPicking(role: UserRole): boolean {
  return role === "PICKING" || role === "ADMIN";
}

export function pickingStartedWarning(status: DeliveryStatus, hasEvidence: boolean): boolean {
  return status === "IN_PICKING" || status === "READY" || hasEvidence;
}
