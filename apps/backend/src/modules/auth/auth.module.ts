import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PhoneOtpCode } from './entities/phone-otp-code.entity';
import { UsersModule } from '@modules/users/users.module';
import { CustomersModule } from '@modules/customers/customers.module';
import { SmsModule } from '@modules/sms/sms.module';

// Implements: Plan Section 4.9, 14 (auth endpoints)
// Build order: Phase 1 Step 1 (Tenants/Auth)
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: configService.get<string>('jwt.accessExpiry') ?? '15m' },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([PhoneOtpCode]),
    UsersModule,
    CustomersModule,
    SmsModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
