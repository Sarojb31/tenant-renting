/**
 * Cross-tenant isolation integration test — Plan Section 17.
 *
 * Proves that querying through TenantScopedRepository under Tenant A's
 * AsyncLocalStorage context never returns Tenant B's rows, even when both
 * tenants' data exists in the same database table.
 *
 * Prerequisites (run once before this test):
 *   docker compose up -d postgres
 *   pnpm install (at repo root)
 *
 * Run: pnpm --filter @roomfinder/backend test:integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { Entity, Column, Repository, DataSource } from 'typeorm';
import { TenantContextService } from '../src/common/tenant-context.service';
import { TenantScopedEntity } from '../src/database/base/tenant-scoped.entity';
import { TenantScopedRepository } from '../src/database/base/tenant-scoped.repository';
import { Tenant } from '../src/modules/tenants/tenant.entity';
import { TenantStatus } from '../src/common/enums/tenant-status.enum';

// ---------------------------------------------------------------------------
// Test-only entity — prefixed with underscore so it stands out as non-production
// ---------------------------------------------------------------------------
@Entity('_test_rooms')
class TestRoom extends TenantScopedEntity {
  @Column()
  title!: string;
}

class TestRoomRepository extends TenantScopedRepository<TestRoom> {
  constructor(repo: Repository<TestRoom>, ctx: TenantContextService) {
    super(repo, ctx);
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------
const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://roomfinder:roomfinder_dev@localhost:5432/roomfinder';

describe('Cross-tenant isolation (Plan §17)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let tenantContextService: TenantContextService;
  let testRoomRepo: TestRoomRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: TEST_DB_URL,
          // synchronize: true is ONLY acceptable in test — never in production
          synchronize: true,
          dropSchema: true,
          entities: [Tenant, TestRoom],
          logging: false,
        }),
        TypeOrmModule.forFeature([Tenant]),
      ],
      providers: [TenantContextService],
    }).compile();

    dataSource = module.get<DataSource>(getDataSourceToken());
    tenantContextService = module.get(TenantContextService);

    // Manually wire — avoids NestJS DI token issues with inline test-only classes
    const rawRepo: Repository<TestRoom> = dataSource.getRepository(TestRoom);
    testRoomRepo = new TestRoomRepository(rawRepo, tenantContextService);
  });

  afterAll(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "_test_rooms"');
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "_test_rooms"');
    await dataSource.query(`DELETE FROM "tenants" WHERE subdomain LIKE 'isoltest-%'`);
  });

  // -------------------------------------------------------------------------
  it('find() under Tenant A context returns only Tenant A rows', async () => {
    const tenantRepo = dataSource.getRepository(Tenant);

    const tenantA = await tenantRepo.save({
      name: 'Company A',
      subdomain: 'isoltest-a',
      status: TenantStatus.TRIAL,
      country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantB = await tenantRepo.save({
      name: 'Company B',
      subdomain: 'isoltest-b',
      status: TenantStatus.TRIAL,
      country: 'NP', defaultCurrency: 'NPR',
    });

    // Raw inserts bypass context intentionally — sets up mixed-tenant data
    await dataSource.query(
      `INSERT INTO "_test_rooms" (id, tenant_id, title, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())`,
      [tenantA.id, 'Room for A'],
    );
    await dataSource.query(
      `INSERT INTO "_test_rooms" (id, tenant_id, title, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())`,
      [tenantB.id, 'Room for B'],
    );

    const resultsA = await (tenantContextService.run(tenantA.id, () =>
      testRoomRepo.find(),
    ) as Promise<TestRoom[]>);

    expect(resultsA).toHaveLength(1);
    expect(resultsA[0].title).toBe('Room for A');
    expect(resultsA[0].tenantId).toBe(tenantA.id);

    const resultsB = await (tenantContextService.run(tenantB.id, () =>
      testRoomRepo.find(),
    ) as Promise<TestRoom[]>);

    expect(resultsB).toHaveLength(1);
    expect(resultsB[0].title).toBe('Room for B');
    expect(resultsB[0].tenantId).toBe(tenantB.id);
  });

  // -------------------------------------------------------------------------
  it('save() auto-stamps tenantId from context; other tenants see zero rows', async () => {
    const tenantRepo = dataSource.getRepository(Tenant);

    const tenantC = await tenantRepo.save({
      name: 'Company C',
      subdomain: 'isoltest-c',
      status: TenantStatus.TRIAL,
      country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantD = await tenantRepo.save({
      name: 'Company D',
      subdomain: 'isoltest-d',
      status: TenantStatus.TRIAL,
      country: 'NP', defaultCurrency: 'NPR',
    });

    const saved = await (tenantContextService.run(tenantC.id, async () =>
      testRoomRepo.save({ title: 'Auto-stamped room' }),
    ) as Promise<TestRoom>);

    expect(saved.tenantId).toBe(tenantC.id);

    // Tenant D must see zero rooms
    const dResults = await (tenantContextService.run(tenantD.id, () =>
      testRoomRepo.find(),
    ) as Promise<TestRoom[]>);

    expect(dResults).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  it('getRequiredTenantId() throws when called outside any context', () => {
    expect(() => tenantContextService.getRequiredTenantId()).toThrow(
      'No tenant context',
    );
  });

  // -------------------------------------------------------------------------
  it('count() is tenant-scoped', async () => {
    const tenantRepo = dataSource.getRepository(Tenant);

    const tenantE = await tenantRepo.save({
      name: 'Company E',
      subdomain: 'isoltest-e',
      status: TenantStatus.TRIAL,
      country: 'NP', defaultCurrency: 'NPR',
    });
    const tenantF = await tenantRepo.save({
      name: 'Company F',
      subdomain: 'isoltest-f',
      status: TenantStatus.TRIAL,
      country: 'NP', defaultCurrency: 'NPR',
    });

    // Insert 3 for E, 1 for F
    for (let i = 0; i < 3; i++) {
      await dataSource.query(
        `INSERT INTO "_test_rooms" (id, tenant_id, title, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())`,
        [tenantE.id, `Room E-${i}`],
      );
    }
    await dataSource.query(
      `INSERT INTO "_test_rooms" (id, tenant_id, title, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())`,
      [tenantF.id, 'Room F-0'],
    );

    const countE = await (tenantContextService.run(tenantE.id, () =>
      testRoomRepo.count(),
    ) as Promise<number>);
    const countF = await (tenantContextService.run(tenantF.id, () =>
      testRoomRepo.count(),
    ) as Promise<number>);

    expect(countE).toBe(3);
    expect(countF).toBe(1);
  });
});
