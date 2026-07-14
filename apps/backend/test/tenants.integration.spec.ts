/**
 * Tenants integration tests — Plan Section 4.1, 14.
 *
 * Tests POST /tenants (onboard), GET /tenants/:id, PATCH /tenants/:id.
 * Uses a real Postgres connection (docker compose up -d postgres required).
 *
 * Run: pnpm --filter @roomfinder/backend test:integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Tenant } from '../src/modules/tenants/tenant.entity';
import { User } from '../src/modules/users/user.entity';
import { Customer } from '../src/modules/customers/customer.entity';
import { PhoneOtpCode } from '../src/modules/auth/entities/phone-otp-code.entity';
import { Listing } from '../src/modules/listings/listing.entity';
import { ListingImage } from '../src/modules/listings/listing-image.entity';
import { CustomerPreference } from '../src/modules/customers/customer-preference.entity';
import { SmsLog } from '../src/modules/matching/sms-log.entity';
import { TenantsService } from '../src/modules/tenants/tenants.service';
import { TenantsController } from '../src/modules/tenants/tenants.controller';
import { UsersService } from '../src/modules/users/users.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { TenantContextService } from '../src/common/tenant-context.service';
import { TenantContextInterceptor } from '../src/common/interceptors/tenant-context.interceptor';
import { SMS_PROVIDER } from '../src/modules/sms/sms.provider.interface';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { TenantStatus } from '../src/common/enums/tenant-status.enum';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

const TEST_JWT_SECRET = 'test-access-secret-minimum-32-characters!!';
const TEST_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

describe('Tenants (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

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
      controllers: [TenantsController, AuthController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Seed super admin — validate() checks DB, so it must exist
    await dataSource.query(`
      INSERT INTO "users" (id, name, email, password_hash, role, status)
      VALUES ($1, 'Super Admin', 'superadmin@platform.com', 'dummy', 'super_admin', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [SUPER_ADMIN_ID]);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM "users" WHERE email LIKE 'tentest-%'`);
    await dataSource.query(`DELETE FROM "users" WHERE email LIKE '%-admin@tentest-%'`);
    await dataSource.query(`DELETE FROM "tenants" WHERE subdomain LIKE 'tentest-%'`);
  });

  function superAdminToken() {
    return jwtService.sign({
      sub: SUPER_ADMIN_ID,
      email: 'superadmin@platform.com',
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
      type: 'user',
    });
  }

  function companyAdminToken(tenantId: string, userId: string) {
    return jwtService.sign({
      sub: userId,
      email: 'tentest-companyadmin@example.com',
      role: UserRole.COMPANY_ADMIN,
      tenantId,
      type: 'user',
    });
  }

  // ---------------------------------------------------------------------------
  describe('POST /tenants', () => {
    it('creates tenant + admin user, returns 201 (Super Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({
          name: 'Test Company',
          subdomain: 'tentest-co1',
          country: 'NP',
          defaultCurrency: 'NPR',
          adminEmail: 'admin@tentest-co1.com',
          adminName: 'Test Admin',
          adminPassword: 'securepass123',
        })
        .expect(201);

      expect(res.body.tenant.subdomain).toBe('tentest-co1');
      expect(res.body.adminUser.email).toBe('admin@tentest-co1.com');
      expect(res.body.adminUser).not.toHaveProperty('passwordHash');
      expect(res.body.adminUser).not.toHaveProperty('refreshTokenHash');
    });

    it('returns 409 for duplicate subdomain', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({
          name: 'Test Company Dup',
          subdomain: 'tentest-dup',
          country: 'NP',
          defaultCurrency: 'NPR',
          adminEmail: 'admin@tentest-dup.com',
          adminName: 'Admin',
          adminPassword: 'securepass123',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({
          name: 'Another Company',
          subdomain: 'tentest-dup',
          country: 'NP',
          defaultCurrency: 'NPR',
          adminEmail: 'admin2@tentest-dup.com',
          adminName: 'Admin2',
          adminPassword: 'securepass123',
        })
        .expect(409);
    });

    it('returns 401 with no auth token', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({ name: 'Anon Co', subdomain: 'tentest-anon', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'x@x.com', adminName: 'X', adminPassword: 'pass12345' })
        .expect(401);
    });

    it('returns 403 when called by company admin', async () => {
      // First create a tenant to get a valid tenantId
      const tenantRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({
          name: 'Seed Company',
          subdomain: 'tentest-seed1',
          country: 'NP',
          defaultCurrency: 'NPR',
          adminEmail: 'admin@tentest-seed1.com',
          adminName: 'Admin',
          adminPassword: 'securepass123',
        })
        .expect(201);

      const tenantId = tenantRes.body.tenant.id;
      const userId = tenantRes.body.adminUser.id;
      const token = companyAdminToken(tenantId, userId);

      await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hack Co', subdomain: 'tentest-hack', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'h@h.com', adminName: 'H', adminPassword: 'pass12345' })
        .expect(403);
    });

    it('returns 400 for invalid subdomain characters', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'X', subdomain: 'UPPERCASE_BAD!', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'x@x.com', adminName: 'X', adminPassword: 'pass12345' })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('GET /tenants/:id', () => {
    it('super admin can get any tenant', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'GetTest Co', subdomain: 'tentest-get1', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-get1.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/tenants/${createRes.body.tenant.id}`)
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .expect(200);
    });

    it('company admin can get their own tenant', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'OwnGet Co', subdomain: 'tentest-ownget', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-ownget.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);

      const tenantId = createRes.body.tenant.id;
      const userId = createRes.body.adminUser.id;
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${companyAdminToken(tenantId, userId)}`)
        .expect(200);
    });

    it('company admin cannot access a different tenant', async () => {
      const t1 = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'T1', subdomain: 'tentest-t1', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-t1.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);
      const t2 = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'T2', subdomain: 'tentest-t2', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-t2.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/tenants/${t2.body.tenant.id}`)
        .set('Authorization', `Bearer ${companyAdminToken(t1.body.tenant.id, t1.body.adminUser.id)}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /tenants/:id', () => {
    it('company admin can update own tenant name', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'Patch Me', subdomain: 'tentest-patch1', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-patch1.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);

      const tenantId = createRes.body.tenant.id;
      const userId = createRes.body.adminUser.id;
      const res = await request(app.getHttpServer())
        .patch(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${companyAdminToken(tenantId, userId)}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('company admin cannot change status (stripped from update)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'Status Test', subdomain: 'tentest-status', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-status.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);

      const tenantId = createRes.body.tenant.id;
      const userId = createRes.body.adminUser.id;
      const res = await request(app.getHttpServer())
        .patch(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${companyAdminToken(tenantId, userId)}`)
        .send({ status: TenantStatus.ACTIVE })
        .expect(200);

      // status should remain 'trial' since company admin cannot change it
      expect(res.body.status).toBe(TenantStatus.TRIAL);
    });

    it('super admin can change status', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ name: 'Status SA', subdomain: 'tentest-statsa', country: 'NP', defaultCurrency: 'NPR', adminEmail: 'admin@tentest-statsa.com', adminName: 'A', adminPassword: 'pass12345' })
        .expect(201);

      const tenantId = createRes.body.tenant.id;
      const res = await request(app.getHttpServer())
        .patch(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${superAdminToken()}`)
        .send({ status: TenantStatus.ACTIVE })
        .expect(200);

      expect(res.body.status).toBe(TenantStatus.ACTIVE);
    });
  });
});
