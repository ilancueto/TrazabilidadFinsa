import { describe, expect, it } from "vitest";
import { formatDateInput, isValidYmd, parseDateInput, todayYmdAR } from "@/lib/time";

describe("fechas operativas", () => {
  it("rechaza fechas de calendario inexistentes", () => {
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(isValidYmd("2026-02-30")).toBe(false);
  });

  it("calcula el día operativo en Argentina", () => {
    expect(todayYmdAR(new Date("2026-08-16T01:30:00.000Z"))).toBe("2026-08-15");
  });

  it("fuerza entrada y salida en formato día/mes/año", () => {
    expect(formatDateInput("2026-08-15")).toBe("15/08/2026");
    expect(parseDateInput("15/08/2026")).toBe("2026-08-15");
    expect(parseDateInput("31/02/2026")).toBeNull();
  });
});
