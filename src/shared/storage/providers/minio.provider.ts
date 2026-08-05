import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../../config';
import { IStorageProvider, UploadResult } from '../storage.interface';

// MinIO is S3-compatible — same SDK, different endpoint + forcePathStyle.
export class MinIOProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;
  private endpointBase: string;

  constructor() {
    this.bucket      = config.storage.minio.bucket;
    this.endpointBase = config.storage.minio.endpoint;

    this.client = new S3Client({
      region:           'us-east-1', // MinIO ignores region but SDK requires a value
      endpoint:         this.endpointBase,
      forcePathStyle:   true,        // MinIO requires path-style URLs
      credentials: {
        accessKeyId:     config.storage.minio.accessKey,
        secretAccessKey: config.storage.minio.secretKey,
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
      url:          `${this.endpointBase}/${this.bucket}/${fileKey}`,
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
