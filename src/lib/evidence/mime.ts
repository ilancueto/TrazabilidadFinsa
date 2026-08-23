import { ALLOWED_EVIDENCE_MIME, MAX_EVIDENCE_BYTES } from "@/lib/constants";

export type AllowedImageMime = (typeof ALLOWED_EVIDENCE_MIME)[number];

export function isHeic(bytes: Uint8Array, declared?: string | null): boolean {
  const declaredType = (declared ?? "").toLowerCase();
  if (declaredType.includes("heic") || declaredType.includes("heif")) return true;
  if (bytes.length < 12) return false;
  const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
  return brand === "heic" || brand === "heif" || brand === "mif1" || brand === "msf1";
}

export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  const header = String.fromCharCode(...bytes.subarray(0, 4));
  const fourcc = String.fromCharCode(...bytes.subarray(8, 12));
  if (header === "RIFF" && fourcc === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function isBlobLike(value: unknown): value is Blob {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { arrayBuffer?: unknown; size?: unknown };
  return typeof candidate.arrayBuffer === "function" && typeof candidate.size === "number";
}

export function resolveImageMime(
  bytes: Uint8Array,
  _declared?: string | null,
): AllowedImageMime | null {
  // El Content-Type del cliente no es evidencia del formato real.
  // JPEG/PNG/WebP sólo se aceptan si sus magic bytes coinciden.
  return sniffImageMime(bytes);
}

export function assertUploadSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new PersistValidationError("La foto está vacía");
  }
  if (size > MAX_EVIDENCE_BYTES) {
    throw new PersistValidationError("La foto supera el tamaño máximo de 8 MB");
  }
}

export class PersistValidationError extends Error {
  readonly code = "VALIDATION";
  constructor(message: string) {
    super(message);
    this.name = "PersistValidationError";
  }
}

export class PersistForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "PersistForbiddenError";
  }
}

export class PersistNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message: string) {
    super(message);
    this.name = "PersistNotFoundError";
  }
}

export class PersistStorageError extends Error {
  readonly code = "STORAGE_FAILURE";
  constructor(message = "No se pudo guardar la evidencia") {
    super(message);
    this.name = "PersistStorageError";
  }
}

export class PersistRpcError extends Error {
  readonly code = "RPC_FAILURE";
  constructor(message = "No se pudo registrar la evidencia") {
    super(message);
    this.name = "PersistRpcError";
  }
}
