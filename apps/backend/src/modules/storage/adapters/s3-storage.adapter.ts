import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { FileStorageProvider } from '../file-storage.provider';

// Plan Section 7, 16 — AWS S3 / Cloudflare R2 adapter.
// Cloudflare R2 is S3-compatible; set S3_ENDPOINT to the R2 endpoint URL.
@Injectable()
export class S3StorageAdapter implements FileStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = configService.get<string>('storage.endpoint');
    this.bucket = configService.get<string>('storage.bucket') ?? '';
    this.client = new S3Client({
      region: configService.get<string>('storage.region') ?? 'ap-south-1',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: configService.get<string>('storage.accessKey') ?? '',
        secretAccessKey: configService.get<string>('storage.secretKey') ?? '',
      },
    });
    this.publicBase = endpoint
      ? `${endpoint}/${this.bucket}`
      : `https://${this.bucket}.s3.amazonaws.com`;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `${this.publicBase}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
