/**
 * Auth integration tests — Plan Section 4.9, 14.
 *
 * Tests staff/admin JWT auth: login, refresh token rotation.
 * Uses a real Postgres connection (docker compose up -d postgres required).
 *
 * Run: pnpm --filter @roomfinder/backend test:integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { Tenant } from '../src/modules/tenants/tenant.entity';
import { User } from '../src/modules/users/user.entity';
import { Customer } from '../src/modules/customers/customer.entity';
import { PhoneOtpCode } from '../src/modules/auth/entities/phone-otp-code.entity';
import { Listing } from '../src/modules/listings/listing.entity';
import { ListingImage } from '../src/modules/listings/listing-image.entity';
import { CustomerPreference } from '../src/modules/customers/customer-preference.entity';
import { SmsLog } from '../src/modules/matching/sms-log.entity';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { UsersService } from '../src/modules/users/users.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { TenantContextService } from '../src/common/tenant-context.service';
import { TenantContextInterceptor } from '../src/common/interceptors/tenant-context.interceptor';
import { TenantsService } from '../src/modules/tenants/tenants.service';
import { SMS_PROVIDER } from '../src/modules/sms/sms.provider.interface';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { APP_INTERCEPTOR } from '@nestjs/core';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

const TEST_JWT_SECRET = 'test-access-secret-minimum-32-characters!!';
const TEST_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              nodeEnv: 'test',
              jwt: {
                accessSecret: TEST_JWT_SECRET,
                refreshSecret: TEST_REFRESH_SECRET,
                accessExpiry: '15m',
                refreshExpiry: '7d',
              },
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: TEST_DB_URL,
          synchronize: true,
          dropSchema: true,
          entities: [Tenant, User, Customer, CustomerPreference, PhoneOtpCode, Listing, ListingImage, SmsLog],
          logging: false,
        }),
        TypeOrmModule.forFeature([Tenant, User, Customer, CustomerPreference, PhoneOtpCode]),
        PassportModule,
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        TenantContextService,
        TenantsService,
        UsersService,
        CustomersService,
        AuthService,
        JwtStrategy,
        { provide: SMS_PROVIDER, useValue: { send: jest.fn() } },
        {
          provide: APP_INTERCEPTOR,
          useClass: TenantContextInterceptor,
        },
      ],
      controllers: [AuthController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM "users" WHERE email LIKE 'authtest-%'`);
    await dataSource.query(`DELETE FROM "tenants" WHERE subdomain LIKE 'authtest-%'`);
  });

  async function seedUser(overrides: Partial<{
    email: string; password: string; role: UserRole; tenantId: string | null;
  }> = {}) {
    const password = overrides.password ?? 'password1234';
    const email = overrides.email ?? 'authtest-staff@example.com';
    const passwordHash = await argon2.hash(password);
    const userRepo = dataSource.getRepository(User);
    return userRepo.save({
      name: 'Test User',
      email,
      passwordHash,
      role: overrides.role ?? UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      tenantId: overrides.tenantId ?? null,
    });
  }

  // ---------------------------------------------------------------------------
  describe('POST /auth/login', () => {
    it('returns accessToken and sets refresh_token cookie on valid credentials', async () => {
      await seedUser({ email: 'authtest-login@example.com', password: 'correct-password' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'authtest-login@example.com', password: 'correct-password' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');

      const cookies: string | string[] = res.headers['set-cookie'] ?? [];
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('refresh_token='))
        : undefined;
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('returns 401 for wrong password', async () => {
      await seedUser({ email: 'authtest-wrongpw@example.com', password: 'correctpw' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'authtest-wrongpw@example.com', password: 'wrongpw' })
        .expect(401);
    });

    it('returns 401 for non-existent email (same shape as wrong password)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'authtest-nobody@example.com', password: 'anypassword' })
        .expect(401);
    });

    it('returns 400 for missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'notanemail' })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('POST /auth/refresh', () => {
    it('issues new accessToken and rotates refresh_token cookie', async () => {
      await seedUser({ email: 'authtest-refresh@example.com', password: 'pw12345678' });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'authtest-refresh@example.com', password: 'pw12345678' })
        .expect(200);

      const cookies: string | string[] = loginRes.headers['set-cookie'] ?? [];
      const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieHeader)
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');

      // New refresh cookie must be set
      const newCookies: string | string[] = refreshRes.headers['set-cookie'] ?? [];
      const newRefreshCookie = Array.isArray(newCookies)
        ? newCookies.find((c: string) => c.startsWith('refresh_token='))
        : undefined;
      expect(newRefreshCookie).toBeDefined();
    });

    it('returns 401 with no cookie', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });

    it('returns 401 with a tampered token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=totallyinvalidtoken')
        .expect(401);
    });
  });
});
