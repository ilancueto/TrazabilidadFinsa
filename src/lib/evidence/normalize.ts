import { isHeic, resolveImageMime, type AllowedImageMime } from "@/lib/evidence/mime";

export async function normalizeEvidenceBytes(
  bytes: Uint8Array,
  declaredMime?: string | null,
): Promise<{ bytes: Uint8Array; mimeType: AllowedImageMime }> {
  if (isHeic(bytes, declaredMime)) {
    const convert = (await import("heic-convert")).default;
    const jpeg = await convert({
      buffer: Buffer.from(bytes),
      format: "JPEG",
      quality: 0.82,
    });
    return { bytes: new Uint8Array(jpeg), mimeType: "image/jpeg" };
  }

  const mimeType = resolveImageMime(bytes, declaredMime);
  if (!mimeType) {
    throw new Error("Esa foto no se puede usar. Probá sacarla de nuevo o elegirla desde la galería.");
  }
  return { bytes, mimeType };
}
