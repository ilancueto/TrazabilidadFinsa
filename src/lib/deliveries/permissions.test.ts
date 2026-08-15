import { describe, expect, it } from "vitest";
import {
  canClaimDelivery,
  canClose,
  canDeleteDelivery,
  canDownloadReport,
  canEditRequirements,
  canManageCatalog,
  canManageUsers,
  canMarkReady,
  canReassignDelivery,
  canReopen,
  canReturnToPicking,
  canUploadEvidence,
} from "@/lib/deliveries/permissions";

describe("permissions", () => {
  it("Picking no edita requisitos ni cierra", () => {
    expect(canEditRequirements("PICKING", "PUBLISHED")).toBe(false);
    expect(canClose("PICKING", "READY")).toBe(false);
    expect(canDownloadReport("PICKING")).toBe(false);
    expect(canDownloadReport("SUPERVISOR")).toBe(true);
    expect(canReopen("PICKING", "CLOSED")).toBe(false);
    expect(canDeleteDelivery("PICKING")).toBe(false);
    expect(canManageCatalog("PICKING")).toBe(false);
    expect(canManageUsers("PICKING")).toBe(false);
  });

  it("Admin puede borrar entregas y administrar usuarios", () => {
    expect(canDeleteDelivery("ADMIN")).toBe(true);
    expect(canManageCatalog("ADMIN")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
  });

  it("Admin cierra sólo desde READY y reabre CLOSED", () => {
    expect(canClose("ADMIN", "READY")).toBe(true);
    expect(canClose("ADMIN", "IN_PICKING")).toBe(false);
    expect(canReopen("ADMIN", "CLOSED")).toBe(true);
  });

  it("READY exige requisitos obligatorios completos", () => {
    expect(canMarkReady("PICKING", "IN_PICKING", 1)).toBe(false);
    expect(canMarkReady("PICKING", "IN_PICKING", 0)).toBe(true);
    expect(canMarkReady("PICKING", "DRAFT", 0)).toBe(false);
  });

  it("Admin devuelve sólo una entrega lista", () => {
    expect(canReturnToPicking("ADMIN", "READY")).toBe(true);
    expect(canReturnToPicking("ADMIN", "IN_PICKING")).toBe(false);
    expect(canReturnToPicking("PICKING", "READY")).toBe(false);
  });

  it("Picking puede tomar una entrega libre y Admin reasignar", () => {
    expect(canClaimDelivery("PICKING", "PUBLISHED", null, "u1")).toBe(true);
    expect(canClaimDelivery("PICKING", "PUBLISHED", "u1", "u1")).toBe(false);
    expect(canClaimDelivery("PICKING", "PUBLISHED", "u2", "u1")).toBe(false);
    expect(canClaimDelivery("PICKING", "READY", null, "u1")).toBe(false);
    expect(canReassignDelivery("ADMIN", "IN_PICKING")).toBe(true);
    expect(canReassignDelivery("PICKING", "IN_PICKING")).toBe(false);
  });

  it("no se suben evidencias en DRAFT o CLOSED", () => {
    expect(canUploadEvidence("PICKING", "PUBLISHED")).toBe(true);
    expect(canUploadEvidence("PICKING", "DRAFT")).toBe(false);
    expect(canUploadEvidence("ADMIN", "CLOSED")).toBe(false);
  });
});
