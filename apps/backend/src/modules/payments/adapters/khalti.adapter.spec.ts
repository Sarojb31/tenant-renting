import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { KhaltiAdapter } from './khalti.adapter';

jest.mock('axios');
const axiosPost = axios.post as jest.Mock;

function makeAdapter(): KhaltiAdapter {
  const config = {
    get: (key: string) =>
      ({ 'payments.khalti.secretKey': 'test-live-key' }[key]),
  } as unknown as ConfigService;
  return new KhaltiAdapter(config);
}

describe('KhaltiAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('createPaymentIntent calls Khalti initiate API and returns redirectUrl + providerRef', async () => {
    axiosPost.mockResolvedValueOnce({
      data: { pidx: 'pidx-abc123', payment_url: 'https://khalti.com/pay/pidx-abc123' },
    });
    const adapter = makeAdapter();
    const result = await adapter.createPaymentIntent(2000, 'NPR', { bookingId: 'book-uuid' });
    expect(result.redirectUrl).toBe('https://khalti.com/pay/pidx-abc123');
    expect(result.providerRef).toBe('pidx-abc123');
    expect(axiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/epayment/initiate/'),
      expect.objectContaining({ purchase_order_id: 'book-uuid', amount: 200000 }),
      expect.objectContaining({ headers: { Authorization: 'Key test-live-key' } }),
    );
  });

  it('createPaymentIntent throws when Khalti API errors', async () => {
    axiosPost.mockRejectedValueOnce(new Error('Unauthorized'));
    const adapter = makeAdapter();
    await expect(adapter.createPaymentIntent(1000, 'NPR', {})).rejects.toThrow('Unauthorized');
  });

  it('verifyWebhookSignature always returns true (lookup-based verification)', () => {
    const adapter = makeAdapter();
    expect(adapter.verifyWebhookSignature({}, '')).toBe(true);
  });

  it('handleWebhook returns success when lookup returns Completed', async () => {
    axiosPost.mockResolvedValueOnce({
      data: { pidx: 'pidx-xyz', status: 'Completed', transaction_id: 'TX-ok' },
    });
    const adapter = makeAdapter();
    const result = await adapter.handleWebhook({ pidx: 'pidx-xyz' });
    expect(result.status).toBe('success');
    expect(result.providerRef).toBe('pidx-xyz');
  });

  it('handleWebhook returns failed when lookup returns Pending', async () => {
    axiosPost.mockResolvedValueOnce({
      data: { pidx: 'pidx-pending', status: 'Pending', transaction_id: '' },
    });
    const adapter = makeAdapter();
    const result = await adapter.handleWebhook({ pidx: 'pidx-pending' });
    expect(result.status).toBe('failed');
  });
});
