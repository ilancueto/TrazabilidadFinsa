import "server-only";

import { getEvidenceStorage } from "@/lib/storage";

const SIGNED_TTL_SECONDS = 60 * 60 * 2;

export type EvidenceImageUrls = {
  src: string;
  thumbSrc: string;
};

export async function signedEvidenceUrls(input: {
  storageKey: string;
  thumbnailStorageKey?: string | null;
}): Promise<EvidenceImageUrls> {
  const storage = getEvidenceStorage();
  const src = await storage.getAuthorizedUrl(input.storageKey, SIGNED_TTL_SECONDS);
  if (!input.thumbnailStorageKey) return { src, thumbSrc: src };
  try {
    const thumbSrc = await storage.getAuthorizedUrl(input.thumbnailStorageKey, SIGNED_TTL_SECONDS);
    return { src, thumbSrc };
  } catch {
    return { src, thumbSrc: src };
  }
}

export async function signedEvidenceUrlMap(
  rows: Array<{
    id: string;
    storage_key: string;
    thumbnail_storage_key: string | null;
    voided_at?: string | null;
  }>,
): Promise<Map<string, EvidenceImageUrls>> {
  const active = rows.filter((row) => !row.voided_at);
  const entries = await Promise.all(
    active.map(async (row) => {
      const urls = await signedEvidenceUrls({
        storageKey: row.storage_key,
        thumbnailStorageKey: row.thumbnail_storage_key,
      });
      return [row.id, urls] as const;
    }),
  );
  return new Map(entries);
}
