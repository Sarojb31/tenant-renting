import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { PublicTenant } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Staff / admin email+password login' })
  @PublicTenant()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(dto, res);
  }

  @ApiOperation({ summary: 'Send OTP to customer phone (tenant-scoped)' })
  @HttpCode(HttpStatus.OK)
  @Post('otp/request')
  requestOtp(
    @Body() dto: OtpRequestDto,
    @Req() req: Request,
  ): Promise<void> {
    const tenantId = (req as any).tenantId as string | null;
    return this.authService.requestOtp(dto, tenantId);
  }

  @ApiOperation({ summary: 'Verify OTP, issue customer access + refresh tokens' })
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify')
  verifyOtp(
    @Body() dto: OtpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tenantId = (req as any).tenantId as string | null;
    return this.authService.verifyOtp(dto, tenantId, res);
  }

  @ApiOperation({ summary: 'Rotate refresh token, issue new access token' })
  @PublicTenant()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.refresh(req, res);
  }

  @ApiOperation({ summary: 'Logout — invalidate refresh token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.authService.logout(req, res);
  }
}
