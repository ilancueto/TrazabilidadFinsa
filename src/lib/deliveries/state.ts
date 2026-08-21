import type { DeliveryStatus, UserRole } from "@/lib/types";

/**
 * Transiciones explícitas de `transition_delivery` y `save_delivery`.
 * `PUBLISHED → IN_PICKING` no está aquí: la dispara `register_evidence`.
 */
const TRANSITIONS: Record<DeliveryStatus, Partial<Record<DeliveryStatus, UserRole[]>>> = {
  DRAFT: { PUBLISHED: ["ADMIN"] },
  PUBLISHED: { READY: ["ADMIN", "PICKING"], DRAFT: ["ADMIN"] },
  IN_PICKING: { READY: ["ADMIN", "PICKING"] },
  READY: { CLOSED: ["ADMIN"], IN_PICKING: ["ADMIN"] },
  CLOSED: { IN_PICKING: ["ADMIN"] },
};

export function canTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  role: UserRole,
): boolean {
  if (from === to) return true;
  const allowedRoles = TRANSITIONS[from]?.[to];
  return Boolean(allowedRoles?.includes(role));
}

export function assertTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  role: UserRole,
): void {
  if (!canTransition(from, to, role)) {
    throw new Error(`Transición no permitida: ${from} → ${to} (${role})`);
  }
}

export function nextStatusAfterFirstEvidence(current: DeliveryStatus): DeliveryStatus {
  return current === "PUBLISHED" ? "IN_PICKING" : current;
}

export function statusAfterIncompleteReady(current: DeliveryStatus): DeliveryStatus {
  return current === "READY" ? "IN_PICKING" : current;
}
