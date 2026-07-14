import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_TENANT_KEY } from '../decorators/roles.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublicTenant = this.reflector.getAllAndOverride<boolean>(PUBLIC_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublicTenant) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context not resolved');
    }

    return true;
  }
}
