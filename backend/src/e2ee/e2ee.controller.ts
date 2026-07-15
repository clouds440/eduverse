import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { extractJwtFromRequest } from '../auth/jwt.strategy';
import { E2eeService } from './e2ee.service';
import { RegisterTrustedDeviceDto } from './dto/register-trusted-device.dto';
import { UpdateTrustedDeviceDto } from './dto/update-trusted-device.dto';
import { RecipientDevicesDto } from './dto/recipient-devices.dto';
import { ApproveTrustedDeviceDto } from './dto/approve-trusted-device.dto';

@UseGuards(JwtAuthGuard)
@Access(AccessLevel.NONE)
@Controller('e2ee')
export class E2eeController {
  constructor(private readonly e2eeService: E2eeService) {}

  @Post('devices/current')
  registerCurrentDevice(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RegisterTrustedDeviceDto,
  ) {
    return this.e2eeService.registerCurrentDevice(req.user, dto);
  }

  @Get('devices/me')
  listMyDevices(@Request() req: AuthenticatedRequest) {
    return this.e2eeService.listMyDevices(req.user.id);
  }

  @Patch('devices/:deviceId')
  updateMyDevice(
    @Request() req: AuthenticatedRequest,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateTrustedDeviceDto,
  ) {
    return this.e2eeService.updateMyDevice(req.user.id, deviceId, dto);
  }

  @Delete('devices/:deviceId')
  revokeMyDevice(
    @Request() req: AuthenticatedRequest,
    @Param('deviceId') deviceId: string,
  ) {
    return this.e2eeService.revokeMyDevice(req.user, deviceId, this.getAuthToken(req));
  }

  @Post('devices/:deviceId/approve')
  approveMyPendingDevice(
    @Request() req: AuthenticatedRequest,
    @Param('deviceId') deviceId: string,
    @Body() dto: ApproveTrustedDeviceDto,
  ) {
    return this.e2eeService.approveMyPendingDevice(req.user, deviceId, dto, this.getAuthToken(req));
  }

  @Post('devices/:deviceId/request-approval')
  requestPendingDeviceApproval(
    @Request() req: AuthenticatedRequest,
    @Param('deviceId') deviceId: string,
  ) {
    return this.e2eeService.requestPendingDeviceApproval(req.user, deviceId);
  }

  @Get('devices/:deviceId/approval-context')
  getPendingDeviceApprovalContext(
    @Request() req: AuthenticatedRequest,
    @Param('deviceId') deviceId: string,
    @Query('approverDeviceId') approverDeviceId: string,
  ) {
    return this.e2eeService.getPendingDeviceApprovalContext(req.user, deviceId, approverDeviceId, this.getAuthToken(req));
  }

  @Post('recipient-devices')
  getRecipientDevices(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RecipientDevicesDto,
  ) {
    return this.e2eeService.getRecipientDevices(req.user, dto.userIds);
  }

  private getAuthToken(req: AuthenticatedRequest) {
    return extractJwtFromRequest(req as ExpressRequest) || undefined;
  }
}
