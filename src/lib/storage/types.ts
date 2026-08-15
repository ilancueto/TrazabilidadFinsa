export type UploadEvidenceInput = {
  key: string;
  bytes: Uint8Array;
  mimeType: string;
};

export type UploadedObject = {
  key: string;
};

export interface EvidenceStorage {
  upload(input: UploadEvidenceInput): Promise<UploadedObject>;
  getAuthorizedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  download(key: string): Promise<Uint8Array>;
  void(key: string): Promise<void>;
  remove?(key: string): Promise<void>;
}
