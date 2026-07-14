import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '@modules/users/users.service';
import { CustomersService } from '@modules/customers/customers.service';
import { UserStatus } from '@common/enums/user-status.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string | null;
  type: 'user' | 'customer';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly customersService: CustomersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type === 'customer') {
      const customer = await this.customersService.findById(payload.sub);
      if (!customer) throw new UnauthorizedException('Customer not found');
      return payload;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or disabled');
    }
    return payload;
  }
}
