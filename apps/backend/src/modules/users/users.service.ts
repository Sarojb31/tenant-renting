import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './user.entity';
import { UserStatus } from '@common/enums/user-status.enum';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async setRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.repo.update(userId, { refreshTokenHash: hash });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.repo.update(userId, { lastLoginAt: new Date() });
  }

  // User management (Plan §4.2 RBAC — company admin manages staff/agents)

  findAllForTenant(tenantId: string): Promise<User[]> {
    return this.repo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
      select: ['id', 'name', 'email', 'role', 'status', 'createdAt', 'lastLoginAt'],
    });
  }

  async invite(tenantId: string, dto: InviteUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const rawPassword = dto.password ?? this.generateTempPassword();
    const passwordHash = await argon2.hash(rawPassword);

    const user = this.repo.create({
      tenantId,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash,
      status: UserStatus.INVITED,
    });
    return this.repo.save(user);
  }

  async setStatus(tenantId: string, userId: string, dto: UpdateUserStatusDto): Promise<User> {
    const user = await this.repo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    user.status = dto.status;
    return this.repo.save(user);
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }
}
