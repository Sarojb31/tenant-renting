import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CustomersService } from '../customers/customers.service';

jest.mock('argon2');
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

function makeAuthService() {
  const usersService = { findByEmail: jest.fn(), setRefreshTokenHash: jest.fn(), updateLastLogin: jest.fn() } as unknown as UsersService;
  const customersService = {
    findByEmail: jest.fn(),
    setRefreshTokenHash: jest.fn(),
    upsertByPhone: jest.fn(),
  } as unknown as CustomersService;
  const jwtService = {
    sign: jest.fn().mockReturnValue('access.token.here'),
    verify: jest.fn(),
  } as unknown as JwtService;
  const configService = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
  const otpRepo = { delete: jest.fn(), save: jest.fn(), findOne: jest.fn(), update: jest.fn(), increment: jest.fn() } as any;
  const smsProvider = { send: jest.fn() } as any;

  const service = new AuthService(usersService, customersService, jwtService, configService, otpRepo, smsProvider);

  return { service, usersService, customersService, jwtService };
}

function makeRes() {
  return { cookie: jest.fn() } as any;
}

describe('AuthService.customerEmailLogin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestException when tenantId is null', async () => {
    const { service } = makeAuthService();
    await expect(
      service.customerEmailLogin({ email: 'a@b.com', password: 'pass' }, null, makeRes()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws UnauthorizedException for unknown email', async () => {
    const { service, customersService } = makeAuthService();
    (customersService.findByEmail as jest.Mock).mockResolvedValue(null);
    mockedArgon2.verify.mockResolvedValue(false);

    await expect(
      service.customerEmailLogin({ email: 'x@y.com', password: 'pass' }, 'tenant-1', makeRes()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when customer has no password_hash', async () => {
    const { service, customersService } = makeAuthService();
    (customersService.findByEmail as jest.Mock).mockResolvedValue({
      id: 'c1', email: 'a@b.com', name: null, passwordHash: null, tenantId: 'tenant-1',
    });
    mockedArgon2.verify.mockResolvedValue(false);

    await expect(
      service.customerEmailLogin({ email: 'a@b.com', password: 'wrong' }, 'tenant-1', makeRes()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns accessToken and customer on valid credentials', async () => {
    const { service, customersService, jwtService } = makeAuthService();
    const customer = {
      id: 'c1', email: 'demo@customer.com', name: 'Demo', passwordHash: 'hashed', tenantId: 'tenant-1',
    };
    (customersService.findByEmail as jest.Mock).mockResolvedValue(customer);
    (customersService.setRefreshTokenHash as jest.Mock).mockResolvedValue(undefined);
    mockedArgon2.verify.mockResolvedValue(true);
    mockedArgon2.hash.mockResolvedValue('refresh.hash');

    const res = makeRes();
    const result = await service.customerEmailLogin(
      { email: 'demo@customer.com', password: 'Customer123!' },
      'tenant-1',
      res,
    );

    expect(result.accessToken).toBe('access.token.here');
    expect(result.customer.id).toBe('c1');
    expect(result.customer.email).toBe('demo@customer.com');
    expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ type: 'customer' }));
    expect(res.cookie).toHaveBeenCalled();
  });
});
