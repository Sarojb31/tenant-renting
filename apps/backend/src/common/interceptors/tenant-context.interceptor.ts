import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { TenantContextService } from '../tenant-context.service';
import { TenantsService } from '@modules/tenants/tenants.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly tenantsService: TenantsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    return from(this._resolveAll(request)).pipe(
      switchMap((tenantId) => {
        request.tenantId = tenantId;
        if (!tenantId) return next.handle();
        return new Observable((subscriber) => {
          this.tenantContextService.run(tenantId, () => {
            next.handle().subscribe({
              next: (value) => subscriber.next(value),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
          });
        });
      }),
    );
  }

  private async _resolveAll(request: any): Promise<string | null> {
    // Priority 1: JWT claim (set by JwtStrategy.validate → passport attaches to request.user)
    if (request.user?.tenantId) return request.user.tenantId as string;

    // Priority 2: subdomain DB lookup
    const host: string = request.headers?.host ?? '';
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'localhost') {
      request.tenantSubdomain = subdomain;
      const tenant = await this.tenantsService.findBySubdomain(subdomain);
      if (tenant) return tenant.id;
    }

    // Priority 3: explicit header (service-to-service)
    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
    return headerTenantId ?? null;
  }
}
