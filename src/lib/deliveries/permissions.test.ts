import { describe, expect, it } from "vitest";
import {
  canBulkAssignPallet,
  canBulkAssignPicker,
  canClaimDelivery,
  canClose,
  canDeleteDelivery,
  canDownloadReport,
  canEditRequirements,
  canManageCatalog,
  canManageUsers,
  canMarkReady,
  canReassignDelivery,
  canReleaseDelivery,
  canReopen,
  canReturnToPicking,
  canReviewEvidence,
  canUploadDispatch,
  canUploadEvidence,
  canUploadFloor,
  closeBlockReason,
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

  it("cierre normal bloquea observación abierta y etiquetas pendientes", () => {
    expect(canClose("ADMIN", "READY", { hasOpenObservation: true })).toBe(false);
    expect(canClose("ADMIN", "READY", { pendingDispatch: 1 })).toBe(false);
    expect(canClose("ADMIN", "READY", { pendingRequired: 1 })).toBe(false);
    expect(canClose("ADMIN", "READY", { hasOpenObservation: false, pendingDispatch: 0 })).toBe(true);
    expect(closeBlockReason({ hasOpenObservation: true })).toMatch(/observación/);
    expect(closeBlockReason({ pendingDispatch: 1 })).toMatch(/etiqueta/);
  });

  it("READY exige requisitos obligatorios completos", () => {
    expect(canMarkReady("PICKING", "IN_PICKING", 1)).toBe(false);
    expect(canMarkReady("PICKING", "IN_PICKING", 0)).toBe(true);
    expect(canMarkReady("PICKING", "DRAFT", 0)).toBe(false);
    expect(canMarkReady("SUPERVISOR", "IN_PICKING", 0)).toBe(false);
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
    expect(canClaimDelivery("ADMIN", "PUBLISHED", null, "admin")).toBe(false);
    expect(canClaimDelivery("SUPERVISOR", "PUBLISHED", null, "s1")).toBe(false);
    expect(canReassignDelivery("ADMIN", "IN_PICKING")).toBe(true);
    expect(canReassignDelivery("ADMIN", "READY")).toBe(true);
    expect(canReassignDelivery("PICKING", "IN_PICKING")).toBe(false);
    expect(canReassignDelivery("SUPERVISOR", "IN_PICKING")).toBe(false);
  });

  it("Picking no suelta en READY; Admin sí", () => {
    expect(canReleaseDelivery("PICKING", "IN_PICKING", "u1", "u1")).toBe(true);
    expect(canReleaseDelivery("PICKING", "READY", "u1", "u1")).toBe(false);
    expect(canReleaseDelivery("PICKING", "PUBLISHED", "u1", "u1")).toBe(true);
    expect(canReleaseDelivery("ADMIN", "READY", "u1", "admin")).toBe(true);
    expect(canReleaseDelivery("ADMIN", "CLOSED", "u1", "admin")).toBe(false);
    expect(canReleaseDelivery("SUPERVISOR", "IN_PICKING", "u1", "s1")).toBe(false);
  });

  it("FLOOR no se carga en READY; DISPATCH sí", () => {
    expect(canUploadFloor("PICKING", "PUBLISHED")).toBe(true);
    expect(canUploadFloor("PICKING", "IN_PICKING")).toBe(true);
    expect(canUploadFloor("PICKING", "READY")).toBe(false);
    expect(canUploadFloor("PICKING", "DRAFT")).toBe(false);
    expect(canUploadDispatch("PICKING", "READY")).toBe(true);
    expect(canUploadDispatch("PICKING", "CLOSED")).toBe(false);
    expect(canUploadEvidence("PICKING", "READY", "FLOOR")).toBe(false);
    expect(canUploadEvidence("PICKING", "READY", "DISPATCH")).toBe(true);
    expect(canUploadEvidence("SUPERVISOR", "IN_PICKING", "FLOOR")).toBe(false);
  });

  it("no se suben evidencias en DRAFT o CLOSED", () => {
    expect(canUploadEvidence("PICKING", "PUBLISHED")).toBe(true);
    expect(canUploadEvidence("PICKING", "DRAFT")).toBe(false);
    expect(canUploadEvidence("ADMIN", "CLOSED")).toBe(false);
  });

  it("revisión de fotos es Admin en READY", () => {
    expect(canReviewEvidence("ADMIN")).toBe(true);
    expect(canReviewEvidence("ADMIN", "READY")).toBe(true);
    expect(canReviewEvidence("ADMIN", "IN_PICKING")).toBe(false);
    expect(canReviewEvidence("SUPERVISOR", "READY")).toBe(false);
    expect(canReviewEvidence("PICKING", "READY")).toBe(false);
  });

  it("asignación masiva: Supervisor picker sí, pallet no", () => {
    expect(canBulkAssignPicker("ADMIN")).toBe(true);
    expect(canBulkAssignPicker("SUPERVISOR")).toBe(true);
    expect(canBulkAssignPicker("PICKING")).toBe(false);
    expect(canBulkAssignPallet("ADMIN")).toBe(true);
    expect(canBulkAssignPallet("SUPERVISOR")).toBe(false);
  });
});
