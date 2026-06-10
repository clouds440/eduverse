import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromoteStudentsDto } from './dto/promote-students.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  promote(@OrgId() orgId: string, @Body() dto: PromoteStudentsDto) {
    return this.promotionsService.promoteStudents(orgId, dto);
  }
}
