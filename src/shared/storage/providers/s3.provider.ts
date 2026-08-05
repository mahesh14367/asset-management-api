import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../../config';
import { IStorageProvider, UploadResult } from '../storage.interface';

// Used for both AWS S3 (prod) and MinIO (dev/test) — MinIO is S3-compatible.
// The only difference between the two providers is the endpoint and forcePathStyle flag.
export class S3Provider implements IStorageProvider {
  protected client: S3Client;
  protected bucket: string;

  constructor() {
    this.bucket = config.storage.s3.bucket;
    this.client = new S3Client({
      region: config.storage.s3.region,
      credentials: {
        accessKeyId:     config.storage.s3.accessKeyId,
        secretAccessKey: config.storage.s3.secretAccessKey,
      },
    });
  }

  async upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    const ext     = file.originalname.split('.').pop() ?? 'bin';
    const fileKey = `${folder}/${crypto.randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         fileKey,
        Body:        file.buffer,
        ContentType: file.mimetype,
      })
    );

    return {
      fileKey,
      url:          `https://${this.bucket}.s3.${config.storage.s3.region}.amazonaws.com/${fileKey}`,
      originalName: file.originalname,
      mimeType:     file.mimetype,
      size:         file.size,
    };
  }

  async delete(fileKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey })
    );
  }

  async getSignedUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    return awsGetSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      { expiresIn: expiresInSeconds }
    );
  }
}
