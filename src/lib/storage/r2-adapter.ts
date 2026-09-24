import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { EvidenceStorage, UploadEvidenceInput, UploadedObject } from "@/lib/storage/types";
import { voidedKey } from "@/lib/storage/path";
import { logServerError } from "@/lib/observability";

export type R2StorageConfig = {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  endpoint?: string;
};

export class R2EvidenceStorage implements EvidenceStorage {
  private client: S3Client;
  private bucket: string;

  constructor(config?: R2StorageConfig, customClient?: S3Client) {
    const bucket = config?.bucket ?? process.env.R2_BUCKET ?? "cat-evidences";
    this.bucket = bucket;

    if (customClient) {
      this.client = customClient;
      return;
    }

    const accountId = config?.accountId ?? process.env.R2_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId ?? process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey ?? process.env.R2_SECRET_ACCESS_KEY;
    const endpoint =
      config?.endpoint ??
      process.env.R2_ENDPOINT ??
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error(
        "Faltan credenciales de Cloudflare R2 (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_ACCOUNT_ID o R2_ENDPOINT).",
      );
    }

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(input: UploadEvidenceInput): Promise<UploadedObject> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: Buffer.from(input.bytes),
        ContentType: input.mimeType,
      });
      await this.client.send(command);
      return { key: input.key };
    } catch (error) {
      throw new Error(
        `No se pudo guardar la evidencia en R2: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
    }
  }

  async getAuthorizedUrl(key: string, expiresInSeconds = 60 * 60 * 2): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      throw new Error(
        `No se pudo firmar el acceso a la evidencia en R2: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
    }
  }

  async download(key: string): Promise<Uint8Array> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error("archivo vacío");
      }
      const bytes = await response.Body.transformToByteArray();
      return bytes;
    } catch (error) {
      throw new Error(
        `No se pudo leer la evidencia en R2: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
    }
  }

  async void(key: string): Promise<void> {
    const target = voidedKey(key);
    if (target === key) return;

    try {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${encodeURI(key)}`,
          Key: target,
        }),
      );
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      // El registro en DB sigue anulado aunque el archivo no se mueva.
      logServerError("storage.void_move_failed", error, { operation: "storage.void" });
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await Promise.all([
        this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        ),
        this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: voidedKey(key),
          }),
        ),
      ]);
    } catch (error) {
      logServerError("storage.remove_failed", error, { operation: "storage.remove" });
    }
  }
}
