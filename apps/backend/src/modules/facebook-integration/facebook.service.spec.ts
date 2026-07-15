import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { FacebookService } from './facebook.service';
import { FbPageLead } from './fb-page-lead.entity';

function makeRepo(overrides: Partial<Repository<FbPageLead>> = {}): Repository<FbPageLead> {
  return {
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'uuid-1', ...e })),
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as Repository<FbPageLead>;
}

function makeConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn().mockImplementation((key: string) => values[key]),
  } as any;
}

// --- verifyWebhook ---

describe('FacebookService.verifyWebhook', () => {
  it('returns challenge when mode is subscribe and token matches', () => {
    const svc = new FacebookService(makeRepo(), makeConfig({ 'facebook.verifyToken': 'secret123' }));
    const result = svc.verifyWebhook('subscribe', 'secret123', 'challenge-abc');
    expect(result).toBe('challenge-abc');
  });

  it('throws UnauthorizedException when token does not match', () => {
    const svc = new FacebookService(makeRepo(), makeConfig({ 'facebook.verifyToken': 'secret123' }));
    expect(() => svc.verifyWebhook('subscribe', 'wrong-token', 'ch')).toThrow(UnauthorizedException);
  });
});

// --- verifySignature ---

describe('FacebookService.verifySignature', () => {
  it('does not throw when appSecret is not configured (dev mode)', () => {
    const svc = new FacebookService(makeRepo(), makeConfig({ 'facebook.appSecret': '' }));
    expect(() => svc.verifySignature(Buffer.from('body'), 'sha256=anything')).not.toThrow();
  });

  it('does not throw when signature matches HMAC', () => {
    const appSecret = 'my-app-secret';
    const rawBody = Buffer.from('{"object":"page"}');
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const svc = new FacebookService(makeRepo(), makeConfig({ 'facebook.appSecret': appSecret }));
    expect(() => svc.verifySignature(rawBody, expected)).not.toThrow();
  });

  it('throws UnauthorizedException when signature is invalid', () => {
    const appSecret = 'my-app-secret';
    const rawBody = Buffer.from('{"object":"page"}');
    // Build a valid-length but wrong signature
    const wrongHex = 'a'.repeat(64);
    const wrongSig = 'sha256=' + wrongHex;
    const svc = new FacebookService(makeRepo(), makeConfig({ 'facebook.appSecret': appSecret }));
    expect(() => svc.verifySignature(rawBody, wrongSig)).toThrow(UnauthorizedException);
  });
});

// --- processEvent ---

describe('FacebookService.processEvent', () => {
  it('saves a lead with correct fields when message.text is present', async () => {
    const repo = makeRepo();
    const svc = new FacebookService(repo, makeConfig({}));

    await svc.processEvent('tenant-1', {
      entry: [
        {
          id: 'page-42',
          messaging: [
            { sender: { id: 'psid-99' }, message: { text: 'Is the room available?' } },
          ],
        },
      ],
    });

    expect(repo.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fbPageId: 'page-42',
      fbSenderPsid: 'psid-99',
      messageText: 'Is the room available?',
      matchedCustomerId: null,
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('skips messaging events that have no message.text', async () => {
    const repo = makeRepo();
    const svc = new FacebookService(repo, makeConfig({}));

    await svc.processEvent('tenant-1', {
      entry: [
        {
          id: 'page-42',
          messaging: [
            { sender: { id: 'psid-1' }, message: {} },               // no text
            { sender: { id: 'psid-2' } },                             // no message at all
            { sender: { id: 'psid-3' }, message: { text: 'Hi!' } },  // valid
          ],
        },
      ],
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
