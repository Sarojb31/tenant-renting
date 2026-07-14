import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { SparrowSmsAdapter } from './sparrow-sms.adapter';

jest.mock('axios');
const axiosPost = axios.post as jest.Mock;

function makeAdapter(overrides: Record<string, string> = {}): SparrowSmsAdapter {
  const config = {
    get: (key: string) => ({ 'sms.sparrow.apiKey': 'test-key', ...overrides }[key]),
  } as unknown as ConfigService;
  return new SparrowSmsAdapter(config);
}

describe('SparrowSmsAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns sent status on response_code 200', async () => {
    axiosPost.mockResolvedValue({ data: { response_code: 200, message: 'OK', messageid: 42 } });
    const adapter = makeAdapter();
    const result = await adapter.send('+9779800000001', 'Hello');
    expect(result.status).toBe('sent');
    expect(result.providerMessageId).toBe('42');
    expect(axiosPost).toHaveBeenCalledTimes(1);
  });

  it('returns failed status on non-200 response_code', async () => {
    axiosPost.mockResolvedValue({ data: { response_code: 400, message: 'Invalid token' } });
    const adapter = makeAdapter();
    const result = await adapter.send('+9779800000001', 'Hello');
    expect(result.status).toBe('failed');
  });

  it('throws when axios throws (network error)', async () => {
    axiosPost.mockRejectedValue(new Error('Network timeout'));
    const adapter = makeAdapter();
    await expect(adapter.send('+9779800000001', 'Hello')).rejects.toThrow('Network timeout');
  });

  it('includes token and text in POST body', async () => {
    axiosPost.mockResolvedValue({ data: { response_code: 200, messageid: 1 } });
    const adapter = makeAdapter();
    await adapter.send('+9779800000001', 'Test message');
    const body: URLSearchParams = axiosPost.mock.calls[0][1];
    expect(body.get('token')).toBe('test-key');
    expect(body.get('text')).toBe('Test message');
    expect(body.get('to')).toBe('+9779800000001');
  });

  it('getDeliveryStatus always returns pending (no Sparrow lookup API)', async () => {
    const adapter = makeAdapter();
    expect(await adapter.getDeliveryStatus('any-id')).toBe('pending');
  });
});
