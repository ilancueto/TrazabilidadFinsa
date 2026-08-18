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

function drawWithRotation(
  source: CanvasImageSource,
  width: number,
  height: number,
  rotation: number,
): Promise<Blob> {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const isPerpendicular = normalizedRotation === 90 || normalizedRotation === 270;
  const targetWidth = isPerpendicular ? height : width;
  const targetHeight = isPerpendicular ? width : height;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No hay canvas disponible");

  ctx.save();
  ctx.translate(targetWidth / 2, targetHeight / 2);
  ctx.rotate((normalizedRotation * Math.PI) / 180);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) reject(new Error("No se pudo procesar la foto"));
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

export async function compressEvidenceImage(file: File, rotation = 0): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const size = scaledSize(bitmap.width, bitmap.height);
  const blob = await drawWithRotation(bitmap, size.width, size.height, rotation);
  bitmap.close();
  const isPerpendicular = (((rotation % 360) + 360) % 360 === 90) || (((rotation % 360) + 360) % 360 === 270);
  const finalWidth = isPerpendicular ? size.height : size.width;
  const finalHeight = isPerpendicular ? size.width : size.height;
  return { file: toJpegFile(blob, file.name), width: finalWidth, height: finalHeight };
}

export async function prepareEvidenceImage(file: File, rotation = 0): Promise<CompressedImage> {
  if (rotation === 0 && file.size > 0 && file.size <= 350_000 && (file.type === "image/jpeg" || file.type === "image/jpg")) {
    return { file, width: 0, height: 0 };
  }

  try {
    return await withTimeout(
      compressEvidenceImage(file, rotation),
      10000,
      "La foto tardó demasiado en prepararse",
    );
  } catch {
    if (rotation === 0 && file.size > 0 && file.size <= 8 * 1024 * 1024 && file.type.startsWith("image/")) {
      return { file, width: 0, height: 0 };
    }
    throw new Error("No se pudo leer la foto. Probá de nuevo o elegila desde la galería.");
  }
}

