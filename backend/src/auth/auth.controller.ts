import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from '../common/decorators/public.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { Access } from '../common/access-control/access.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyContactEmailDto } from '../org/dto/verify-contact-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
  ) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: { ip?: string; headers: { 'x-forwarded-for'?: string; 'x-real-ip'?: string } },
  ) {
    // Extract IP from request (handle proxy scenarios)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      'unknown';
    return this.authService.login(loginDto, ip);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Request() req: { ip?: string; headers: { 'x-forwarded-for'?: string; 'x-real-ip'?: string; 'user-agent'?: string } },
  ) {
    return this.authService.forgotPassword(dto, this.getRequestMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Request() req: { ip?: string; headers: { 'x-forwarded-for'?: string; 'x-real-ip'?: string; 'user-agent'?: string } },
  ) {
    return this.authService.resetPassword(dto, this.getRequestMeta(req));
  }

  // Protected Route
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: { user: unknown }) {
    // req.user is automatically populated by the JwtStrategy's validate() method
    return {
      message: 'You have accessed a protected route successfully!',
      organization: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Request() req: { user: { id: string } },
    @Body() updateDto: UpdateUserDto,
  ) {
    const userId = req.user.id;
    return this.authService.updateProfile(userId, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Post('change-password')
  async changePassword(
    @Request()
    req: {
      user: { id: string };
      headers: { authorization?: string };
    },
    @Body() body: Record<string, string>,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.changePassword(
      req.user.id,
      body.oldPassword,
      body.newPassword,
      token,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Request()
    req: {
      user: { id: string };
      headers: { authorization?: string };
    },
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.logout(req.user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('contact-email/resend-verification')
  async resendContactEmailVerification(
    @Request()
    req: {
      user: { id: string; role: string; organizationId?: string | null; sessionId?: string };
      ip?: string;
      headers: { 'x-forwarded-for'?: string; 'x-real-ip'?: string; 'user-agent'?: string };
    },
  ) {
    return this.authService.resendContactEmailVerification(
      req.user,
      this.getRequestMeta(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Throttle({ default: { limit: 8, ttl: 10 * 60_000 } })
  @Post('contact-email/verify')
  async verifyContactEmail(
    @Request()
    req: {
      user: { id: string; role: string; organizationId?: string | null; sessionId?: string };
      ip?: string;
      headers: { 'x-forwarded-for'?: string; 'x-real-ip'?: string; 'user-agent'?: string };
    },
    @Body() dto: VerifyContactEmailDto,
  ) {
    return this.authService.verifyContactEmail(
      req.user,
      dto.code,
      this.getRequestMeta(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Get('sessions')
  async getSessions(@Request() req: { user: { id: string } }) {
    return this.authService.getSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Delete('sessions/:sessionId')
  async revokeSession(
    @Request()
    req: { user: { id: string }; headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.revokeSession(req.user.id, sessionId, token);
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Delete('sessions')
  async revokeAllSessions(
    @Request()
    req: {
      user: { id: string };
      headers: { authorization?: string };
    },
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.revokeAllSessions(req.user.id, token);
  }

  private getRequestMeta(req: {
    ip?: string;
    headers: {
      'x-forwarded-for'?: string;
      'x-real-ip'?: string;
      'user-agent'?: string;
    };
  }) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      'unknown';

    return {
      ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
