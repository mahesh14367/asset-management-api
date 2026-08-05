import { config } from '../../config';
import { IStorageProvider, UploadResult } from './storage.interface';
import { S3Provider } from './providers/s3.provider';
import { MinIOProvider } from './providers/minio.provider';
import { LocalProvider } from './providers/local.provider';

type StorageDriver = 's3' | 'minio' | 'local';

const PROVIDERS: Record<StorageDriver, () => IStorageProvider> = {
  s3:    () => new S3Provider(),
  minio: () => new MinIOProvider(),
  local: () => new LocalProvider(),
};

class StorageService {
  private provider: IStorageProvider;

  constructor() {
    const driver = (config.storage.driver as StorageDriver) ?? 'local';
    const factory = PROVIDERS[driver] ?? PROVIDERS.local;
    this.provider = factory();
  }

  upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    return this.provider.upload(file, folder);
  }

  delete(fileKey: string): Promise<void> {
    return this.provider.delete(fileKey);
  }

  getSignedUrl(fileKey: string, expiresInSeconds?: number): Promise<string> {
    return this.provider.getSignedUrl(fileKey, expiresInSeconds);
  }
}

// Singleton — instantiated once at startup; swap driver by changing STORAGE_DRIVER env var
export const storageService = new StorageService();
