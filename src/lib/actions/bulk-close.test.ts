import { describe, expect, it } from "vitest";
import { BULK_CLOSE_CONFIRMATION, validateBulkCloseInput } from "@/lib/actions/bulk-close-validation";

describe("cierre excepcional", () => {
  it("acepta motivo válido y frase exacta", () => {
    expect(validateBulkCloseInput("Cierre operativo", BULK_CLOSE_CONFIRMATION)).toBeNull();
  });

  it("rechaza motivo demasiado corto", () => {
    expect(validateBulkCloseInput("abc", BULK_CLOSE_CONFIRMATION)).toBe(
      "Escribí un motivo de al menos 5 caracteres",
    );
  });

  it("exige la frase exacta de confirmación", () => {
    expect(validateBulkCloseInput("Motivo válido", "cerrar todas")).toBe(
      "Escribí CERRAR TODAS para confirmar",
    );
    expect(validateBulkCloseInput("Motivo válido", "CERRAR TODO")).toBe(
      "Escribí CERRAR TODAS para confirmar",
    );
  });

  it("tolera espacios accidentales alrededor del input", () => {
    expect(validateBulkCloseInput("  Motivo válido  ", "  CERRAR TODAS  ")).toBeNull();
  });
});
