import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getEvidenceStorage,
  getEvidenceStorageForProvider,
  resetEvidenceStorage,
} from "@/lib/storage";
import { SupabaseEvidenceStorage } from "@/lib/storage/supabase-adapter";
import { R2EvidenceStorage } from "@/lib/storage/r2-adapter";

describe("storage factory", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetEvidenceStorage();
    process.env.R2_ACCOUNT_ID = "test-account-id";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET = "test-bucket";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEvidenceStorage();
  });

  it("retorna SupabaseEvidenceStorage para 'supabase' (case-insensitive)", () => {
    const storageLower = getEvidenceStorageForProvider("supabase");
    expect(storageLower).toBeInstanceOf(SupabaseEvidenceStorage);

    const storageUpper = getEvidenceStorageForProvider("SUPABASE");
    expect(storageUpper).toBeInstanceOf(SupabaseEvidenceStorage);
  });

  it("retorna R2EvidenceStorage para 'r2' (case-insensitive)", () => {
    const storageLower = getEvidenceStorageForProvider("r2");
    expect(storageLower).toBeInstanceOf(R2EvidenceStorage);

    const storageUpper = getEvidenceStorageForProvider("R2");
    expect(storageUpper).toBeInstanceOf(R2EvidenceStorage);
  });

  it("reutiliza la misma instancia (singleton) para el mismo provider", () => {
    const s1 = getEvidenceStorageForProvider("supabase");
    const s2 = getEvidenceStorageForProvider("supabase");
    expect(s1).toBe(s2);

    const r1 = getEvidenceStorageForProvider("r2");
    const r2 = getEvidenceStorageForProvider("r2");
    expect(r1).toBe(r2);
  });

  it("resetEvidenceStorage limpia las instancias en caché", () => {
    const s1 = getEvidenceStorageForProvider("supabase");
    resetEvidenceStorage();
    const s2 = getEvidenceStorageForProvider("supabase");
    expect(s1).not.toBe(s2);
  });

  it("getEvidenceStorage() utiliza EVIDENCE_STORAGE_PROVIDER del ambiente", () => {
    delete process.env.EVIDENCE_STORAGE_PROVIDER;
    const defaultStorage = getEvidenceStorage();
    expect(defaultStorage).toBeInstanceOf(SupabaseEvidenceStorage);

    resetEvidenceStorage();
    process.env.EVIDENCE_STORAGE_PROVIDER = "r2";
    const r2Default = getEvidenceStorage();
    expect(r2Default).toBeInstanceOf(R2EvidenceStorage);
  });

  it("lanza un error controlado ante un provider no reconocido", () => {
    expect(() => getEvidenceStorageForProvider("google-drive")).toThrowError(
      /Storage provider "google-drive" no reconocido/,
    );
    expect(() => getEvidenceStorageForProvider("s3-custom")).toThrowError(
      /Valores válidos: "supabase" \| "r2"/,
    );
  });
});
