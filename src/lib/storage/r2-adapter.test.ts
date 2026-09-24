import { describe, expect, it, vi, beforeEach } from "vitest";
import { R2EvidenceStorage } from "@/lib/storage/r2-adapter";
import type { S3Client } from "@aws-sdk/client-s3";
import * as presigner from "@aws-sdk/s3-request-presigner";
import * as observability from "@/lib/observability";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  logServerError: vi.fn(),
}));

describe("R2EvidenceStorage", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let mockClient: S3Client;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    mockClient = {
      send: mockSend,
    } as unknown as S3Client;
  });

  it("inicializa con config explícita o customClient", () => {
    const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);
    expect(storage).toBeInstanceOf(R2EvidenceStorage);
  });

  it("falla si faltan variables de entorno requeridas y no se pasa client", () => {
    const prevAccount = process.env.R2_ACCOUNT_ID;
    const prevKey = process.env.R2_ACCESS_KEY_ID;
    const prevSecret = process.env.R2_SECRET_ACCESS_KEY;
    const prevEndpoint = process.env.R2_ENDPOINT;

    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ENDPOINT;

    try {
      expect(() => new R2EvidenceStorage()).toThrowError(/Faltan credenciales de Cloudflare R2/);
    } finally {
      if (prevAccount) process.env.R2_ACCOUNT_ID = prevAccount;
      if (prevKey) process.env.R2_ACCESS_KEY_ID = prevKey;
      if (prevSecret) process.env.R2_SECRET_ACCESS_KEY = prevSecret;
      if (prevEndpoint) process.env.R2_ENDPOINT = prevEndpoint;
    }
  });

  describe("upload", () => {
    it("sube el archivo a R2 y retorna la key", async () => {
      mockSend.mockResolvedValueOnce({});
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      const result = await storage.upload({
        key: "2026/09/DEL-1/REMITO/ev-1.jpg",
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
      });

      expect(result).toEqual({ key: "2026/09/DEL-1/REMITO/ev-1.jpg" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "2026/09/DEL-1/REMITO/ev-1.jpg",
        ContentType: "image/jpeg",
      });
    });

    it("lanza error descriptivo si la subida falla", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network timeout"));
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await expect(
        storage.upload({
          key: "test.jpg",
          bytes: new Uint8Array([1]),
          mimeType: "image/jpeg",
        }),
      ).rejects.toThrowError("No se pudo guardar la evidencia en R2: Network timeout");
    });
  });

  describe("getAuthorizedUrl", () => {
    it("genera una URL prefirmada con TTL", async () => {
      vi.mocked(presigner.getSignedUrl).mockResolvedValueOnce("https://r2.signed.url/test.jpg?token=abc");
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      const url = await storage.getAuthorizedUrl("2026/09/DEL-1/REMITO/ev-1.jpg", 3600);

      expect(url).toBe("https://r2.signed.url/test.jpg?token=abc");
      expect(presigner.getSignedUrl).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          input: {
            Bucket: "test-bucket",
            Key: "2026/09/DEL-1/REMITO/ev-1.jpg",
          },
        }),
        { expiresIn: 3600 },
      );
    });

    it("lanza error si la firma falla", async () => {
      vi.mocked(presigner.getSignedUrl).mockRejectedValueOnce(new Error("Signing error"));
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await expect(storage.getAuthorizedUrl("test.jpg")).rejects.toThrowError(
        "No se pudo firmar el acceso a la evidencia en R2: Signing error",
      );
    });
  });

  describe("download", () => {
    it("descarga el binario y lo retorna como Uint8Array", async () => {
      const mockBytes = new Uint8Array([10, 20, 30]);
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(mockBytes),
        },
      });

      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);
      const downloaded = await storage.download("test.jpg");

      expect(downloaded).toEqual(mockBytes);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("lanza error si el archivo devuelto está vacío o sin Body", async () => {
      mockSend.mockResolvedValueOnce({ Body: null });
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await expect(storage.download("test.jpg")).rejects.toThrowError(
        "No se pudo leer la evidencia en R2: archivo vacío",
      );
    });

    it("lanza error si el comando de descarga falla", async () => {
      mockSend.mockRejectedValueOnce(new Error("Access Denied"));
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await expect(storage.download("test.jpg")).rejects.toThrowError(
        "No se pudo leer la evidencia en R2: Access Denied",
      );
    });
  });

  describe("void", () => {
    it("copia a voided/ y elimina el objeto original", async () => {
      mockSend.mockResolvedValue({});
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await storage.void("2026/09/DEL-1/test.jpg");

      expect(mockSend).toHaveBeenCalledTimes(2);
      const copyCall = mockSend.mock.calls[0][0];
      const deleteCall = mockSend.mock.calls[1][0];

      expect(copyCall.input).toMatchObject({
        Bucket: "test-bucket",
        CopySource: "test-bucket/2026/09/DEL-1/test.jpg",
        Key: "voided/2026/09/DEL-1/test.jpg",
      });
      expect(deleteCall.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "2026/09/DEL-1/test.jpg",
      });
    });

    it("no hace nada si la key ya comienza con voided/", async () => {
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await storage.void("voided/2026/09/DEL-1/test.jpg");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("registra error en observabilidad sin lanzar excepción si falla la copia", async () => {
      mockSend.mockRejectedValueOnce(new Error("Copy failed"));
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await expect(storage.void("2026/09/DEL-1/test.jpg")).resolves.toBeUndefined();
      expect(observability.logServerError).toHaveBeenCalledWith(
        "storage.void_move_failed",
        expect.any(Error),
        { operation: "storage.void" },
      );
    });
  });

  describe("remove", () => {
    it("elimina tanto la key principal como la ruta voided/", async () => {
      mockSend.mockResolvedValue({});
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await storage.remove("2026/09/DEL-1/test.jpg");

      expect(mockSend).toHaveBeenCalledTimes(2);
      const deleteKey = mockSend.mock.calls[0][0];
      const deleteVoided = mockSend.mock.calls[1][0];

      expect(deleteKey.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "2026/09/DEL-1/test.jpg",
      });
      expect(deleteVoided.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "voided/2026/09/DEL-1/test.jpg",
      });
    });

    it("captura errores de eliminación y los registra en observabilidad", async () => {
      mockSend.mockRejectedValue(new Error("Delete failed"));
      const storage = new R2EvidenceStorage({ bucket: "test-bucket" }, mockClient);

      await expect(storage.remove("2026/09/DEL-1/test.jpg")).resolves.toBeUndefined();
      expect(observability.logServerError).toHaveBeenCalledWith(
        "storage.remove_failed",
        expect.any(Error),
        { operation: "storage.remove" },
      );
    });
  });
});
