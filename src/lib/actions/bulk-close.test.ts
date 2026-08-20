import { describe, expect, it } from "vitest";

const CONFIRMATION = "CERRAR TODAS";

function validConfirmation(value: string) {
  return value === CONFIRMATION;
}

describe("cierre excepcional", () => {
  it("exige la frase exacta de confirmación", () => {
    expect(validConfirmation("CERRAR TODAS")).toBe(true);
    expect(validConfirmation("cerrar todas")).toBe(false);
    expect(validConfirmation("CERRAR TODO")).toBe(false);
  });
});
