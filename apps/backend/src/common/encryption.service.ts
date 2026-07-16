import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const hex = configService.get<string>('ENCRYPTION_KEY') ?? '';
    if (hex.length !== 64) {
      if (configService.get<string>('nodeEnv') === 'production') {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes) in production');
      }
      // Dev fallback — deterministic but NOT for production
      this.logger.warn('ENCRYPTION_KEY not set — using insecure dev key. Set a real key before production.');
      this.key = Buffer.from('0'.repeat(64), 'hex');
    } else {
      this.key = Buffer.from(hex, 'hex');
    }
  }

  /** Returns a self-contained ciphertext string: iv:authTag:ciphertext (all hex) */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /** Decrypts a string produced by encrypt(). Throws if tampered. */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid ciphertext format');
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
