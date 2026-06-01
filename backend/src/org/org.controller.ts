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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums';

import { OrgService } from './org.service';
import { CoursesService } from '../courses/courses.service';
import { SectionsService } from '../sections/sections.service';
import { StudentService } from '../students/student.service';
import { TeacherService } from '../teacher/teacher.service';
import { InsightsService } from '../insights/insights.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { AttendanceService } from '../attendance/attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { CreateCourseDto } from '../courses/dto/create-course.dto';
import { UpdateCourseDto } from '../courses/dto/update-course.dto';
import { CreateSectionDto } from '../sections/dto/create-section.dto';
import { UpdateSectionDto } from '../sections/dto/update-section.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { OrgId } from '../common/decorators/org-id.decorator';
import { CreateAssessmentDto } from '../assessments/dto/create-assessment.dto';
import { UpdateAssessmentDto } from '../assessments/dto/update-assessment.dto';
import { UpdateGradeDto } from '../assessments/dto/update-grade.dto';
import { CreateSubmissionDto } from '../assessments/dto/create-submission.dto';
import { CreateScheduleDto } from '../attendance/dto/create-schedule.dto';
import { UpdateScheduleDto } from '../attendance/dto/update-schedule.dto';
import { AttendanceRecordDto } from '../attendance/dto/mark-attendance.dto';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org')
export class OrgController {
  constructor(
    private readonly orgService: OrgService,
    private readonly coursesService: CoursesService,
    private readonly sectionsService: SectionsService,
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
    private readonly insightsService: InsightsService,
    private readonly assessmentsService: AssessmentsService,
    private readonly attendanceService: AttendanceService,
  ) { }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('insights')
  getInsights(@OrgId() orgId: string, @Request() req: AuthenticatedRequest) {
    return this.insightsService.getInsights(orgId, req.user);
  }

  // --- Settings ---
  @Access(AccessLevel.NONE)
  @Get('settings')
  getSettings(@OrgId() orgId: string) {
    return this.orgService.getSettings(orgId);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.NONE)
  @Patch('settings')
  updateSettings(
    @OrgId() orgId: string,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.orgService.updateSettings(orgId, updateSettingsDto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.NONE)
  @Patch('settings/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: (req: AuthenticatedRequest, _file: any) => {
          const orgId = req.user?.organizationId ?? 'unknown';
          const fileName = _file.originalname
            .replace(/\s+/g, '-')
            .split('.')
            .slice(0, -1)
            .join('.');
          return {
            folder: `eduverse/orgs/${orgId}/orgLogo`,
            resource_type: 'auto',
            public_id: `${Date.now()}-${fileName}`,
          };
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB hard cap
    }),
  )
  async updateLogo(
    @UploadedFile() file: Express.Multer.File,
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const ALLOWED_IMAGE_TYPES = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]);

    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Only images are accepted for logos.`,
      );
    }

    return this.orgService.updateLogo(orgId, file, req.user.id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.NONE)
  @Patch('reapply')
  reapply(@OrgId() orgId: string) {
    return this.orgService.reapply(orgId);
  }

  // --- Courses ---
  @Get('courses')
  async getCourses(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('my') my?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.coursesService.getCourses(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      my: my === 'true',
      userId: req?.user?.id,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post('courses')
  createCourse(
    @OrgId() orgId: string,
    @Body() createCourseDto: CreateCourseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    createCourseDto.updatedBy = req.user.name || req.user.email;
    return this.coursesService.createCourse(orgId, createCourseDto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch('courses/:id')
  updateCourse(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    updateCourseDto.updatedBy = req.user.name || req.user.email;
    return this.coursesService.updateCourse(orgId, id, updateCourseDto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Delete('courses/:id')
  deleteCourse(@OrgId() orgId: string, @Param('id') id: string) {
    return this.coursesService.deleteCourse(orgId, id);
  }

  // --- Sections ---
  @Get('sections')
  async getSections(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('my') my?: string,
    @Query('academicCycleId') academicCycleId?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.sectionsService.getSections(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      my: my === 'true',
      userId: req?.user?.id,
      academicCycleId,
    });
  }

  @Get('sections/:id')
  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  getSection(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.getSection(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post('sections')
  createSection(
    @OrgId() orgId: string,
    @Body() createSectionDto: CreateSectionDto,
  ) {
    return this.sectionsService.createSection(orgId, createSectionDto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch('sections/:id')
  updateSection(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateSectionDto: UpdateSectionDto,
  ) {
    return this.sectionsService.updateSection(orgId, id, updateSectionDto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Delete('sections/:id')
  deleteSection(@OrgId() orgId: string, @Param('id') id: string) {
    return this.sectionsService.deleteSection(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('profile')
  async getProfile(@OrgId() orgId: string, @Request() req: AuthenticatedRequest) {
    if (req.user.role === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(req.user.id);
      if (!student) throw new NotFoundException('Student profile not found');
      return student;
    }

    if (req.user.role === Role.TEACHER || req.user.role === Role.ORG_MANAGER) {
      const teacher = await this.teacherService.getTeacherByUserId(req.user.id);
      if (!teacher) throw new NotFoundException('Teacher profile not found');
      return teacher;
    }

    throw new ForbiddenException('Profile access not allowed for this role');
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Access(AccessLevel.WRITE)
  @Patch('profile')
  async updateProfile(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Body() updateDto: UpdateStudentDto | UpdateTeacherDto,
  ) {
    if (req.user.role === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(req.user.id);
      if (!student) throw new NotFoundException('Student profile not found');

      // Strictly Allow only these fields for students
      const allowedFields = [
        'phone',
        'fatherName',
        'age',
        'address',
        'emergencyContact',
        'bloodGroup',
        'password',
      ];
      const filteredData = Object.keys(updateDto)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateDto[key];
          return obj;
        }, {});

      return this.studentService.updateStudent(orgId, student.id, filteredData, {
        role: Role.STUDENT,
        name: req.user.name,
        email: req.user.email!,
      });
    }

    if (req.user.role === Role.TEACHER || req.user.role === Role.ORG_MANAGER) {
      const teacher = await this.teacherService.getTeacherByUserId(req.user.id);
      if (!teacher) throw new NotFoundException('Teacher profile not found');

      // Standard protection for teachers updating their own profile
      const allowedFields = [
        'emergencyContact',
        'bloodGroup',
        'address',
        'password',
      ];
      const filteredData = Object.keys(updateDto)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateDto[key];
          return obj;
        }, {});

      return this.teacherService.updateTeacher(orgId, teacher.id, filteredData, {
        id: req.user.id,
        role: req.user.role,
      });
    }

    throw new ForbiddenException('Profile update not allowed for this role');
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Patch('users/:id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: (req: any, _file: any) => {
          const userId = req.params.id as string;
          const fileName = _file.originalname
            .replace(/\s+/g, '-')
            .split('.')
            .slice(0, -1)
            .join('.');
          return {
            folder: `eduverse/users/${userId}/avatar`,
            resource_type: 'auto',
            public_id: `${Date.now()}-${fileName}`,
          };
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updateUserAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const ALLOWED_IMAGE_TYPES = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]);

    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed.`,
      );
    }

    // Authorization check: User can update their own avatar, or ORG_ADMIN/MANAGER can update any
    if (
      req.user.role !== Role.ORG_ADMIN &&
      req.user.role !== Role.ORG_MANAGER &&
      req.user.id !== id
    ) {
      throw new ForbiddenException('You can only update your own avatar');
    }

    return this.orgService.updateUserAvatar(id, file, req.user.id);
  }

  // --- Assessments ---
  @Roles(Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Post('assessments')
  createAssessment(
    @OrgId() orgId: string,
    @Body() dto: CreateAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.createAssessment(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('assessments')
  getAssessments(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('sectionId') sectionId?: string,
    @Query('courseId') courseId?: string,
    @Query('academicCycleId') academicCycleId?: string,
  ) {
    return this.assessmentsService.getAssessments(orgId, req.user, {
      sectionId,
      courseId,
      academicCycleId,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Patch('assessments/:id')
  updateAssessment(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.updateAssessment(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Get('assessments/:id')
  getAssessment(@OrgId() orgId: string, @Param('id') id: string) {
    return this.assessmentsService.getAssessment(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Delete('assessments/:id')
  deleteAssessment(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.deleteAssessment(orgId, id, req.user);
  }

  @Get('grades/final')
  getStudentFinalGrades(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.getStudentFinalGrades(orgId, req.user.id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('assessments/:id/grades')
  getGrades(
    @OrgId() orgId: string,
    @Param('id') assessmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.getGrades(orgId, assessmentId, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Patch('assessments/:id/grades/:studentId')
  updateGrade(
    @OrgId() orgId: string,
    @Param('id') assessmentId: string,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateGradeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.updateGrade(
      orgId,
      assessmentId,
      studentId,
      dto,
      req.user.id,
      req.user.role.toString() as Role,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Patch('assessments/:id/publish')
  publishGrades(@OrgId() orgId: string, @Param('id') id: string) {
    return this.assessmentsService.publishGrades(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Patch('assessments/:id/finalize')
  finalizeGrades(@OrgId() orgId: string, @Param('id') id: string) {
    return this.assessmentsService.finalizeGrades(orgId, id);
  }

  // --- Submissions ---
  @Roles(Role.STUDENT)
  @Access(AccessLevel.WRITE)
  @Post('assessments/:id/submissions')
  createSubmission(
    @OrgId() orgId: string,
    @Param('id') assessmentId: string,
    @Body() dto: CreateSubmissionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    // Find student profile for the current user
    return this.studentService.getStudentByUserId(req.user.id).then((student) => {
      if (!student) throw new NotFoundException('Student profile not found');
      return this.assessmentsService.createSubmission(orgId, student.id, {
        ...dto,
        assessmentId,
      });
    });
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('assessments/:id/submissions')
  getSubmissions(
    @OrgId() orgId: string,
    @Param('id') assessmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assessmentsService.getSubmissions(orgId, assessmentId, req.user);
  }

  // --- Final Results ---
  @Get('students/:id/final-grades')
  getFinalGrades(
    @OrgId() orgId: string,
    @Param('id') studentId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.assessmentsService.calculateFinalGrade(studentId, sectionId);
  }

  // --- Timetable & Schedules ---
  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post('sections/:id/schedules')
  createSchedule(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.attendanceService.createSchedule(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch('sections/:id/schedules/:scheduleId')
  updateSchedule(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.attendanceService.updateSchedule(orgId, scheduleId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Delete('sections/:id/schedules/:scheduleId')
  deleteSchedule(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.attendanceService.deleteSchedule(orgId, scheduleId);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('sections/:id/schedules')
  getSchedules(@OrgId() orgId: string, @Param('id') id: string) {
    return this.attendanceService.getSchedules(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('timetable')
  getTimetable(@OrgId() orgId: string, @Request() req: AuthenticatedRequest) {
    if (req.user.role === Role.STUDENT) {
      return this.studentService.getStudentTimetable(orgId, req.user.id);
    }
    // For Teacher, Manager - show teaching schedule if they have a teacher record
    return this.teacherService.getTeacherTimetable(orgId, req.user.id);
  }

  // --- Attendance ---
  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Post('sections/:id/attendance/sessions')
  createAttendanceSession(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body('date') date: string,
    @Body('scheduleId') scheduleId?: string,
    @Body('startTime') startTime?: string,
    @Body('endTime') endTime?: string,
  ) {
    return this.attendanceService.createAttendanceSession(
      orgId,
      id,
      req.user,
      date,
      scheduleId,
      startTime,
      endTime,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Post('attendance/:sessionId')
  markAttendance(
    @OrgId() orgId: string,
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
    @Body() records: AttendanceRecordDto[],
  ) {
    return this.attendanceService.markAttendance(orgId, sessionId, req.user, records);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('sections/:id/attendance')
  getSectionAttendance(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Query('date') date: string,
    @Query('scheduleId') scheduleId?: string,
  ) {
    if (!date) throw new BadRequestException('Query parameter "date" is required');
    return this.attendanceService.getSectionAttendance(orgId, id, req.user, date, scheduleId);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('sections/:id/attendance/range')
  getSectionAttendanceRange(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!start || !end) throw new BadRequestException('Query parameters "start" and "end" are required');
    return this.attendanceService.getSectionAttendanceRange(orgId, id, req.user, start, end);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('students/:id/attendance')
  getStudentAttendance(
    @OrgId() orgId: string,
    @Param('id') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.getStudentAttendance(orgId, studentId, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('teachers/by-user/:userId')
  getTeacherByUserId(@OrgId() orgId: string, @Param('userId') userId: string) {
    return this.teacherService.getTeacherByUserId(userId);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('students/by-user/:userId')
  getStudentByUserId(@OrgId() orgId: string, @Param('userId') userId: string) {
    return this.studentService.getStudentByUserId(userId);
  }
}
