import { describe, expect, it } from "vitest";
import { presentAuditEvent, semanticAuditAction } from "@/lib/audit/presentation";

const event = (action: string, metadata: Record<string, unknown> = {}) => ({ action, metadata });

describe("audit presentation", () => {
  it.each([
    ["ARCHIVED", event("EDITED", { kind: "ARCHIVED" })],
    ["CLAIMED", event("ASSIGNED", { kind: "CLAIMED" })],
    ["REASSIGNED", event("ASSIGNED", { kind: "REASSIGNED" })],
    ["RETURNED", event("OBSERVATION_ADDED", { kind: "RETURNED" })],
  ] as const)("normalizes %s historical fallback", (expected, input) => expect(semanticAuditAction(input)).toBe(expected));

  it("presents normal and exceptional closes", () => {
    expect(presentAuditEvent(event("CLOSED")).summary).toBeNull();
    expect(presentAuditEvent(event("CLOSED", { exceptional: true })).summary).toBe("Cierre excepcional");
  });

  it.each(["ACCEPTED", "REJECTED", "VOIDED"])("presents evidence decision %s", (decision) => {
    expect(presentAuditEvent(event("EVIDENCE_REVIEWED", { decision })).summary).toContain("Decisión de evidencia");
  });

  it("distinguishes returned evidence rejection and voiding without changing the public action", () => {
    expect(presentAuditEvent(event("RETURNED", { kind: "EVIDENCE_REJECTED" }))).toMatchObject({ action: "RETURNED", summary: "Devuelta a Picking por evidencia rechazada" });
    expect(presentAuditEvent(event("RETURNED", { kind: "EVIDENCE_VOIDED" }))).toMatchObject({ action: "RETURNED", summary: "Devuelta a Picking por evidencia anulada" });
  });

  it("uses only allowlisted reason fields and historical actors", () => {
    expect(presentAuditEvent(event("RETURNED", { reason: "motivo", unsafe: "no" })).summary).toBe("motivo");
    expect(presentAuditEvent({ action: "CREATED", metadata: {}, actor_name: null }).actor).toBe("Sistema");
    expect(presentAuditEvent({ action: "CREATED", metadata: {}, actor: { full_name: "Ana", deleted_at: "2026-01-01" } }).actor).toBe("Ana (eliminado)");
  });
});
