import { describe, expect, it } from "vitest";
import { computeProgress, isReadyBlocked } from "@/lib/deliveries/progress";

describe("progress", () => {
  it("ignora no aplicables y cuenta críticos pendientes", () => {
    const progress = computeProgress([
      { applicable: true, required: true, status: "COMPLETE", label: "Remito" },
      { applicable: true, required: true, status: "PENDING", label: "Etiquetas" },
      { applicable: false, required: true, status: "PENDING", label: "Packing" },
    ]);
    expect(progress.complete).toBe(1);
    expect(progress.total).toBe(2);
    expect(progress.pendingRequired).toBe(1);
    expect(progress.pendingCriticalLabels).toEqual(["Etiquetas"]);
    expect(isReadyBlocked(progress)).toBe(true);
  });
});
