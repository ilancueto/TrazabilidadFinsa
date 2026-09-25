import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { getBultoSiblings, listDeliveries } from "@/lib/deliveries/queries";

function makeQuery(responseData: unknown = []) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "is", "neq", "eq", "in", "ilike", "or"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: responseData, error: null }).then(resolve);
  return query as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<{ data: unknown; error: null }>;
}

describe("listDeliveries modality filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["DESPACHO", "CUSTOMER_PICKUP"] as const)(
    "aplica modalidad %s en la consulta principal",
    async (modality) => {
      const query = makeQuery();
      mocks.createServerSupabase.mockResolvedValue({
        from: vi.fn(() => query),
      });

      await listDeliveries({ modality, limit: 10 });

      expect(query.eq).toHaveBeenCalledWith("modality", modality);
    },
  );

  it("no aplica filtro de modalidad cuando es ALL", async () => {
    const query = makeQuery();
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => query),
    });

    await listDeliveries({ modality: "ALL", limit: 10 });

    expect(query.eq).not.toHaveBeenCalledWith("modality", expect.anything());
  });
});

describe("getBultoSiblings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna arreglo vacío si no hay palletCode o es vacío", async () => {
    expect(await getBultoSiblings(null)).toEqual([]);
    expect(await getBultoSiblings("")).toEqual([]);
    expect(await getBultoSiblings("   ")).toEqual([]);
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("consulta y mapea entregas del mismo bulto con su estado y avance", async () => {
    const fakeRows = [
      {
        id: "del-1",
        number: "806001",
        destination: "RESISTENCIA",
        status: "IN_PICKING",
        client: { name: "Elio Rodriguez" },
        requirements: [
          { id: "req-1", required: true, applicable: true, status: "COMPLETED" },
          { id: "req-2", required: true, applicable: true, status: "PENDING" },
        ],
      },
      {
        id: "del-2",
        number: "806002",
        destination: "TUCUMAN",
        status: "READY",
        client: null,
        requirements: [
          { id: "req-3", required: true, applicable: true, status: "COMPLETED" },
        ],
      },
    ];

    const query = makeQuery(fakeRows);
    mocks.createServerSupabase.mockResolvedValue({
      from: vi.fn(() => query),
    });

    const result = await getBultoSiblings("BULTO-806001");

    expect(query.eq).toHaveBeenCalledWith("pallet_code", "BULTO-806001");
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      id: "del-1",
      number: "806001",
      destination: "RESISTENCIA",
      status: "IN_PICKING",
      client_name: "Elio Rodriguez",
      pendingRequired: 1,
      totalRequired: 2,
      isReady: false,
    });

    expect(result[1]).toEqual({
      id: "del-2",
      number: "806002",
      destination: "TUCUMAN",
      status: "READY",
      client_name: null,
      pendingRequired: 0,
      totalRequired: 1,
      isReady: true,
    });
  });
});
