import { describe, expect, it } from "vitest";
import {
  canClose,
  canDownloadReport,
  canEditRequirements,
  canMarkReady,
  canReopen,
  canUploadEvidence,
} from "@/lib/deliveries/permissions";

describe("permissions", () => {
  it("Picking no edita requisitos ni cierra", () => {
    expect(canEditRequirements("PICKING", "PUBLISHED")).toBe(false);
    expect(canClose("PICKING", "READY")).toBe(false);
    expect(canDownloadReport("PICKING")).toBe(false);
    expect(canReopen("PICKING", "CLOSED")).toBe(false);
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

  it("no se suben evidencias en DRAFT o CLOSED", () => {
    expect(canUploadEvidence("PICKING", "PUBLISHED")).toBe(true);
    expect(canUploadEvidence("PICKING", "DRAFT")).toBe(false);
    expect(canUploadEvidence("ADMIN", "CLOSED")).toBe(false);
  });
});
