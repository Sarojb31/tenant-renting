import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FacebookConnectionService } from './facebook-connection.service';
import { TenantFacebookConnection, FbConnectionMethod } from './tenant-facebook-connection.entity';
import { EncryptionService } from '@common/encryption.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_KEY = 'a'.repeat(64); // 32 bytes expressed as 64 hex chars

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    'facebook.appId': 'test-app-id',
    'facebook.appSecret': 'global-app-secret',
    'app.baseUrl': 'http://localhost:3000',
    'app.adminBaseUrl': 'http://localhost:5174',
    ENCRYPTION_KEY: TEST_KEY,
    nodeEnv: 'test',
    ...overrides,
  };
  return {
    get: jest.fn().mockImplementation((k: string) => values[k] ?? undefined),
  } as any;
}

function makeEncryption(config = makeConfig()) {
  return new EncryptionService(config);
}

function makeRepo(
  overrides: Partial<Repository<TenantFacebookConnection>> = {},
): jest.Mocked<Pick<Repository<TenantFacebookConnection>, 'findOne' | 'upsert' | 'delete'>> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  } as any;
}

function buildSvc(
  repoOverrides: Partial<Repository<TenantFacebookConnection>> = {},
  configOverrides: Record<string, string> = {},
) {
  const config = makeConfig(configOverrides);
  const encryption = makeEncryption(config);
  const repo = makeRepo(repoOverrides);
  const svc = new FacebookConnectionService(
    repo as unknown as Repository<TenantFacebookConnection>,
    config,
    encryption,
  );
  return { svc, repo, encryption, config };
}

// ─── getStatus ────────────────────────────────────────────────────────────────

describe('FacebookConnectionService.getStatus', () => {
  it('returns connected:false when no connection exists', async () => {
    const { svc } = buildSvc({ findOne: jest.fn().mockResolvedValue(null) });
    const result = await svc.getStatus('tenant-1');
    expect(result.connected).toBe(false);
    expect(result.connection).toBeUndefined();
  });

  it('returns connected:true with page info when connection exists', async () => {
    const { svc } = buildSvc({
      findOne: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        fbPageId: 'page-42',
        fbPageName: 'Demo Property',
        connectionMethod: FbConnectionMethod.OAUTH_SHARED_APP,
        connectedAt: new Date('2026-01-01'),
      }),
    });
    const result = await svc.getStatus('tenant-1');
    expect(result.connected).toBe(true);
    expect(result.connection?.fbPageId).toBe('page-42');
    expect(result.connection?.fbPageName).toBe('Demo Property');
    expect(result.connection?.connectionMethod).toBe(FbConnectionMethod.OAUTH_SHARED_APP);
  });
});

// ─── connectByo ───────────────────────────────────────────────────────────────

describe('FacebookConnectionService.connectByo', () => {
  const dto = {
    pageId: 'page-99',
    pageName: 'My BYO Page',
    pageAccessToken: 'ptoken-abc',
    appId: 'byo-app-id',
    appSecret: 'byo-app-secret',
  };

  it('throws ConflictException if tenant already has a connection', async () => {
    const { svc } = buildSvc({
      findOne: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    });
    await expect(svc.connectByo('tenant-1', 'user-1', dto)).rejects.toThrow(ConflictException);
  });

  it('stores encrypted page token and app secret', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    // findOne: first call (tenant check) → null, second call (getStatus) → saved row
    let callCount = 0;
    const findOne = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return null; // tenant check
      if (callCount === 2) return null; // page-owner check
      // getStatus call
      return {
        tenantId: 'tenant-1',
        fbPageId: 'page-99',
        fbPageName: 'My BYO Page',
        connectionMethod: FbConnectionMethod.BYO_APP,
        connectedAt: new Date(),
      };
    });
    const { svc, encryption } = buildSvc({ findOne, upsert });

    await svc.connectByo('tenant-1', 'user-1', dto);

    const saved = (upsert as jest.Mock).mock.calls[0][0] as Partial<TenantFacebookConnection>;
    expect(saved.connectionMethod).toBe(FbConnectionMethod.BYO_APP);
    expect(saved.fbAppId).toBe('byo-app-id');

    // Verify both sensitive fields are encrypted (not plaintext)
    expect(saved.pageAccessToken).not.toBe('ptoken-abc');
    expect(saved.fbAppSecret).not.toBe('byo-app-secret');
    expect(encryption.decrypt(saved.pageAccessToken!)).toBe('ptoken-abc');
    expect(encryption.decrypt(saved.fbAppSecret!)).toBe('byo-app-secret');
  });
});

// ─── disconnect ───────────────────────────────────────────────────────────────

describe('FacebookConnectionService.disconnect', () => {
  it('throws NotFoundException when no connection exists', async () => {
    const { svc } = buildSvc({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(svc.disconnect('tenant-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes the connection row', async () => {
    const del = jest.fn().mockResolvedValue({ affected: 1 });
    const { svc } = buildSvc({
      findOne: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      delete: del,
    });
    await svc.disconnect('tenant-1');
    expect(del).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });
});

// ─── resolveAppSecret ─────────────────────────────────────────────────────────

describe('FacebookConnectionService.resolveAppSecret', () => {
  it('returns null when page is not registered', async () => {
    const { svc } = buildSvc({ findOne: jest.fn().mockResolvedValue(null) });
    const result = await svc.resolveAppSecret('page-unknown');
    expect(result).toBeNull();
  });

  it('returns global app secret for oauth_shared_app connections', async () => {
    const { svc } = buildSvc({
      findOne: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        connectionMethod: FbConnectionMethod.OAUTH_SHARED_APP,
        fbAppSecret: null,
      }),
    });
    const result = await svc.resolveAppSecret('page-42');
    expect(result?.tenantId).toBe('tenant-1');
    expect(result?.appSecret).toBe('global-app-secret');
  });

  it('returns decrypted tenant app secret for byo_app connections', async () => {
    const config = makeConfig();
    const encryption = makeEncryption(config);
    const encrypted = encryption.encrypt('tenant-byo-secret');

    const svc = new FacebookConnectionService(
      makeRepo({
        findOne: jest.fn().mockResolvedValue({
          tenantId: 'tenant-2',
          connectionMethod: FbConnectionMethod.BYO_APP,
          fbAppSecret: encrypted,
        }),
      }) as unknown as Repository<TenantFacebookConnection>,
      config,
      encryption,
    );

    const result = await svc.resolveAppSecret('page-99');
    expect(result?.appSecret).toBe('tenant-byo-secret');
  });
});

// ─── EncryptionService round-trip ─────────────────────────────────────────────

describe('EncryptionService', () => {
  it('encrypt/decrypt round-trips plaintext correctly', () => {
    const enc = makeEncryption();
    const plaintext = 'EAABxxxx|super_secret_page_token';
    expect(enc.decrypt(enc.encrypt(plaintext))).toBe(plaintext);
  });

  it('throws on tampered ciphertext', () => {
    const enc = makeEncryption();
    const ct = enc.encrypt('hello');
    const tampered = ct.replace(/.$/, ct.slice(-1) === 'a' ? 'b' : 'a');
    expect(() => enc.decrypt(tampered)).toThrow();
  });
});
