import { describe, expect, it } from "vitest";
import { computeProgress, isCloseBlocked, isReadyBlocked, nextPendingRequirement } from "@/lib/deliveries/progress";

describe("progress", () => {
  it("ignora no aplicables y cuenta críticos pendientes", () => {
    const progress = computeProgress([
      { applicable: true, required: true, status: "COMPLETE", label: "Remito" },
      { applicable: true, required: true, status: "PENDING", label: "Triplicado" },
      { applicable: false, required: true, status: "PENDING", label: "Packing" },
    ]);
    expect(progress.complete).toBe(1);
    expect(progress.total).toBe(2);
    expect(progress.pendingRequired).toBe(1);
    expect(progress.pendingCriticalLabels).toEqual(["Triplicado"]);
    expect(isReadyBlocked(progress)).toBe(true);
  });

  it("las etiquetas de despacho no traban marcar lista", () => {
    const progress = computeProgress([
      { applicable: true, required: true, status: "COMPLETE", label: "Remito", type_code: "REMITO" },
      { applicable: true, required: true, status: "PENDING", label: "Etiquetas Andreani", type_code: "ETIQUETAS" },
      { applicable: true, required: true, status: "PENDING", label: "Etiquetas Tecpetrol", type_code: "ETIQUETAS_TECPETROL" },
    ]);
    expect(progress.pendingRequired).toBe(0);
    expect(isReadyBlocked(progress)).toBe(false);
    expect(progress.pendingDispatch).toBe(2);
    expect(isCloseBlocked(progress)).toBe(true);
  });

  it("elige el próximo obligatorio de piso, no la etiqueta", () => {
    const next = nextPendingRequirement([
      { applicable: true, required: true, status: "COMPLETE", label: "Remito", type_code: "REMITO" },
      { applicable: true, required: true, status: "PENDING", label: "Etiquetas Andreani", type_code: "ETIQUETAS" },
      { applicable: true, required: true, status: "PENDING", label: "Bultos", type_code: "BULTOS" },
    ]);
    expect(next?.label).toBe("Bultos");
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
