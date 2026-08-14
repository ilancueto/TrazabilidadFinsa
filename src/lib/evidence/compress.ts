"use client";

import { COMPRESS_MAX_EDGE, COMPRESS_QUALITY } from "@/lib/constants";

export type CompressedImage = {
  file: File;
  width: number;
  height: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function drawToJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No hay canvas disponible");
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) reject(new Error("No se pudo comprimir la foto"));
        else resolve(value);
      },
      "image/jpeg",
      COMPRESS_QUALITY,
    );
  });
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  const scale = longEdge > COMPRESS_MAX_EDGE ? COMPRESS_MAX_EDGE / longEdge : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function toJpegFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "evidencia";
  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function compressEvidenceImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const size = scaledSize(bitmap.width, bitmap.height);
  const blob = await drawToJpeg(bitmap, size.width, size.height);
  bitmap.close();
  return { file: toJpegFile(blob, file.name), ...size };
}

export async function prepareEvidenceImage(file: File): Promise<CompressedImage> {
  if (file.size > 0 && file.size <= 350_000 && (file.type === "image/jpeg" || file.type === "image/jpg")) {
    return { file, width: 0, height: 0 };
  }

  try {
    return await withTimeout(
      compressEvidenceImage(file),
      8000,
      "La foto tardó demasiado en prepararse",
    );
  } catch {
    if (file.size > 0 && file.size <= 8 * 1024 * 1024 && file.type.startsWith("image/")) {
      return { file, width: 0, height: 0 };
    }
    throw new Error("No se pudo leer la foto del iPhone. Probá de nuevo o elegí una imagen de Fotos.");
  }
}
