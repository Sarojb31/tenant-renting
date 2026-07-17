import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant-context.service';
import { FILE_STORAGE_PROVIDER, FileStorageProvider } from '@modules/storage/file-storage.provider';
import { Customer } from './customer.entity';
import { CustomerImage } from './customer-image.entity';
import { CustomerPreference } from './customer-preference.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
    @InjectRepository(CustomerPreference)
    private readonly prefRepo: Repository<CustomerPreference>,
    @InjectRepository(CustomerImage)
    private readonly imageRepo: Repository<CustomerImage>,
    private readonly ctx: TenantContextService,
    @Inject(FILE_STORAGE_PROVIDER)
    private readonly storageProvider: FileStorageProvider,
  ) {}

  findAll(): Promise<Customer[]> {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { tenantId, phone } });
  }

  async findOneScoped(id: string): Promise<Customer | null> {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const tenantId = this.ctx.getRequiredTenantId();
    const existing = await this.findByPhone(tenantId, dto.phone);
    if (existing) throw new ConflictException('Customer with this phone already exists');
    return this.repo.save({ ...dto, tenantId });
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const tenantId = this.ctx.getRequiredTenantId();
    const customer = await this.repo.findOne({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    Object.assign(customer, dto);
    return this.repo.save(customer);
  }

  async upsertByPhone(tenantId: string, phone: string): Promise<Customer> {
    const existing = await this.findByPhone(tenantId, phone);
    if (existing) {
      await this.repo.update(existing.id, { phoneVerified: true });
      return { ...existing, phoneVerified: true };
    }
    return this.repo.save({ tenantId, phone, phoneVerified: true });
  }

  findByEmail(tenantId: string, email: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { tenantId, email } });
  }

  async setPasswordHash(id: string, hash: string | null): Promise<void> {
    await this.repo.update(id, { passwordHash: hash });
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.repo.update(id, { refreshTokenHash: hash });
  }

  async upsertPreference(
    customerId: string,
    dto: UpsertPreferenceDto,
  ): Promise<CustomerPreference> {
    const tenantId = this.ctx.getRequiredTenantId();
    const customer = await this.repo.findOne({ where: { id: customerId, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const existing = await this.prefRepo.findOne({ where: { customerId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.prefRepo.save(existing);
    }
    return this.prefRepo.save({ ...dto, customerId, tenantId });
  }

  getPreference(customerId: string): Promise<CustomerPreference | null> {
    return this.prefRepo.findOne({ where: { customerId } });
  }

  async addImages(customerId: string, files: Express.Multer.File[], type = 'other'): Promise<CustomerImage[]> {
    const tenantId = this.ctx.getRequiredTenantId();
    const customer = await this.repo.findOne({ where: { id: customerId, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const existing = await this.imageRepo.find({
      where: { customerId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    let nextSort = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

    const saved: CustomerImage[] = [];
    for (const file of files) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
      const key = `customers/${customerId}/${Date.now()}-${safeName}`;
      const url = await this.storageProvider.upload(key, file.buffer, file.mimetype);
      saved.push(await this.imageRepo.save({ customerId, tenantId, url, type, sortOrder: nextSort++ }));
    }

    return saved;
  }

  findImages(customerId: string): Promise<CustomerImage[]> {
    return this.imageRepo.find({ where: { customerId }, order: { sortOrder: 'ASC' } });
  }
}
