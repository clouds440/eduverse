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
  Res,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
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
import { AUTH_COOKIE_NAME, extractJwtFromRequest } from './jwt.strategy';

type AuthenticatedRequest = {
  user: { id: string; role?: string; organizationId?: string | null; sessionId?: string };
  ip?: string;
  headers: {
    authorization?: string;
    cookie?: string;
    'x-forwarded-for'?: string;
    'x-real-ip'?: string;
    'user-agent'?: string;
  };
};

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
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract IP from request (handle proxy scenarios)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      'unknown';
    const result = await this.authService.login(loginDto, ip);
    this.setAuthCookie(res, result.access_token, loginDto.rememberMe === true);
    return result;
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
  @Get('session')
  getSession(
    @Request() req: AuthenticatedRequest,
  ) {
    const token = this.getAuthToken(req);
    if (!token) {
      return { access_token: null };
    }

    return { access_token: token };
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
      headers: { authorization?: string; cookie?: string };
    },
    @Body() body: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.getAuthToken(req);
    const result = await this.authService.changePassword(
      req.user.id,
      body.oldPassword,
      body.newPassword,
      token,
    );
    this.setAuthCookie(res, result.access_token, true);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Request()
    req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.getAuthToken(req);
    this.clearAuthCookie(res);
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
  async getSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.getSessions(req.user.id, this.getAuthToken(req));
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Delete('sessions/:sessionId')
  async revokeSession(
    @Request()
    req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const token = this.getAuthToken(req);
    return this.authService.revokeSession(req.user.id, sessionId, token);
  }

  @UseGuards(JwtAuthGuard)
  @Access(AccessLevel.NONE)
  @Delete('sessions')
  async revokeAllSessions(
    @Request()
    req: AuthenticatedRequest,
  ) {
    const token = this.getAuthToken(req);
    return this.authService.revokeAllSessions(req.user.id, token);
  }

  private getAuthToken(req: { headers: { authorization?: string; cookie?: string } }) {
    return extractJwtFromRequest(req as ExpressRequest) || undefined;
  }

  private setAuthCookie(res: Response, token: string, rememberMe: boolean) {
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isCookieSecure(),
      sameSite: this.getCookieSameSite(),
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      path: '/',
      maxAge: (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookie(res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.isCookieSecure(),
      sameSite: this.getCookieSameSite(),
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      path: '/',
    });
  }

  private isCookieSecure() {
    return process.env.AUTH_COOKIE_SECURE
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';
  }

  private getCookieSameSite(): 'lax' | 'strict' | 'none' {
    const value = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
    return value === 'strict' || value === 'none' ? value : 'lax';
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
