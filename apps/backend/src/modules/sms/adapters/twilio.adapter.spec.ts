import { ConfigService } from '@nestjs/config';

// Mock the twilio module before importing the adapter
const mockCreate = jest.fn();
const mockFetch = jest.fn();
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: Object.assign(jest.fn(() => ({ fetch: mockFetch })), { create: mockCreate }),
  }));
});

import { TwilioAdapter } from './twilio.adapter';

function makeAdapter(): TwilioAdapter {
  const config = {
    get: (key: string) =>
      ({
        'sms.twilio.accountSid': 'ACtest',
        'sms.twilio.authToken': 'token',
        'sms.twilio.from': '+15005550006',
      }[key]),
  } as unknown as ConfigService;
  return new TwilioAdapter(config);
}

describe('TwilioAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns sent + SID on successful create', async () => {
    mockCreate.mockResolvedValue({ sid: 'SM-test-sid', status: 'queued' });
    const adapter = makeAdapter();
    const result = await adapter.send('+14155551234', 'Hello');
    expect(result.status).toBe('sent');
    expect(result.providerMessageId).toBe('SM-test-sid');
  });

  it('throws when client.messages.create throws', async () => {
    mockCreate.mockRejectedValue(new Error('Invalid credentials'));
    const adapter = makeAdapter();
    await expect(adapter.send('+14155551234', 'Hello')).rejects.toThrow('Invalid credentials');
  });

  it('getDeliveryStatus returns delivered', async () => {
    mockFetch.mockResolvedValue({ status: 'delivered' });
    const adapter = makeAdapter();
    expect(await adapter.getDeliveryStatus('SM-123')).toBe('delivered');
  });

  it('getDeliveryStatus returns failed for undelivered', async () => {
    mockFetch.mockResolvedValue({ status: 'undelivered' });
    const adapter = makeAdapter();
    expect(await adapter.getDeliveryStatus('SM-123')).toBe('failed');
  });

  it('getDeliveryStatus returns pending for in-flight statuses', async () => {
    mockFetch.mockResolvedValue({ status: 'sending' });
    const adapter = makeAdapter();
    expect(await adapter.getDeliveryStatus('SM-123')).toBe('pending');
  });
});
