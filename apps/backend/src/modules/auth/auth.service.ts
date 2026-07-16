import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response, Request } from 'express';
import * as argon2 from 'argon2';
import { UsersService } from '@modules/users/users.service';
import { CustomersService } from '@modules/customers/customers.service';
import { SMS_PROVIDER, SmsProvider } from '@modules/sms/sms.provider.interface';
import { PhoneOtpCode } from './entities/phone-otp-code.entity';
import { LoginDto } from './dto/login.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { CustomerEmailLoginDto } from './dto/customer-email-login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserRole } from '@common/enums/user-role.enum';

const REFRESH_COOKIE = 'refresh_token';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly customersService: CustomersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(PhoneOtpCode)
    private readonly otpRepo: Repository<PhoneOtpCode>,
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
  ) {}

  // ─── Staff / admin ────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    res: Response,
  ): Promise<{ accessToken: string; user: { id: string; email: string; name?: string | null; role: string; tenantId?: string | null } }> {
    const user = await this.usersService.findByEmail(dto.email);

    // Constant-time comparison — same error for unknown email and wrong password
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummydummydummy$dummydummydummydummydummydummydummydummy';
    const passwordMatch = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : await argon2.verify(dummyHash, dto.password).catch(() => false);

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: 'user',
    };

    const accessToken = this.jwtService.sign(payload);
    await this._issueRefreshToken(user.id, 'user', res, (hash) =>
      this.usersService.setRefreshTokenHash(user.id, hash),
    );
    await this.usersService.updateLastLogin(user.id);

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    };
  }

  // ─── Customer OTP ─────────────────────────────────────────────────────────

  async requestOtp(dto: OtpRequestDto, tenantId: string | null): Promise<void> {
    if (!tenantId) throw new BadRequestException('Tenant context required — set subdomain or x-tenant-id header');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Invalidate any unused OTPs for this phone+tenant
    await this.otpRepo.delete({ tenantId, phone: dto.phone, used: false });

    await this.otpRepo.save({ tenantId, phone: dto.phone, codeHash, expiresAt });

    await this.smsProvider.send(
      dto.phone,
      `Your verification code is: ${code}. Valid for 10 minutes.`,
    );
  }

  async verifyOtp(
    dto: OtpVerifyDto,
    tenantId: string | null,
    res: Response,
  ): Promise<{ accessToken: string; customer: { id: string; phone: string; name?: string } }> {
    if (!tenantId) throw new BadRequestException('Tenant context required');

    const otpRecord = await this.otpRepo.findOne({
      where: { tenantId, phone: dto.phone, used: false },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord || new Date() > otpRecord.expiresAt) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many failed attempts — request a new OTP');
    }

    const codeMatch = await argon2.verify(otpRecord.codeHash, dto.code);
    if (!codeMatch) {
      await this.otpRepo.increment({ id: otpRecord.id }, 'attempts', 1);
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.otpRepo.update(otpRecord.id, { used: true });

    const customer = await this.customersService.upsertByPhone(tenantId, dto.phone);

    const payload: JwtPayload = {
      sub: customer.id,
      email: customer.email ?? '',
      role: UserRole.CUSTOMER,
      tenantId,
      type: 'customer',
    };

    const accessToken = this.jwtService.sign(payload);
    await this._issueRefreshToken(customer.id, 'customer', res, (hash) =>
      this.customersService.setRefreshTokenHash(customer.id, hash),
    );

    return {
      accessToken,
      customer: { id: customer.id, phone: customer.phone, name: customer.name ?? undefined },
    };
  }

  async customerEmailLogin(
    dto: CustomerEmailLoginDto,
    tenantId: string | null,
    res: Response,
  ): Promise<{ accessToken: string; customer: { id: string; email: string; name?: string } }> {
    if (!tenantId) throw new BadRequestException('Tenant context required');

    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummydummydummy$dummydummydummydummydummydummydummydummy';
    const customer = await this.customersService.findByEmail(tenantId, dto.email);

    const passwordMatch = customer?.passwordHash
      ? await argon2.verify(customer.passwordHash, dto.password)
      : await argon2.verify(dummyHash, dto.password).catch(() => false);

    if (!customer || !passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: customer.id,
      email: customer.email ?? '',
      role: UserRole.CUSTOMER,
      tenantId,
      type: 'customer',
    };

    const accessToken = this.jwtService.sign(payload);
    await this._issueRefreshToken(customer.id, 'customer', res, (hash) =>
      this.customersService.setRefreshTokenHash(customer.id, hash),
    );

    return {
      accessToken,
      customer: { id: customer.id, email: customer.email!, name: customer.name ?? undefined },
    };
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const rawToken: string | undefined = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!rawToken) throw new UnauthorizedException('Refresh token missing');

    let decoded: { sub: string; type?: string };
    try {
      decoded = this.jwtService.verify<{ sub: string; type?: string }>(rawToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (decoded.type === 'customer') {
      return this._refreshCustomer(decoded.sub, rawToken, res);
    }
    return this._refreshUser(decoded.sub, rawToken, res);
  }

  async logout(req: Request, res: Response): Promise<void> {
    const rawToken: string | undefined = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (rawToken) {
      try {
        const decoded = this.jwtService.verify<{ sub: string; type?: string }>(rawToken, {
          secret: this.configService.get<string>('jwt.refreshSecret'),
        });
        if (decoded.type === 'customer') {
          await this.customersService.setRefreshTokenHash(decoded.sub, null);
        } else {
          await this.usersService.setRefreshTokenHash(decoded.sub, null);
        }
      } catch {
        // Expired token — still clear cookie
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async _refreshUser(
    userId: string,
    rawToken: string,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const hashMatch = await argon2.verify(user.refreshTokenHash, rawToken);
    if (!hashMatch) throw new UnauthorizedException('Invalid or expired refresh token');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: 'user',
    };
    const accessToken = this.jwtService.sign(payload);
    await this._issueRefreshToken(user.id, 'user', res, (hash) =>
      this.usersService.setRefreshTokenHash(user.id, hash),
    );

    return { accessToken };
  }

  private async _refreshCustomer(
    customerId: string,
    rawToken: string,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const customer = await this.customersService.findById(customerId);
    if (!customer || !customer.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const hashMatch = await argon2.verify(customer.refreshTokenHash, rawToken);
    if (!hashMatch) throw new UnauthorizedException('Invalid or expired refresh token');

    const payload: JwtPayload = {
      sub: customer.id,
      email: customer.email ?? '',
      role: UserRole.CUSTOMER,
      tenantId: customer.tenantId,
      type: 'customer',
    };
    const accessToken = this.jwtService.sign(payload);
    await this._issueRefreshToken(customer.id, 'customer', res, (hash) =>
      this.customersService.setRefreshTokenHash(customer.id, hash),
    );

    return { accessToken };
  }

  private async _issueRefreshToken(
    subjectId: string,
    type: 'user' | 'customer',
    res: Response,
    storeHash: (hash: string) => Promise<void>,
  ): Promise<void> {
    const refreshToken = this.jwtService.sign(
      { sub: subjectId, type },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiry') ?? '7d',
      },
    );
    const hash = await argon2.hash(refreshToken);
    await storeHash(hash);
    this._setRefreshCookie(res, refreshToken);
  }

  private _setRefreshCookie(res: Response, token: string): void {
    const isProd = this.configService.get<string>('nodeEnv') === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProd,
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
