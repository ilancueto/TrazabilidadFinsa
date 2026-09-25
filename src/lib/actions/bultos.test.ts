import { describe, expect, it } from "vitest";
import { validateBultoInput } from "@/lib/actions/bultos-validation";

describe("validateBultoInput", () => {
  it("acepta código válido y lista de entregas", () => {
    expect(validateBultoInput("BULTO-1", ["id-1", "id-2"])).toBeNull();
    expect(validateBultoInput("  B-806042590  ", ["id-1"])).toBeNull();
  });

  it("rechaza código vacío o demasiado corto", () => {
    expect(validateBultoInput("", ["id-1"])).toBe(
      "El código de bulto debe tener al menos 2 caracteres (ej: BULTO-1, B-01)",
    );
    expect(validateBultoInput("a", ["id-1"])).toBe(
      "El código de bulto debe tener al menos 2 caracteres (ej: BULTO-1, B-01)",
    );
    expect(validateBultoInput("   ", ["id-1"])).toBe(
      "El código de bulto debe tener al menos 2 caracteres (ej: BULTO-1, B-01)",
    );
  });

  it("rechaza lista de entregas vacía", () => {
    expect(validateBultoInput("BULTO-1", [])).toBe(
      "Debes seleccionar al menos una entrega para armar el bulto",
    );
  });
});
