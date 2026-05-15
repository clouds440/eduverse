import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { Role, StudentStatus } from '../common/enums';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreateStudentDto } from '../org/dto/create-student.dto';
import { UpdateStudentDto } from '../org/dto/update-student.dto';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org')
export class StudentController {
  constructor(private readonly studentService: StudentService) { }

  @Get('students')
  async getStudents(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('my') my?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
    @Query('deleted') deleted?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.studentService.getStudents(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      my: my === 'true',
      sectionId,
      userId: req?.user?.id,
      status,
      deleted: deleted === 'true',
    });
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('students/:id')
  getStudent(
    @OrgId() orgId: string, 
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.studentService.getStudent(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post('students')
  createStudent(
    @OrgId() orgId: string,
    @Body() createStudentDto: CreateStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.studentService.createStudent(orgId, createStudentDto, {
      name: req.user.name,
      email: req.user.email!,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch('students/:id')
  updateStudent(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.studentService.updateStudent(orgId, id, updateStudentDto, {
      role: req.user.role.toString() as Role,
      name: req.user.name,
      email: req.user.email!,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch('students/:id/restore')
  restoreStudent(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('status') status?: string,
  ) {
    return this.studentService.restoreStudent(orgId, id, status as StudentStatus);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Delete('students/:id')
  deleteStudent(
    @OrgId() orgId: string,
    @Param('id') id: string,
  ) {
    return this.studentService.deleteStudent(orgId, id);
  }
}
