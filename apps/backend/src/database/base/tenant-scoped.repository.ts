import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';
import { TenantContextService } from '@common/tenant-context.service';
import { TenantScopedEntity } from './tenant-scoped.entity';

// Base class for all tenant-scoped repositories.
// Every method auto-reads tenantId from AsyncLocalStorage — callers never pass it explicitly.
// Subclasses extend this and inject the TypeORM Repository + TenantContextService.
export abstract class TenantScopedRepository<T extends TenantScopedEntity> {
  constructor(
    protected readonly repo: Repository<T>,
    protected readonly tenantContextService: TenantContextService,
  ) {}

  find(options?: FindManyOptions<T>): Promise<T[]> {
    const tenantId = this.tenantContextService.getRequiredTenantId();
    return this.repo.find({
      ...options,
      where: { ...(options?.where as object | undefined), tenantId } as any,
    });
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    const tenantId = this.tenantContextService.getRequiredTenantId();
    return this.repo.findOne({
      ...options,
      where: { ...(options.where as object | undefined), tenantId } as any,
    });
  }

  findById(id: string): Promise<T | null> {
    const tenantId = this.tenantContextService.getRequiredTenantId();
    return this.repo.findOne({ where: { id, tenantId } as any });
  }

  async save(data: Partial<Omit<T, 'tenantId' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
    const tenantId = this.tenantContextService.getRequiredTenantId();
    return this.repo.save({ ...data, tenantId } as any);
  }

  count(options?: FindManyOptions<T>): Promise<number> {
    const tenantId = this.tenantContextService.getRequiredTenantId();
    return this.repo.count({
      ...options,
      where: { ...(options?.where as object | undefined), tenantId } as any,
    });
  }

  delete(id: string): Promise<void> {
    const tenantId = this.tenantContextService.getRequiredTenantId();
    return this.repo
      .delete({ id, tenantId } as any)
      .then(() => undefined);
  }
}
