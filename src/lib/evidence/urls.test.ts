import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { signedEvidenceUrls, signedEvidenceUrlMap } from "@/lib/evidence/urls";
import * as storageModule from "@/lib/storage";

describe("evidence urls dual-read", () => {
  const mockStorageSupabase = {
    getAuthorizedUrl: vi.fn(),
  };
  const mockStorageR2 = {
    getAuthorizedUrl: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(storageModule, "getEvidenceStorageForProvider").mockImplementation((provider) => {
      if (provider?.toLowerCase() === "r2") {
        return mockStorageR2 as unknown as storageModule.EvidenceStorage;
      }
      return mockStorageSupabase as unknown as storageModule.EvidenceStorage;
    });
  });

  describe("signedEvidenceUrls", () => {
    it("utiliza el storage adapter correspondiente según provider", async () => {
      mockStorageR2.getAuthorizedUrl.mockResolvedValueOnce("https://r2.signed/img.jpg");
      mockStorageR2.getAuthorizedUrl.mockResolvedValueOnce("https://r2.signed/thumb.webp");

      const result = await signedEvidenceUrls({
        storageKey: "r2-key.jpg",
        thumbnailStorageKey: "r2-thumb.webp", // gitleaks:allow
        provider: "R2",
      });

      expect(storageModule.getEvidenceStorageForProvider).toHaveBeenCalledWith("R2");
      expect(mockStorageR2.getAuthorizedUrl).toHaveBeenCalledWith("r2-key.jpg", 7200);
      expect(mockStorageR2.getAuthorizedUrl).toHaveBeenCalledWith("r2-thumb.webp", 7200);
      expect(result).toEqual({
        src: "https://r2.signed/img.jpg",
        thumbSrc: "https://r2.signed/thumb.webp",
      });
    });

    it("utiliza Supabase si provider es supabase o undefined", async () => {
      mockStorageSupabase.getAuthorizedUrl.mockResolvedValueOnce("https://supabase.signed/img.jpg");

      const result = await signedEvidenceUrls({
        storageKey: "supa-key.jpg",
      });

      expect(storageModule.getEvidenceStorageForProvider).toHaveBeenCalledWith(undefined);
      expect(mockStorageSupabase.getAuthorizedUrl).toHaveBeenCalledWith("supa-key.jpg", 7200);
      expect(result).toEqual({
        src: "https://supabase.signed/img.jpg",
        thumbSrc: "https://supabase.signed/img.jpg",
      });
    });
  });

  describe("signedEvidenceUrlMap", () => {
    it("resuelve mapa con dual-read para múltiples evidencias ignorando anuladas", async () => {
      mockStorageSupabase.getAuthorizedUrl.mockResolvedValue("https://supabase.signed/file.jpg");
      mockStorageR2.getAuthorizedUrl.mockResolvedValue("https://r2.signed/file.jpg");

      const map = await signedEvidenceUrlMap([
        {
          id: "ev-1",
          storage_key: "key-1.jpg",
          thumbnail_storage_key: null,
          provider: "SUPABASE",
        },
        {
          id: "ev-2",
          storage_key: "key-2.jpg",
          thumbnail_storage_key: null,
          provider: "R2",
        },
        {
          id: "ev-voided",
          storage_key: "void.jpg",
          thumbnail_storage_key: null,
          voided_at: "2026-09-24T10:00:00Z",
          provider: "R2",
        },
      ]);

      expect(map.size).toBe(2);
      expect(map.get("ev-1")?.src).toBe("https://supabase.signed/file.jpg");
      expect(map.get("ev-2")?.src).toBe("https://r2.signed/file.jpg");
      expect(map.has("ev-voided")).toBe(false);
    });
  });
});
