import { describe, expect, it } from "vitest";
import {
  assertPublishableRequirements,
  deliveryInputSchema,
} from "@/lib/validations/delivery";

const validReq = {
  typeCode: "REMITO" as const,
  typeId: "a1000000-0000-4000-8000-000000000001",
  label: "Remito",
  required: true,
  applicable: true,
  displayOrder: 10,
};

describe("delivery validation", () => {
  it("exige número, destino y bultos > 0", () => {
    const result = deliveryInputSchema.safeParse({
      number: "80",
      modality: "DESPACHO",
      carrier: "ANDREANI",
      destination: "X",
      packages: 0,
      priority: "NORMAL",
      assigneeId: null,
      requirements: [validReq],
      intent: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("acepta un alta válida", () => {
    const result = deliveryInputSchema.safeParse({
      number: "806042590",
      modality: "DESPACHO",
      carrier: "ANDREANI",
      destination: "Cliente Demo",
      packages: 2,
      priority: "URGENT",
      assigneeId: null,
      requirements: [validReq],
      intent: "publish",
    });
    expect(result.success).toBe(true);
  });

  it("acepta un código de requisito nuevo", () => {
    const result = deliveryInputSchema.safeParse({
      number: "806042590",
      modality: "DESPACHO",
      carrier: "ANDREANI",
      destination: "Cliente Demo",
      packages: 1,
      priority: "NORMAL",
      assigneeId: null,
      requirements: [{ ...validReq, typeCode: "FOTO_BALANZA" }],
      intent: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza DESPACHO sin transportista", () => {
    const result = deliveryInputSchema.safeParse({
      number: "806042590",
      modality: "DESPACHO",
      destination: "Cliente Demo",
      packages: 1,
      priority: "NORMAL",
      assigneeId: null,
      requirements: [validReq],
      intent: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza CUSTOMER_PICKUP con transportista", () => {
    const result = deliveryInputSchema.safeParse({
      number: "806042590",
      modality: "CUSTOMER_PICKUP",
      carrier: "ANDREANI",
      destination: "Cliente Demo",
      packages: 1,
      priority: "NORMAL",
      assigneeId: null,
      requirements: [validReq],
      intent: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("acepta CUSTOMER_PICKUP sin transportista", () => {
    const result = deliveryInputSchema.safeParse({
      number: "806042590",
      modality: "CUSTOMER_PICKUP",
      destination: "Cliente Demo",
      packages: 1,
      priority: "NORMAL",
      assigneeId: null,
      requirements: [validReq],
      intent: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("bloquea publicar sin obligatorios aplicables", () => {
    expect(
      assertPublishableRequirements([
        { ...validReq, applicable: false },
        { ...validReq, typeCode: "PACKING_LIST", required: false, applicable: true },
      ]),
    ).toMatch(/obligatorio/);
  });
});
