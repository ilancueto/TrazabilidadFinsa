import { describe, expect, it } from "vitest";
import { deliveryMatchesQuery, deliveryTextSearchOr, sanitizeDeliverySearch } from "@/lib/deliveries/search";

describe("sanitizeDeliverySearch", () => {
  it("recorta y saca comodines de PostgREST", () => {
    expect(sanitizeDeliverySearch("  042%  ")).toBe("042");
    expect(sanitizeDeliverySearch("neuquen, (norte)")).toBe("neuquen norte");
  });
});

describe("deliveryTextSearchOr", () => {
  it("busca por contiene en número, destino y pallet", () => {
    expect(deliveryTextSearchOr("356")).toBe(
      "number.ilike.%356%,destination.ilike.%356%,pallet_code.ilike.%356%",
    );
  });

  it("ignora búsquedas vacías", () => {
    expect(deliveryTextSearchOr("   ")).toBeNull();
  });
});

describe("deliveryMatchesQuery", () => {
  const row = {
    number: "806042356",
    destination: "Neuquén Norte",
    pallet_code: "P-12",
    client_name: "YPF",
    assignee_name: "Emilio",
  };

  it("matchea por últimos dígitos sin ir al servidor", () => {
    expect(deliveryMatchesQuery(row, "356")).toBe(true);
    expect(deliveryMatchesQuery(row, "ypf")).toBe(true);
    expect(deliveryMatchesQuery(row, "no-esta")).toBe(false);
  });
});
