import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('change-password')
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() body: ChangePasswordDto,
  ) {
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException('Validation failed');
    }
    return this.adminService.changeAdminPassword(
      req.user.id,
      body.oldPassword,
      body.newPassword,
    );
  }
}
