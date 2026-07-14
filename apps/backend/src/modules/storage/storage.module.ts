import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FILE_STORAGE_PROVIDER } from './file-storage.provider';
import { NullStorageAdapter } from './adapters/null-storage.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';

// Plan Section 7, 16 — file storage adapter. Provides FILE_STORAGE_PROVIDER token.
// Uses S3StorageAdapter when S3_BUCKET + S3_ACCESS_KEY are set; NullStorageAdapter otherwise.
@Module({
  imports: [ConfigModule],
  providers: [
    NullStorageAdapter,
    S3StorageAdapter,
    {
      provide: FILE_STORAGE_PROVIDER,
      useFactory: (
        configService: ConfigService,
        s3: S3StorageAdapter,
        nullAdapter: NullStorageAdapter,
      ) => {
        const bucket = configService.get<string>('storage.bucket');
        const accessKey = configService.get<string>('storage.accessKey');
        return bucket && accessKey ? s3 : nullAdapter;
      },
      inject: [ConfigService, S3StorageAdapter, NullStorageAdapter],
    },
  ],
  exports: [FILE_STORAGE_PROVIDER],
})
export class StorageModule {}
