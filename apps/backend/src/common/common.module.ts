import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

// TenantContextInterceptor is applied globally via APP_INTERCEPTOR in AppModule
// (not here) so it can inject TenantsService without a circular dependency.
@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class CommonModule {}
