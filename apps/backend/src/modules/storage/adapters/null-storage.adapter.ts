import { Injectable, Logger } from '@nestjs/common';
import { FileStorageProvider } from '../file-storage.provider';

// Development/test stub — no real upload. Replace with S3StorageAdapter in production.
@Injectable()
export class NullStorageAdapter implements FileStorageProvider {
  private readonly logger = new Logger(NullStorageAdapter.name);

  async upload(key: string, _buffer: Buffer, _mimeType: string): Promise<string> {
    this.logger.debug(`[NullStorageAdapter] upload: ${key}`);
    return `https://null-storage.local/${key}`;
  }

  async delete(key: string): Promise<void> {
    this.logger.debug(`[NullStorageAdapter] delete: ${key}`);
  }
}
