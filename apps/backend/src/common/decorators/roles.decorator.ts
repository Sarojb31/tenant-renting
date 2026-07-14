import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';
export const PUBLIC_TENANT_KEY = 'isPublicTenant';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
export const PublicTenant = () => SetMetadata(PUBLIC_TENANT_KEY, true);
