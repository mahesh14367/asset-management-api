export interface UploadResult {
  fileKey: string;       // unique storage path — the single identifier for all subsequent ops
  url: string;           // direct URL (public bucket) or placeholder for signed-URL providers
  originalName: string;
  mimeType: string;
  size: number;
}

export interface IStorageProvider {
  upload(file: Express.Multer.File, folder: string): Promise<UploadResult>;
  delete(fileKey: string): Promise<void>;
  getSignedUrl(fileKey: string, expiresInSeconds?: number): Promise<string>;
}
