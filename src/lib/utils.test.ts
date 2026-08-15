import { describe, expect, it } from "vitest";
import { formatPackages } from "@/lib/utils";

describe("formatPackages", () => {
  it("usa singular para un bulto", () => {
    expect(formatPackages(1)).toBe("1 bulto");
  });

  it("usa plural para el resto", () => {
    expect(formatPackages(4)).toBe("4 bultos");
  });
});
