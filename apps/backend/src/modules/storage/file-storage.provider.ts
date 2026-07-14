export interface FileStorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE_PROVIDER = Symbol('FILE_STORAGE_PROVIDER');
