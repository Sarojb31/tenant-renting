import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { User } from '@modules/users/user.entity';
import { UserRole } from '@common/enums/user-role.enum';
import { UserStatus } from '@common/enums/user-status.enum';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }

  findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { subdomain } });
  }

  async onboard(
    dto: CreateTenantDto,
  ): Promise<{ tenant: Tenant; adminUser: Omit<User, 'passwordHash' | 'refreshTokenHash'> }> {
    const existing = await this.tenantRepo.findOne({ where: { subdomain: dto.subdomain } });
    if (existing) {
      throw new ConflictException(`Subdomain '${dto.subdomain}' is already taken`);
    }

    const passwordHash = await argon2.hash(dto.adminPassword);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tenant = queryRunner.manager.create(Tenant, {
        name: dto.name,
        subdomain: dto.subdomain,
        country: dto.country,
        defaultCurrency: dto.defaultCurrency,
      });
      await queryRunner.manager.save(tenant);

      const adminUser = queryRunner.manager.create(User, {
        tenantId: tenant.id,
        name: dto.adminName,
        email: dto.adminEmail,
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
        status: UserStatus.ACTIVE,
      });
      await queryRunner.manager.save(adminUser);

      await queryRunner.commitTransaction();

      const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = adminUser;
      return { tenant, adminUser: safeUser as any };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }
}
