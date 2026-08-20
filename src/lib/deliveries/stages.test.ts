import { describe, expect, it } from "vitest";
import { applyClientLabelRequirements, dispatchCodesForClient, parseReviewMarkup, requirementStage } from "@/lib/deliveries/stages";

describe("requirementStage", () => {
  it("trata las etiquetas de cliente y Andreani como despacho", () => {
    expect(requirementStage({ type_code: "ETIQUETAS" })).toBe("DISPATCH");
    expect(requirementStage({ type_code: "ETIQUETAS_TECPETROL" })).toBe("DISPATCH");
    expect(requirementStage({ type_code: "REMITO" })).toBe("FLOOR");
  });
});

describe("dispatchCodesForClient", () => {
  it("activa Tecpetrol y Pluspetrol por el nombre", () => {
    expect(dispatchCodesForClient("Tecpetrol Neuquén")).toEqual(["ETIQUETAS_TECPETROL"]);
    expect(dispatchCodesForClient("PLUSPETROL")).toEqual(["ETIQUETAS_PLUSPETROL"]);
    expect(dispatchCodesForClient("YPF")).toEqual([]);
  });
});

describe("applyClientLabelRequirements", () => {
  const drafts = [
    { typeCode: "REMITO", typeId: "1", label: "Remito", required: true, applicable: true, displayOrder: 10 },
    { typeCode: "ETIQUETAS_TECPETROL", typeId: "2", label: "Etiquetas Tecpetrol", required: true, applicable: false, displayOrder: 80 },
  ];

  it("prende la etiqueta si el cliente coincide", () => {
    const next = applyClientLabelRequirements(drafts, "Tecpetrol");
    expect(next[1]?.applicable).toBe(true);
    expect(next[1]?.required).toBe(true);
  });
});

describe("parseReviewMarkup", () => {
  it("acepta recuadros válidos", () => {
    expect(parseReviewMarkup({ boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }] })?.boxes).toHaveLength(1);
    expect(parseReviewMarkup({ boxes: [{ x: 0, y: 0, w: 0.01, h: 0.01 }] })).toBeNull();
  });
});
