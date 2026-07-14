/**
 * Listings integration tests — Plan Section 4.3, 14, 17.
 *
 * Tests CRUD endpoints + search/filter + image upload + cross-tenant isolation (§17).
 * Uses real Postgres; SMS_PROVIDER and FILE_STORAGE_PROVIDER are mocked.
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
import { ListingsService } from '../src/modules/listings/listings.service';
import { ListingsController } from '../src/modules/listings/listings.controller';
import { TenantsService } from '../src/modules/tenants/tenants.service';
import { UsersService } from '../src/modules/users/users.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { TenantContextService } from '../src/common/tenant-context.service';
import { TenantContextInterceptor } from '../src/common/interceptors/tenant-context.interceptor';
import { getQueueToken } from '@nestjs/bullmq';
import { SMS_PROVIDER } from '../src/modules/sms/sms.provider.interface';
import { FILE_STORAGE_PROVIDER } from '../src/modules/storage/file-storage.provider';
import { MATCHING_QUEUE } from '../src/modules/matching/matching.processor';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { TenantStatus } from '../src/common/enums/tenant-status.enum';
import { RoomType } from '../src/common/enums/room-type.enum';
import { ListingStatus } from '../src/common/enums/listing-status.enum';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

const TEST_JWT_SECRET = 'test-access-secret-minimum-32-characters!!';
const TEST_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

const BASE_LISTING = {
  title: 'Cozy Single Room',
  roomType: RoomType.SINGLE,
  rentAmount: 8000,
  city: 'Kathmandu',
  status: ListingStatus.PUBLISHED,
};

describe('Listings (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let tenantAId: string;
  let tenantBId: string;
  let staffUserId: string;
  let customerUserId: string;
  let uploadMock: jest.Mock;

  beforeAll(async () => {
    uploadMock = jest.fn().mockResolvedValue('https://mock.storage/image.jpg');

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
        TypeOrmModule.forFeature([Tenant, User, Customer, CustomerPreference, PhoneOtpCode, Listing, ListingImage]),
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
        ListingsService,
        JwtStrategy,
        { provide: SMS_PROVIDER, useValue: { send: jest.fn() } },
        { provide: FILE_STORAGE_PROVIDER, useValue: { upload: uploadMock, delete: jest.fn() } },
        { provide: getQueueToken(MATCHING_QUEUE), useValue: { add: jest.fn() } },
        { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
      ],
      controllers: [ListingsController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    jwtService = moduleRef.get<JwtService>(JwtService);

    // Seed two tenants for isolation testing
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenantA = await tenantRepo.save({
      name: 'Listings Co A', subdomain: 'lsttest-a',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantB = await tenantRepo.save({
      name: 'Listings Co B', subdomain: 'lsttest-b',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    // Seed staff user for tenant A
    const userRepo = dataSource.getRepository(User);
    const staffUser = await userRepo.save({
      name: 'Staff User',
      email: 'lsttest-staff@tenant-a.com',
      passwordHash: 'dummy',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      tenantId: tenantAId,
    });
    staffUserId = staffUser.id;

    // Seed a customer (for role-check test)
    const customerUser = await dataSource.getRepository(Customer).save({
      phone: '+9779800099001',
      tenantId: tenantAId,
      phoneVerified: true,
    });
    customerUserId = customerUser.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM "listing_images"
      WHERE listing_id IN (SELECT id FROM listings WHERE tenant_id IN ($1, $2))`,
      [tenantAId, tenantBId]);
    await dataSource.query(`DELETE FROM "listings" WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
    uploadMock.mockClear();
  });

  function staffToken(tenantId = tenantAId, userId = staffUserId) {
    return jwtService.sign({
      sub: userId,
      email: 'lsttest-staff@tenant-a.com',
      role: UserRole.STAFF,
      tenantId,
      type: 'user',
    });
  }

  function customerToken() {
    return jwtService.sign({
      sub: customerUserId,
      email: '',
      role: UserRole.CUSTOMER,
      tenantId: tenantAId,
      type: 'customer',
    });
  }

  // ---------------------------------------------------------------------------
  describe('POST /listings', () => {
    it('creates listing and returns 201 (Staff)', async () => {
      const res = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      expect(res.body.title).toBe(BASE_LISTING.title);
      expect(res.body.status).toBe(ListingStatus.PUBLISHED);
      expect(res.body.tenantId).toBe(tenantAId);
      expect(res.body.createdBy).toBe(staffUserId);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(401);
    });

    it('returns 403 for customer role', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${customerToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(403);
    });

    it('returns 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ title: 'No room type' })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('GET /listings', () => {
    it('returns only published listings for this tenant (public)', async () => {
      // Create a published listing
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      // Create a draft — should NOT appear in public search
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, title: 'Draft Room', status: ListingStatus.DRAFT })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/listings')
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe(ListingStatus.PUBLISHED);
    });

    it('returns empty array without tenant context', async () => {
      const res = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('filters by city', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, city: 'Pokhara', title: 'Pokhara Room' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, city: 'Kathmandu', title: 'Ktm Room' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/listings?city=Pokhara')
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].city).toBe('Pokhara');
    });

    it('filters by roomType', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, roomType: RoomType.SHARED, title: 'Shared Room' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, roomType: RoomType.SINGLE, title: 'Single Room' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/listings?roomType=${RoomType.SHARED}`)
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].roomType).toBe(RoomType.SHARED);
    });

    it('filters by rent range', async () => {
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, rentAmount: 5000, title: 'Cheap Room' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, rentAmount: 15000, title: 'Expensive Room' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/listings?minRent=6000&maxRent=12000')
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.length).toBe(0); // 5000 below min, 15000 above max
    });
  });

  // ---------------------------------------------------------------------------
  describe('GET /listings/:id', () => {
    it('returns listing for correct tenant (any status)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, title: 'Room for GET', status: ListingStatus.DRAFT })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/listings/${createRes.body.id}`)
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.title).toBe('Room for GET');
    });

    it('returns 404 for non-existent ID', async () => {
      await request(app.getHttpServer())
        .get('/listings/00000000-0000-0000-0000-000000000099')
        .set('x-tenant-id', tenantAId)
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /listings/:id', () => {
    it('updates listing title', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/listings/${createRes.body.id}`)
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ title: 'Updated Title', status: ListingStatus.PUBLISHED })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
      expect(res.body.status).toBe(ListingStatus.PUBLISHED);
    });

    it('returns 404 when updating listing from different tenant', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      // Tenant B staff tries to update tenant A's listing
      const tenantBStaff = await dataSource.getRepository(User).save({
        name: 'B Staff',
        email: `lsttest-staff-b-${Date.now()}@tenant-b.com`,
        passwordHash: 'dummy',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        tenantId: tenantBId,
      });

      await request(app.getHttpServer())
        .patch(`/listings/${createRes.body.id}`)
        .set('Authorization', `Bearer ${staffToken(tenantBId, tenantBStaff.id)}`)
        .set('x-tenant-id', tenantBId)
        .send({ title: 'Hacked' })
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe('DELETE /listings/:id', () => {
    it('archives listing (soft delete)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/listings/${createRes.body.id}`)
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .expect(200);

      expect(res.body.status).toBe(ListingStatus.ARCHIVED);
    });
  });

  // ---------------------------------------------------------------------------
  describe('POST /listings/:id/images', () => {
    it('uploads images and returns ListingImage array', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      const listingId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .post(`/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .attach('images', Buffer.from('fake-image-data'), 'room.jpg')
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].url).toBe('https://mock.storage/image.jpg');
      expect(res.body[0].listingId).toBe(listingId);
      expect(uploadMock).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when uploading to listing from different tenant', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      const listingId = createRes.body.id;

      const tenantBStaff = await dataSource.getRepository(User).save({
        name: 'B Staff Img',
        email: `lsttest-img-b-${Date.now()}@tenant-b.com`,
        passwordHash: 'dummy',
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        tenantId: tenantBId,
      });

      await request(app.getHttpServer())
        .post(`/listings/${listingId}/images`)
        .set('Authorization', `Bearer ${staffToken(tenantBId, tenantBStaff.id)}`)
        .set('x-tenant-id', tenantBId)
        .attach('images', Buffer.from('fake-image-data'), 'room.jpg')
        .expect(404);

      expect(uploadMock).not.toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/listings/${createRes.body.id}/images`)
        .set('x-tenant-id', tenantAId)
        .attach('images', Buffer.from('fake-image-data'), 'room.jpg')
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Cross-tenant isolation (Plan §17)', () => {
    it('GET /listings under tenant B does NOT return tenant A listings', async () => {
      // Create published listing in tenant A
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send({ ...BASE_LISTING, title: 'Tenant A Only Room' })
        .expect(201);

      // Query with tenant B header
      const res = await request(app.getHttpServer())
        .get('/listings')
        .set('x-tenant-id', tenantBId)
        .expect(200);

      expect(res.body.every((l: { tenantId: string }) => l.tenantId === tenantBId)).toBe(true);
      expect(res.body.find((l: { title: string }) => l.title === 'Tenant A Only Room')).toBeUndefined();
    });

    it('GET /listings/:id under tenant B returns 404 for tenant A listing', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${staffToken()}`)
        .set('x-tenant-id', tenantAId)
        .send(BASE_LISTING)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/listings/${createRes.body.id}`)
        .set('x-tenant-id', tenantBId)
        .expect(404);
    });
  });
});
