import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole } from '@common/enums/user-role.enum';
import { UserStatus } from '@common/enums/user-status.enum';

function makeRepo(overrides: Partial<Repository<User>> = {}): Repository<User> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((x) => x),
    save: jest.fn().mockImplementation(async (x) => ({ id: 'new-id', ...x })),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Repository<User>;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Alice',
    email: 'alice@example.com',
    role: UserRole.STAFF,
    status: UserStatus.ACTIVE,
    ...overrides,
  } as User;
}

describe('UsersService.findAllForTenant', () => {
  it('returns users for tenant', async () => {
    const users = [makeUser(), makeUser({ id: 'user-2', role: UserRole.AGENT })];
    const svc = new UsersService(makeRepo({ find: jest.fn().mockResolvedValue(users) }));
    const result = await svc.findAllForTenant('tenant-1');
    expect(result).toHaveLength(2);
    expect(result[1].role).toBe(UserRole.AGENT);
  });
});

describe('UsersService.invite', () => {
  it('creates user with INVITED status', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((x) => x),
      save: jest.fn().mockImplementation(async (x) => ({ id: 'new-id', ...x })),
    });
    const svc = new UsersService(repo);
    const result = await svc.invite('tenant-1', {
      name: 'Bob',
      email: 'bob@example.com',
      role: UserRole.STAFF,
      password: 'password123',
    });
    expect(result.status).toBe(UserStatus.INVITED);
    expect(result.role).toBe(UserRole.STAFF);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.passwordHash).toBeDefined();
    expect(result.passwordHash).not.toBe('password123');
  });

  it('throws ConflictException when email already in use', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(makeUser()) });
    const svc = new UsersService(repo);
    await expect(
      svc.invite('tenant-1', { name: 'Bob', email: 'alice@example.com', role: UserRole.AGENT }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('UsersService.setStatus', () => {
  it('disables an active user', async () => {
    const user = makeUser({ status: UserStatus.ACTIVE });
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockImplementation(async (x) => x),
    });
    const svc = new UsersService(repo);
    const result = await svc.setStatus('tenant-1', 'user-1', { status: UserStatus.DISABLED });
    expect(result.status).toBe(UserStatus.DISABLED);
  });

  it('throws NotFoundException when user not in tenant', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new UsersService(repo);
    await expect(
      svc.setStatus('tenant-1', 'missing', { status: UserStatus.DISABLED }),
    ).rejects.toThrow(NotFoundException);
  });
});
