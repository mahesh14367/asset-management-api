import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../../config';
import { IStorageProvider, UploadResult } from '../storage.interface';

// MinIO is S3-compatible — same SDK, different endpoint + forcePathStyle.
export class MinIOProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;
  private endpointBase: string;
  private bucketInitialized: boolean = false;

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

  private async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) return;

    try {
      // Check if bucket exists
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketInitialized = true;
    } catch (error: any) {
      // If bucket doesn't exist, create it
      if (error.name === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          console.log(`Bucket '${this.bucket}' created successfully`);
          this.bucketInitialized = true;
        } catch (createError: any) {
          console.error(`Failed to create bucket '${this.bucket}':`, createError);
          throw createError;
        }
      } else {
        console.error(`Error checking bucket '${this.bucket}':`, error);
        throw error;
      }
    }
  }

  async upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    // Ensure bucket exists before upload
    await this.ensureBucketExists();

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
    await this.ensureBucketExists();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey })
    );
  }

  async getSignedUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    await this.ensureBucketExists();
    return awsGetSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      { expiresIn: expiresInSeconds }
    );
  }
}
