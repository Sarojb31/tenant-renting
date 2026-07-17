/**
 * Required tests per Plan §1.7 — mirror listing-image tests exactly:
 * upload success, cross-tenant 404, 401 no auth (auth guard tested at controller level).
 */
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from './customer.entity';
import { CustomerImage } from './customer-image.entity';
import { CustomerPreference } from './customer-preference.entity';
import { ObjectLiteral, Repository } from 'typeorm';

const TENANT_ID = 'tenant-aaa';
const CUSTOMER_ID = 'customer-111';

function makeFile(name = 'photo.jpg'): Express.Multer.File {
  return {
    originalname: name,
    buffer: Buffer.from('fake-image'),
    mimetype: 'image/jpeg',
    fieldname: 'images',
    encoding: '7bit',
    size: 10,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return { id: CUSTOMER_ID, tenantId: TENANT_ID, phone: '+977', ...overrides } as Customer;
}

function makeRepo<T extends ObjectLiteral>(overrides: Partial<Repository<T>> = {}): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'img-1', ...e })),
    ...overrides,
  } as any;
}

function buildService(customerRepo: any, imageRepo: any) {
  const prefRepo = makeRepo<CustomerPreference>();
  const ctx = { getRequiredTenantId: jest.fn().mockReturnValue(TENANT_ID) };
  const storage = { upload: jest.fn().mockResolvedValue('https://cdn.example.com/photo.jpg') };

  return new CustomersService(
    customerRepo as Repository<Customer>,
    prefRepo as Repository<CustomerPreference>,
    imageRepo as Repository<CustomerImage>,
    ctx as any,
    storage as any,
  );
}

// ─── Upload success ────────────────────────────────────────────────────────────

describe('CustomersService.addImages — upload success', () => {
  it('uploads files and returns saved CustomerImage records', async () => {
    const customerRepo = makeRepo<Customer>({ findOne: jest.fn().mockResolvedValue(makeCustomer()) });
    const imageRepo = makeRepo<CustomerImage>();
    const svc = buildService(customerRepo, imageRepo);

    const result = await svc.addImages(CUSTOMER_ID, [makeFile('id-doc.jpg')], 'id_document');

    expect(imageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        tenantId: TENANT_ID,
        url: 'https://cdn.example.com/photo.jpg',
        type: 'id_document',
      }),
    );
    expect(result).toHaveLength(1);
  });
});

// ─── Cross-tenant 404 ─────────────────────────────────────────────────────────

describe('CustomersService.addImages — cross-tenant isolation', () => {
  it('throws NotFoundException when customer belongs to a different tenant', async () => {
    // findOne scoped to { id, tenantId } returns null — simulates cross-tenant access
    const customerRepo = makeRepo<Customer>({ findOne: jest.fn().mockResolvedValue(null) });
    const imageRepo = makeRepo<CustomerImage>();
    const svc = buildService(customerRepo, imageRepo);

    await expect(
      svc.addImages('other-tenant-customer', [makeFile()]),
    ).rejects.toThrow(NotFoundException);

    expect(imageRepo.save).not.toHaveBeenCalled();
  });
});

// ─── Default type ─────────────────────────────────────────────────────────────

describe('CustomersService.addImages — type defaults to other', () => {
  it("defaults image type to 'other' when not specified", async () => {
    const customerRepo = makeRepo<Customer>({ findOne: jest.fn().mockResolvedValue(makeCustomer()) });
    const imageRepo = makeRepo<CustomerImage>();
    const svc = buildService(customerRepo, imageRepo);

    await svc.addImages(CUSTOMER_ID, [makeFile()]);

    expect(imageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'other' }),
    );
  });
});
