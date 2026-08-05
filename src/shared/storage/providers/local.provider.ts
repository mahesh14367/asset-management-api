import fs from 'fs';
import path from 'path';
import { config } from '../../../config';
import { IStorageProvider, UploadResult } from '../storage.interface';

export class LocalProvider implements IStorageProvider {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadDir = path.resolve(config.storage.local.uploadDir);
    this.baseUrl   = config.storage.local.baseUrl;
  }

  async upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    const dir     = path.join(this.uploadDir, folder);
    const ext     = file.originalname.split('.').pop() ?? 'bin';
    const filename = `${crypto.randomUUID()}.${ext}`;
    const fileKey = `${folder}/${filename}`;

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), file.buffer);

    return {
      fileKey,
      url:          `${this.baseUrl}/uploads/${fileKey}`,
      originalName: file.originalname,
      mimeType:     file.mimetype,
      size:         file.size,
    };
  }

  async delete(fileKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Local provider doesn't have signed URLs — returns a plain URL with an expiry hint in the query string.
  async getSignedUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `${this.baseUrl}/uploads/${fileKey}?expires=${expiresAt}`;
  }
}
