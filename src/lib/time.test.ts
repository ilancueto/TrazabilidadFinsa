import { describe, expect, it } from "vitest";
import { formatDueLabel, isOverdue, isValidYmd, parseDueInput, toDueInputValue } from "@/lib/time";

describe("due dates", () => {
  it("interpreta la hora de Argentina", () => {
    const iso = parseDueInput("2026-08-14T16:00");
    expect(iso).toBe("2026-08-14T19:00:00.000Z");
    expect(toDueInputValue(iso)).toBe("2026-08-14T16:00");
  });

  it("marca vencida si ya pasó y no está cerrada", () => {
    expect(isOverdue("2020-01-01T00:00:00.000Z", "IN_PICKING")).toBe(true);
    expect(isOverdue("2020-01-01T00:00:00.000Z", "CLOSED")).toBe(false);
    expect(formatDueLabel("2020-01-01T00:00:00.000Z", "PUBLISHED")).toBe("Vencida");
  });

  it("rechaza fechas de calendario inexistentes", () => {
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(parseDueInput("2026-02-30T12:00")).toBeNull();
  });
});
