import { describe, expect, it } from "vitest";
import { adminDeliveryPath, pickingDeliveryPath } from "@/lib/deliveries/paths";

describe("delivery paths", () => {
  it("usa el número visible de entrega", () => {
    expect(adminDeliveryPath("806065454")).toBe("/admin/deliveries/806065454");
    expect(adminDeliveryPath("806065454", "/edit")).toBe(
      "/admin/deliveries/806065454/edit",
    );
  });

  it("codifica números y requisitos para picking", () => {
    expect(pickingDeliveryPath("E2E 15", "req/1")).toBe(
      "/picking/E2E%2015/req%2F1",
    );
  });
});
