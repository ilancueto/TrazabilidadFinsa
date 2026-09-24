import { describe, expect, it } from "vitest";
import { normalizeCorporateName, resolveClientFromSap } from "./matching";
import type { Client, ClientAlias } from "@/lib/types";

describe("Client matching logic", () => {
  const clients: Client[] = [
    { id: "c1", name: "Roque Mocciola", active: true, created_at: "", updated_at: "" },
    { id: "c2", name: "YPF", active: true, created_at: "", updated_at: "" },
    { id: "c3", name: "Halliburton Añelo", active: true, created_at: "", updated_at: "" },
    { id: "c4", name: "Pecom", active: true, created_at: "", updated_at: "" },
  ];

  const aliases: ClientAlias[] = [
    {
      id: "a1",
      client_id: "c4",
      alias: "SERVICIOS PETROLEROS DEL COMAHUE S.A.",
      created_at: "",
    },
  ];

  it("normalizes corporate names properly", () => {
    expect(normalizeCorporateName("EMPRESA DE CONSTRUCCIÓN ROQUE MOCCIOLA S.A.")).toBe(
      "empresa de construccion roque mocciola s a",
    );
  });

  it("resolves user specific example: Roque Mocciola inside Empresa de Construcción Roque Mocciola", () => {
    const res = resolveClientFromSap("Empresa de Construcción Roque Mocciola", clients, aliases);
    expect(res.client).not.toBeNull();
    expect(res.client?.id).toBe("c1");
    expect(res.client?.name).toBe("Roque Mocciola");
    expect(res.matchType).toBe("fuzzy");
  });

  it("resolves exact matches", () => {
    const res = resolveClientFromSap("Roque Mocciola", clients, aliases);
    expect(res.client?.id).toBe("c1");
    expect(res.matchType).toBe("exact");
  });

  it("resolves corporate suffix match like YPF S.A.", () => {
    const res = resolveClientFromSap("YPF S.A.", clients, aliases);
    expect(res.client?.id).toBe("c2");
    expect(res.matchType).toBe("exact");
  });

  it("resolves explicit learned alias rule", () => {
    const res = resolveClientFromSap("SERVICIOS PETROLEROS DEL COMAHUE S.A.", clients, aliases);
    expect(res.client?.id).toBe("c4");
    expect(res.client?.name).toBe("Pecom");
    expect(res.matchType).toBe("alias");
  });

  it("returns none for completely unknown client", () => {
    const res = resolveClientFromSap("DESCONOCIDO RANDOM SRL", clients, aliases);
    expect(res.client).toBeNull();
    expect(res.matchType).toBe("none");
  });
});
