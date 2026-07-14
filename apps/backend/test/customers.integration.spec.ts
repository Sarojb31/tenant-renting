/**
 * Customers CRM integration tests — Plan Section 4.4, 14, 17.
 *
 * Tests GET/POST /customers, PATCH /customers/:id, PATCH /customers/:id/preferences.
 * Includes cross-tenant-isolation test (§17 requirement).
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
import { CustomerPreference } from '../src/modules/customers/customer-preference.entity';
import { SmsLog } from '../src/modules/matching/sms-log.entity';
import { PhoneOtpCode } from '../src/modules/auth/entities/phone-otp-code.entity';
import { Listing } from '../src/modules/listings/listing.entity';
import { ListingImage } from '../src/modules/listings/listing-image.entity';
import { CustomersService } from '../src/modules/customers/customers.service';
import { CustomersController } from '../src/modules/customers/customers.controller';
import { TenantsService } from '../src/modules/tenants/tenants.service';
import { UsersService } from '../src/modules/users/users.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { TenantContextService } from '../src/common/tenant-context.service';
import { TenantContextInterceptor } from '../src/common/interceptors/tenant-context.interceptor';
import { SMS_PROVIDER } from '../src/modules/sms/sms.provider.interface';
import { FILE_STORAGE_PROVIDER } from '../src/modules/storage/file-storage.provider';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { TenantStatus } from '../src/common/enums/tenant-status.enum';
import { RoomType } from '../src/common/enums/room-type.enum';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

const TEST_JWT_SECRET = 'test-access-secret-minimum-32-characters!!';
const TEST_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

describe('Customers CRM (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let tenantAId: string;
  let tenantBId: string;
  let staffUserId: string;
  let customerAId: string;

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
        { provide: FILE_STORAGE_PROVIDER, useValue: { upload: jest.fn(), delete: jest.fn() } },
        { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
      ],
      controllers: [CustomersController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    jwtService = moduleRef.get<JwtService>(JwtService);

    const tenantRepo = dataSource.getRepository(Tenant);
    const tenantA = await tenantRepo.save({
      name: 'CRM Co A', subdomain: 'crmtest-a',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantB = await tenantRepo.save({
      name: 'CRM Co B', subdomain: 'crmtest-b',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const staffUser = await dataSource.getRepository(User).save({
      name: 'CRM Staff',
      email: 'crmtest-staff@tenant-a.com',
      passwordHash: 'dummy',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      tenantId: tenantAId,
    });
    staffUserId = staffUser.id;

    // Pre-seed a customer in tenant A for self-access tests
    const customerA = await dataSource.getRepository(Customer).save({
      phone: '+9779800001111',
      tenantId: tenantAId,
      phoneVerified: true,
      name: 'Seeded Customer',
    });
    customerAId = customerA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean preferences between tests; keep seeded customers
    await dataSource.query(`DELETE FROM "customer_preferences"`);
    await dataSource.query(
      `DELETE FROM "customers" WHERE tenant_id IN ($1,$2) AND id != $3`,
      [tenantAId, tenantBId, customerAId],
    );
  });

  function staffToken(tenantId = tenantAId) {
    return jwtService.sign({
      sub: staffUserId,
      email: 'crmtest-staff@tenant-a.com',
      role: UserRole.STAFF,
      tenantId,
      type: 'user',
    });
  }

  function customerToken(customerId = customerAId, tenantId = tenantAId) {
    return jwtService.sign({
      sub: customerId,
      email: '',
      role: UserRole.CUSTOMER,
      tenantId,
      type: 'customer',
    });
  }

  // ---------------------------------------------------------------------------
  describe('POST /customers', () => {
    it('creates customer and returns 201 (Staff)', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ phone: '+9779800002222', name: 'New Customer' })
        .expect(201);

      expect(res.body.phone).toBe('+9779800002222');
      expect(res.body.tenantId).toBe(tenantAId);
    });

    it('returns 409 for duplicate phone within same tenant', async () => {
      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ phone: '+9779800002222' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ phone: '+9779800002222' })
        .expect(409);
    });

    it('returns 400 for invalid phone', async () => {
      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ phone: 'not-a-phone' })
        .expect(400);
    });

    it('returns 403 for customer role', async () => {
      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ phone: '+9779800003333' })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe('GET /customers', () => {
    it('returns tenant-scoped customer list (Staff)', async () => {
      const res = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((c: { tenantId: string }) => c.tenantId === tenantAId)).toBe(true);
    });

    it('returns 403 for customer role', async () => {
      await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe('GET /customers/:id', () => {
    it('staff can get any customer in their tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/customers/${customerAId}`)
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.id).toBe(customerAId);
    });

    it('customer can get their own record', async () => {
      const res = await request(app.getHttpServer())
        .get(`/customers/${customerAId}`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.id).toBe(customerAId);
    });

    it('customer cannot get another customer record (403)', async () => {
      const other = await dataSource.getRepository(Customer).save({
        phone: '+9779800004444',
        tenantId: tenantAId,
        phoneVerified: true,
      });

      await request(app.getHttpServer())
        .get(`/customers/${other.id}`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /customers/:id', () => {
    it('staff updates customer name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/customers/${customerAId}`)
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('customer updates their own name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/customers/${customerAId}`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ name: 'Self Updated' })
        .expect(200);

      expect(res.body.name).toBe('Self Updated');
    });

    it('customer cannot update another customer (403)', async () => {
      const other = await dataSource.getRepository(Customer).save({
        phone: '+9779800005555',
        tenantId: tenantAId,
        phoneVerified: true,
      });

      await request(app.getHttpServer())
        .patch(`/customers/${other.id}`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /customers/:id/preferences', () => {
    it('creates preference on first call', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/customers/${customerAId}/preferences`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({
          locations: ['Baneshwor', 'Koteshwor'],
          budgetMin: '5000',
          budgetMax: '10000',
          roomType: RoomType.SINGLE,
        })
        .expect(200);

      expect(res.body.customerId).toBe(customerAId);
      expect(res.body.locations).toEqual(['Baneshwor', 'Koteshwor']);
      expect(res.body.roomType).toBe(RoomType.SINGLE);
    });

    it('updates preference on subsequent call', async () => {
      await request(app.getHttpServer())
        .patch(`/customers/${customerAId}/preferences`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ budgetMin: '3000', budgetMax: '7000' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/customers/${customerAId}/preferences`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ budgetMin: '8000', budgetMax: '15000' })
        .expect(200);

      // budget updated, customer_id unchanged
      expect(res.body.customerId).toBe(customerAId);
    });

    it('staff can upsert preference for any tenant customer', async () => {
      await request(app.getHttpServer())
        .patch(`/customers/${customerAId}/preferences`)
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ active: false })
        .expect(200);
    });

    it('returns 400 for invalid budgetMin (non-numeric)', async () => {
      await request(app.getHttpServer())
        .patch(`/customers/${customerAId}/preferences`)
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ budgetMin: 'abc' })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Cross-tenant isolation (Plan §17)', () => {
    it('GET /customers under tenant B cannot see tenant A customers', async () => {
      const tenantBStaff = await dataSource.getRepository(User).save({
        name: 'B Staff',
        email: `crmtest-staff-b-${Date.now()}@tenant-b.com`,
        passwordHash: 'dummy',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        tenantId: tenantBId,
      });

      const res = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${jwtService.sign({
          sub: tenantBStaff.id,
          email: tenantBStaff.email,
          role: UserRole.STAFF,
          tenantId: tenantBId,
          type: 'user',
        })}`)
        .set('x-tenant-id', tenantBId)
        .expect(200);

      expect(res.body.every((c: { tenantId: string }) => c.tenantId === tenantBId)).toBe(true);
      expect(res.body.find((c: { id: string }) => c.id === customerAId)).toBeUndefined();
    });

    it('PATCH /customers/:id under tenant B returns 404 for tenant A customer', async () => {
      const tenantBStaff = await dataSource.getRepository(User).save({
        name: 'B Staff 2',
        email: `crmtest-staff-b2-${Date.now()}@tenant-b.com`,
        passwordHash: 'dummy',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        tenantId: tenantBId,
      });

      await request(app.getHttpServer())
        .patch(`/customers/${customerAId}`)
        .set('Authorization', `Bearer ${jwtService.sign({
          sub: tenantBStaff.id,
          email: tenantBStaff.email,
          role: UserRole.STAFF,
          tenantId: tenantBId,
          type: 'user',
        })}`)
        .set('x-tenant-id', tenantBId)
        .send({ name: 'Cross-tenant hack' })
        .expect(404);
    });

    it('PATCH /customers/:id/preferences under tenant B returns 404 for tenant A customer', async () => {
      const tenantBStaff = await dataSource.getRepository(User).save({
        name: 'B Staff 3',
        email: `crmtest-staff-b3-${Date.now()}@tenant-b.com`,
        passwordHash: 'dummy',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        tenantId: tenantBId,
      });

      await request(app.getHttpServer())
        .patch(`/customers/${customerAId}/preferences`)
        .set('Authorization', `Bearer ${jwtService.sign({
          sub: tenantBStaff.id,
          email: tenantBStaff.email,
          role: UserRole.STAFF,
          tenantId: tenantBId,
          type: 'user',
        })}`)
        .set('x-tenant-id', tenantBId)
        .send({ active: false })
        .expect(404);
    });
  });
});
