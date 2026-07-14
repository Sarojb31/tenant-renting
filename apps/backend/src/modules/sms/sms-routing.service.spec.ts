import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsRoutingService } from './sms-routing.service';
import { SparrowSmsAdapter } from './adapters/sparrow-sms.adapter';
import { AakashSmsAdapter } from './adapters/aakash-sms.adapter';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { NullSmsAdapter } from './adapters/null-sms.adapter';

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
}

function makeRouter(configOverrides: Record<string, string | undefined> = {}): SmsRoutingService {
  const config = makeConfig(configOverrides);
  return new SmsRoutingService(
    config,
    new SparrowSmsAdapter(config),
    new AakashSmsAdapter(config),
    new TwilioAdapter(config),
    new NullSmsAdapter(),
  );
}

describe('SmsRoutingService.resolveAdapter', () => {
  it('returns SparrowSmsAdapter for +977 when sparrow key configured', () => {
    const router = makeRouter({ 'sms.sparrow.apiKey': 'sk-test' });
    expect(router.resolveAdapter('+9779800000001')).toBeInstanceOf(SparrowSmsAdapter);
  });

  it('returns AakashSmsAdapter for +977 when sparrow absent but aakash configured', () => {
    const router = makeRouter({ 'sms.aakash.apiKey': 'ak-test' });
    expect(router.resolveAdapter('+9779800000001')).toBeInstanceOf(AakashSmsAdapter);
  });

  it('returns NullSmsAdapter for +977 when neither Nepal provider configured', () => {
    const router = makeRouter({});
    expect(router.resolveAdapter('+9779800000001')).toBeInstanceOf(NullSmsAdapter);
  });

  it('returns TwilioAdapter for non-+977 when Twilio configured', () => {
    const router = makeRouter({ 'sms.twilio.accountSid': 'AC-test' });
    expect(router.resolveAdapter('+14155551234')).toBeInstanceOf(TwilioAdapter);
  });

  it('returns NullSmsAdapter for non-+977 when Twilio absent', () => {
    const router = makeRouter({});
    expect(router.resolveAdapter('+14155551234')).toBeInstanceOf(NullSmsAdapter);
  });

  it('handles phone without leading + (adds + prefix before matching)', () => {
    const router = makeRouter({ 'sms.sparrow.apiKey': 'sk-test' });
    expect(router.resolveAdapter('9779800000001')).toBeInstanceOf(SparrowSmsAdapter);
  });

  it('prefers Sparrow over Aakash when both configured', () => {
    const router = makeRouter({
      'sms.sparrow.apiKey': 'sk-test',
      'sms.aakash.apiKey': 'ak-test',
    });
    expect(router.resolveAdapter('+9779800000001')).toBeInstanceOf(SparrowSmsAdapter);
  });

  it('does not use Sparrow for +1 numbers even if sparrow key set', () => {
    const router = makeRouter({
      'sms.sparrow.apiKey': 'sk-test',
      'sms.twilio.accountSid': 'AC-test',
    });
    expect(router.resolveAdapter('+14155551234')).toBeInstanceOf(TwilioAdapter);
  });
});
