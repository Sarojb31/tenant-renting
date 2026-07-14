/**
 * Bookings + Payments integration tests — Plan Section 4.7, 14, 17.
 *
 * Tests booking creation, payment intent creation, webhook processing, cross-tenant isolation.
 * Payment adapters are mocked — no real gateway calls.
 * Uses tenantCtx.run() to simulate HTTP request tenant context.
 *
 * Run: pnpm --filter @roomfinder/backend test:integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Tenant } from '../src/modules/tenants/tenant.entity';
import { User } from '../src/modules/users/user.entity';
import { Customer } from '../src/modules/customers/customer.entity';
import { CustomerPreference } from '../src/modules/customers/customer-preference.entity';
import { PhoneOtpCode } from '../src/modules/auth/entities/phone-otp-code.entity';
import { Listing } from '../src/modules/listings/listing.entity';
import { ListingImage } from '../src/modules/listings/listing-image.entity';
import { SmsLog } from '../src/modules/matching/sms-log.entity';
import { Booking } from '../src/modules/payments/booking.entity';
import { Payment } from '../src/modules/payments/payment.entity';
import { BookingsService } from '../src/modules/payments/bookings.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentRoutingService } from '../src/modules/payments/payment-routing.service';
import { CommonModule } from '../src/common/common.module';
import { TenantContextService } from '../src/common/tenant-context.service';
import { TenantStatus } from '../src/common/enums/tenant-status.enum';
import { ListingStatus } from '../src/common/enums/listing-status.enum';
import { RoomType } from '../src/common/enums/room-type.enum';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { PaymentGateway } from '../src/common/enums/payment-gateway.enum';
import { PaymentStatus } from '../src/common/enums/payment-status.enum';

jest.setTimeout(60000);

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

describe('Bookings + Payments (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let bookingsService: BookingsService;
  let paymentsService: PaymentsService;
  let tenantCtx: TenantContextService;

  let tenantAId: string;
  let tenantBId: string;
  let customerAId: string;
  let customerBId: string;
  let listingAId: string;

  const mockAdapterCreateIntent = jest.fn();
  const mockAdapterVerifySig = jest.fn();
  const mockAdapterHandleWebhook = jest.fn();

  const mockAdapter = {
    createPaymentIntent: (...args: unknown[]) => mockAdapterCreateIntent(...args),
    verifyWebhookSignature: (...args: unknown[]) => mockAdapterVerifySig(...args),
    handleWebhook: (...args: unknown[]) => mockAdapterHandleWebhook(...args),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: TEST_DB_URL,
          synchronize: true,
          dropSchema: true,
          entities: [
            Tenant, User, Customer, CustomerPreference, PhoneOtpCode,
            Listing, ListingImage, SmsLog, Booking, Payment,
          ],
          logging: false,
        }),
        TypeOrmModule.forFeature([Tenant, Customer, Listing, Booking, Payment]),
        CommonModule,
      ],
      providers: [
        BookingsService,
        PaymentsService,
        {
          provide: PaymentRoutingService,
          useValue: { resolveAdapter: () => mockAdapter },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    bookingsService = moduleRef.get<BookingsService>(BookingsService);
    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);
    tenantCtx = moduleRef.get<TenantContextService>(TenantContextService);

    const tenantRepo = dataSource.getRepository(Tenant);
    const tenantA = await tenantRepo.save({
      name: 'Pay Co A', subdomain: 'paytest-a',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantB = await tenantRepo.save({
      name: 'Pay Co B', subdomain: 'paytest-b',
      status: TenantStatus.TRIAL, country: 'NP', defaultCurrency: 'NPR',
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const customerA = await dataSource.getRepository(Customer).save({
      phone: '+9779900010001', tenantId: tenantAId, phoneVerified: true, smsOptIn: true,
    });
    const customerB = await dataSource.getRepository(Customer).save({
      phone: '+9779900010002', tenantId: tenantBId, phoneVerified: true, smsOptIn: true,
    });
    customerAId = customerA.id;
    customerBId = customerB.id;

    const listing = await dataSource.getRepository(Listing).save({
      title: 'Pay Test Room', roomType: RoomType.SINGLE,
      rentAmount: '8000' as any, city: 'Kathmandu',
      status: ListingStatus.PUBLISHED, tenantId: tenantAId, createdBy: null,
    });
    listingAId = listing.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const withTenant = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> =>
    tenantCtx.run(tenantId, fn) as Promise<T>;

  // -----------------------------------------------------------------------
  describe('BookingsService.create', () => {
    afterEach(async () => {
      await dataSource.query(`DELETE FROM "payments"`);
      await dataSource.query(`DELETE FROM "bookings"`);
    });

    it('creates booking for PUBLISHED listing in same tenant', async () => {
      const booking = await withTenant(tenantAId, () =>
        bookingsService.create(customerAId, {
          listingId: listingAId,
          moveInDate: '2026-09-01',
        }),
      );

      expect(booking.tenantId).toBe(tenantAId);
      expect(booking.customerId).toBe(customerAId);
      expect(booking.listingId).toBe(listingAId);
      expect(booking.status).toBe(BookingStatus.PENDING);
      expect(parseFloat(booking.amountDue)).toBe(8000);
    });

    it('throws 404 when listing belongs to different tenant', async () => {
      await expect(
        withTenant(tenantBId, () =>
          bookingsService.create(customerBId, {
            listingId: listingAId,
            moveInDate: '2026-09-01',
          }),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('throws 404 when listing is not PUBLISHED', async () => {
      const draftListing = await dataSource.getRepository(Listing).save({
        title: 'Draft Room', roomType: RoomType.SINGLE,
        rentAmount: '5000' as any, city: 'Pokhara',
        status: ListingStatus.DRAFT, tenantId: tenantAId, createdBy: null,
      });

      await expect(
        withTenant(tenantAId, () =>
          bookingsService.create(customerAId, {
            listingId: draftListing.id,
            moveInDate: '2026-10-01',
          }),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // -----------------------------------------------------------------------
  describe('PaymentsService.createIntent', () => {
    let bookingId: string;

    beforeEach(async () => {
      const booking = await withTenant(tenantAId, () =>
        bookingsService.create(customerAId, {
          listingId: listingAId, moveInDate: '2026-09-01',
        }),
      );
      bookingId = booking.id;
    });

    afterEach(async () => {
      await dataSource.query(`DELETE FROM "payments"`);
      await dataSource.query(`DELETE FROM "bookings"`);
    });

    it('creates payment record and returns providerRef', async () => {
      mockAdapterCreateIntent.mockResolvedValue({
        clientSecret: 'pi_test_secret',
        providerRef: 'pi_test123',
      });

      const result = await withTenant(tenantAId, () =>
        paymentsService.createIntent(customerAId, {
          bookingId, gateway: PaymentGateway.STRIPE,
        }),
      );

      expect(result.clientSecret).toBe('pi_test_secret');
      expect(result.providerRef).toBe('pi_test123');
      expect(result.paymentId).toBeDefined();

      const payments = await dataSource.getRepository(Payment).find({ where: { payableId: bookingId } });
      expect(payments.length).toBe(1);
      expect(payments[0].status).toBe(PaymentStatus.PENDING);
      expect(payments[0].gatewayTransactionId).toBe('pi_test123');
    });

    it('throws 404 when booking belongs to a different customer', async () => {
      await expect(
        withTenant(tenantAId, () =>
          paymentsService.createIntent(customerBId, {
            bookingId, gateway: PaymentGateway.STRIPE,
          }),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  // -----------------------------------------------------------------------
  describe('PaymentsService.handleWebhookEvent', () => {
    let bookingId: string;
    let paymentId: string;

    beforeEach(async () => {
      mockAdapterCreateIntent.mockResolvedValue({ clientSecret: 'cs', providerRef: 'pi_wh123' });
      mockAdapterVerifySig.mockReturnValue(true);

      const booking = await withTenant(tenantAId, () =>
        bookingsService.create(customerAId, { listingId: listingAId, moveInDate: '2026-09-01' }),
      );
      bookingId = booking.id;

      const intent = await withTenant(tenantAId, () =>
        paymentsService.createIntent(customerAId, { bookingId, gateway: PaymentGateway.STRIPE }),
      );
      paymentId = intent.paymentId;
    });

    afterEach(async () => {
      await dataSource.query(`DELETE FROM "payments"`);
      await dataSource.query(`DELETE FROM "bookings"`);
    });

    it('updates payment SUCCESS and booking CONFIRMED on success webhook', async () => {
      mockAdapterHandleWebhook.mockResolvedValue({ status: 'success', providerRef: 'pi_wh123' });

      await paymentsService.handleWebhookEvent(
        PaymentGateway.STRIPE, {}, Buffer.from('{}'), 't=1,v1=abc',
      );

      const payment = await dataSource.getRepository(Payment).findOne({ where: { id: paymentId } });
      expect(payment!.status).toBe(PaymentStatus.SUCCESS);

      const booking = await dataSource.getRepository(Booking).findOne({ where: { id: bookingId } });
      expect(booking!.status).toBe(BookingStatus.CONFIRMED);
    });

    it('updates payment FAILED and booking stays PENDING on failed webhook', async () => {
      mockAdapterHandleWebhook.mockResolvedValue({ status: 'failed', providerRef: 'pi_wh123' });

      await paymentsService.handleWebhookEvent(
        PaymentGateway.STRIPE, {}, Buffer.from('{}'), 't=1,v1=abc',
      );

      const payment = await dataSource.getRepository(Payment).findOne({ where: { id: paymentId } });
      expect(payment!.status).toBe(PaymentStatus.FAILED);

      const booking = await dataSource.getRepository(Booking).findOne({ where: { id: bookingId } });
      expect(booking!.status).toBe(BookingStatus.PENDING);
    });

    it('throws 401 when webhook signature invalid', async () => {
      mockAdapterVerifySig.mockImplementation(() => { throw new Error('bad sig'); });

      await expect(
        paymentsService.handleWebhookEvent(
          PaymentGateway.STRIPE, {}, Buffer.from('{}'), 'bad-sig',
        ),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('is idempotent — duplicate webhook does not create extra payment records', async () => {
      mockAdapterHandleWebhook.mockResolvedValue({ status: 'success', providerRef: 'pi_wh123' });

      await paymentsService.handleWebhookEvent(PaymentGateway.STRIPE, {}, Buffer.from('{}'), 't=1');
      await paymentsService.handleWebhookEvent(PaymentGateway.STRIPE, {}, Buffer.from('{}'), 't=1');

      const payments = await dataSource.getRepository(Payment).find({ where: { payableId: bookingId } });
      expect(payments.length).toBe(1);
      expect(payments[0].status).toBe(PaymentStatus.SUCCESS);
    });
  });

  // -----------------------------------------------------------------------
  describe('Cross-tenant isolation (Plan §17)', () => {
    afterEach(async () => {
      await dataSource.query(`DELETE FROM "payments"`);
      await dataSource.query(`DELETE FROM "bookings"`);
    });

    it('customer in tenant B cannot book listing in tenant A', async () => {
      await expect(
        withTenant(tenantBId, () =>
          bookingsService.create(customerBId, { listingId: listingAId, moveInDate: '2026-09-01' }),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('customer B cannot create payment intent for tenant A booking', async () => {
      mockAdapterCreateIntent.mockResolvedValue({ clientSecret: 'cs', providerRef: 'pi_iso' });

      const booking = await withTenant(tenantAId, () =>
        bookingsService.create(customerAId, { listingId: listingAId, moveInDate: '2026-09-01' }),
      );

      await expect(
        withTenant(tenantBId, () =>
          paymentsService.createIntent(customerBId, { bookingId: booking.id, gateway: PaymentGateway.STRIPE }),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
