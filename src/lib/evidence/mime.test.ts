import { describe, expect, it } from "vitest";
import { isBlobLike, isHeic, resolveImageMime, sniffImageMime } from "@/lib/evidence/mime";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);

describe("sniffImageMime", () => {
  it("detecta jpeg/png/webp por magic bytes", () => {
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(PNG)).toBe("image/png");
    expect(sniffImageMime(WEBP)).toBe("image/webp");
  });

  it("rechaza basura y buffers cortos", () => {
    expect(sniffImageMime(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(sniffImageMime(Uint8Array.from({ length: 20 }, () => 1))).toBeNull();
  });
});

describe("resolveImageMime", () => {
  it("usa el contenido real y no confía en el MIME declarado", () => {
    expect(resolveImageMime(JPEG, "image/png")).toBe("image/jpeg");
    expect(resolveImageMime(new Uint8Array(20), "image/jpeg")).toBeNull();
    expect(resolveImageMime(new Uint8Array(20), "application/pdf")).toBeNull();
  });
});

describe("isHeic", () => {
  it("detecta brand HEIC y el MIME declarado", () => {
    const header = new Uint8Array(12);
    header.set([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]); // ....ftypheic
    expect(isHeic(header)).toBe(true);
    expect(isHeic(new Uint8Array(12), "image/heic")).toBe(true);
    expect(isHeic(JPEG)).toBe(false);
  });
});

describe("isBlobLike", () => {
  it("acepta Blob y rechaza strings", () => {
    expect(isBlobLike(new Blob([JPEG], { type: "image/jpeg" }))).toBe(true);
    expect(isBlobLike("file")).toBe(false);
    expect(isBlobLike(null)).toBe(false);
  });
});
