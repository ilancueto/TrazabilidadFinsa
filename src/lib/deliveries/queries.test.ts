import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { listDeliveries } from "@/lib/deliveries/queries";

function makeQuery() {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "is", "neq", "eq", "in", "ilike", "or"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return query as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<{ data: unknown[]; error: null }>;
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
