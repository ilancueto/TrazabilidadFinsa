import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkCreateDeliveriesAction } from "./bulk-import";

const { rpcMock, upsertMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/deliveries/queries", () => ({
  listRequirementTypes: vi.fn().mockResolvedValue([
    { id: "req-1", code: "REMITO", label: "Remito conformado", modality: null, active: true },
  ]),
  listCatalogTemplates: vi.fn().mockResolvedValue([]),
  templatesToDrafts: vi.fn().mockReturnValue({
    DESPACHO: [{ typeId: "req-1", label: "Remito conformado", required: true, applicable: true, displayOrder: 10 }],
    CUSTOMER_PICKUP: [],
  }),
}));

vi.mock("@/lib/validations/delivery", () => ({
  assertPublishableRequirements: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: upsertMock,
    }),
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/observability", () => ({
  logServerError: vi.fn(),
}));

describe("bulkCreateDeliveriesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error si no se envían entregas", async () => {
    const res = await bulkCreateDeliveriesAction([]);
    expect(res.success).toBe(false);
    expect(res.errors[0].error).toContain("No se proporcionaron entregas");
  });

  it("llama a save_delivery con p_carrier: 'ANDREANI' estricto en mayúsculas", async () => {
    rpcMock.mockResolvedValueOnce({ data: "deliv-123", error: null });

    const res = await bulkCreateDeliveriesAction([
      {
        number: "806195646",
        destination: "Neuquén",
        packages: 2,
        clientId: "client-abc",
      },
    ]);

    expect(res.success).toBe(true);
    expect(res.createdCount).toBe(1);
    expect(res.errorCount).toBe(0);
    expect(rpcMock).toHaveBeenCalledWith(
      "save_delivery",
      expect.objectContaining({
        p_number: "806195646",
        p_modality: "DESPACHO",
        p_carrier: "ANDREANI",
        p_packages: 2,
        p_client_id: "client-abc",
      }),
    );
  });

  it("captura errores de base de datos por número y los reporta", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const res = await bulkCreateDeliveriesAction([
      {
        number: "806195652",
        destination: "Añelo",
        packages: 1,
        clientId: null,
      },
    ]);

    expect(res.success).toBe(false);
    expect(res.createdCount).toBe(0);
    expect(res.errorCount).toBe(1);
    expect(res.errors[0]).toEqual({
      number: "806195652",
      error: "El número ya existe en el sistema",
    });
  });
});
