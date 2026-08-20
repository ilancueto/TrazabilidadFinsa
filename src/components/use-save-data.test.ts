import { describe, expect, it } from "vitest";
import { networkWantsSaveDataFrom } from "@/components/use-save-data";

describe("networkWantsSaveDataFrom", () => {
  it("asume red mala si el navegador no informa conexión (iPhone)", () => {
    expect(networkWantsSaveDataFrom(undefined)).toBe(true);
  });

  it("ahorra con saveData o 2G/3G", () => {
    expect(networkWantsSaveDataFrom({ saveData: true, effectiveType: "4g" })).toBe(true);
    expect(networkWantsSaveDataFrom({ effectiveType: "3g" })).toBe(true);
    expect(networkWantsSaveDataFrom({ effectiveType: "2g" })).toBe(true);
  });

  it("no ahorra en 4G sin saveData", () => {
    expect(networkWantsSaveDataFrom({ saveData: false, effectiveType: "4g" })).toBe(false);
  });
});
