import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(tenantId: string, fn: () => T | Promise<T>): T | Promise<T> {
    return this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  getRequiredTenantId(): string {
    const id = this.getTenantId();
    if (!id) {
      throw new Error(
        'No tenant context — TenantContextInterceptor must run before this point.',
      );
    }
    return id;
  }
}
