import { describe, expect, it } from "vitest";
import { computeProgress, isReadyBlocked, nextPendingRequirement } from "@/lib/deliveries/progress";

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

  it("elige el próximo obligatorio pendiente", () => {
    const next = nextPendingRequirement([
      { applicable: true, required: true, status: "COMPLETE", label: "Remito" },
      { applicable: true, required: true, status: "PENDING", label: "Etiquetas" },
      { applicable: true, required: false, status: "PENDING", label: "Packing" },
    ]);
    expect(next?.label).toBe("Etiquetas");
  });

  it("cuenta foto activa aunque el status en DB siga PENDING", () => {
    const progress = computeProgress([
      {
        applicable: true,
        required: true,
        status: "PENDING",
        label: "Remito",
        evidences: [{ voided_at: null }],
      },
    ]);
    expect(progress.complete).toBe(1);
    expect(progress.pendingRequired).toBe(0);
  });
});
