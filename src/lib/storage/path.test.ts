import { describe, expect, it } from "vitest";
import { buildEvidenceKey, voidedKey } from "@/lib/storage/path";

describe("storage path", () => {
  it("arma año/mes/entrega/requisito/id", () => {
    const key = buildEvidenceKey({
      deliveredAt: new Date("2026-08-13T12:00:00Z"),
      deliveryNumber: "806042590",
      requirementCode: "REMITO",
      filename: "Foto Remito.JPG",
      evidenceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(key).toBe(
      "2026/08/806042590/REMITO/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg",
    );
  });

  it("void prefix no se duplica", () => {
    expect(voidedKey("2026/08/a/REMITO/x.jpg")).toBe("voided/2026/08/a/REMITO/x.jpg");
    expect(voidedKey("voided/2026/08/a/REMITO/x.jpg")).toBe("voided/2026/08/a/REMITO/x.jpg");
  });
});
