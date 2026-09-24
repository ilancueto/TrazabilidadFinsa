import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/request-user", () => ({
  getRequestUser: vi.fn(),
  userScopedClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  TECHNICAL_API_OPERATIONS: {
    evidenceFile: { operation: "evidence.file", route: "/api/evidence/[id]/file" },
  },
  withTechnicalApiMetric: vi.fn((_req, _op, fn) => fn()),
}));

vi.mock("@/lib/storage", () => ({
  getEvidenceStorageForProvider: vi.fn(),
}));

import { GET } from "@/lib/../app/api/evidence/[id]/file/route";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEvidenceStorageForProvider } from "@/lib/storage";

describe("GET /api/evidence/[id]/file dual-read", () => {
  const mockStorageSupabase = {
    getAuthorizedUrl: vi.fn().mockResolvedValue("https://supabase.signed/file.jpg"),
  };
  const mockStorageR2 = {
    getAuthorizedUrl: vi.fn().mockResolvedValue("https://r2.signed/file.jpg"),
  };

  const validEvidenceId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestUser).mockResolvedValue({
      id: "user-1",
      email: "user@cat.local",
      role: "PICKING",
    } as never);

    vi.mocked(getEvidenceStorageForProvider).mockImplementation((provider) => {
      if (provider?.toLowerCase() === "r2") {
        return mockStorageR2 as never;
      }
      return mockStorageSupabase as never;
    });
  });

  it("redirecciona a URL prefirmada de R2 cuando provider es R2", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: validEvidenceId,
        storage_key: "2026/09/DEL-1/REMITO/ev-1.jpg",
        thumbnail_storage_key: "2026/09/DEL-1/REMITO/ev-1-thumb.webp",
        provider: "R2",
        voided_at: null,
      },
      error: null,
    });

    vi.mocked(createServerSupabase).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    } as never);

    const request = new Request(`https://cat.local/api/evidence/${validEvidenceId}/file`);
    const response = await GET(request, { params: Promise.resolve({ id: validEvidenceId }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://r2.signed/file.jpg");
    expect(getEvidenceStorageForProvider).toHaveBeenCalledWith("R2");
    expect(mockStorageR2.getAuthorizedUrl).toHaveBeenCalledWith("2026/09/DEL-1/REMITO/ev-1.jpg", 7200);
  });

  it("redirecciona a URL prefirmada de Supabase cuando provider es SUPABASE", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: validEvidenceId,
        storage_key: "2026/09/DEL-1/REMITO/ev-1.jpg",
        thumbnail_storage_key: "2026/09/DEL-1/REMITO/ev-1-thumb.webp",
        provider: "SUPABASE",
        voided_at: null,
      },
      error: null,
    });

    vi.mocked(createServerSupabase).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    } as never);

    const request = new Request(`https://cat.local/api/evidence/${validEvidenceId}/file?variant=thumb`);
    const response = await GET(request, { params: Promise.resolve({ id: validEvidenceId }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://supabase.signed/file.jpg");
    expect(getEvidenceStorageForProvider).toHaveBeenCalledWith("SUPABASE");
    expect(mockStorageSupabase.getAuthorizedUrl).toHaveBeenCalledWith("2026/09/DEL-1/REMITO/ev-1-thumb.webp", 7200);
  });
});
