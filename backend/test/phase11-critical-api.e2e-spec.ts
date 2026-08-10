import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  DepartmentScopeType,
  OrgStatus,
  Role,
  UserStatus,
} from '@/prisma/prisma-client';
import { AppModule } from '../src/app.module';
import { AccessLevel } from '../src/common/access-control/access-level.enum';
import { PrismaService } from '../src/prisma/prisma.service';

const ids = {
  org: 'critical-org',
  otherOrg: 'critical-other-org',
  department: 'critical-department',
  otherDepartment: 'critical-other-department',
  course: 'critical-course',
  admin: 'critical-admin',
  scopedAdmin: 'critical-scoped-admin',
  otherScopedAdmin: 'critical-other-scoped-admin',
  student: 'critical-student',
  studentUser: 'critical-student-user',
};

describe('Critical programs API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    if (process.env.PHASE11_DISPOSABLE_DATABASE !== 'true') {
      throw new Error('Critical API tests require the disposable database runner');
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await fixture();
    tokens.admin = await session(ids.admin);
    tokens.scoped = await session(ids.scopedAdmin);
    tokens.otherScoped = await session(ids.otherScopedAdmin);
  }, 120_000);

  afterAll(async () => app?.close());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function fixture() {
    await prisma.organization.createMany({
      data: [
        { id: ids.org, name: 'Critical Institute', slug: 'critical-institute', location: 'Lahore', type: 'UNIVERSITY', contactEmail: 'critical@example.test', status: OrgStatus.APPROVED },
        { id: ids.otherOrg, name: 'Other Institute', slug: 'other-institute', location: 'Karachi', type: 'COLLEGE', contactEmail: 'other@example.test', status: OrgStatus.APPROVED },
      ],
    });
    await prisma.department.createMany({
      data: [
        { id: ids.department, organizationId: ids.org, name: 'Computing', code: 'COMP' },
        { id: ids.otherDepartment, organizationId: ids.org, name: 'Business', code: 'BUS' },
      ],
    });
    await prisma.course.create({
      data: { id: ids.course, organizationId: ids.org, departmentId: ids.department, name: 'Programming', code: 'CS-101', creditHours: 3 },
    });
    await prisma.user.createMany({
      data: [
        { id: ids.admin, organizationId: ids.org, email: 'admin@critical.test', password: 'unused', name: 'Admin', role: Role.ORG_ADMIN, status: UserStatus.ACTIVE },
        { id: ids.scopedAdmin, organizationId: ids.org, email: 'scoped@critical.test', password: 'unused', name: 'Scoped Admin', role: Role.SUB_ADMIN, status: UserStatus.ACTIVE, departmentScopeType: DepartmentScopeType.SELECTED },
        { id: ids.otherScopedAdmin, organizationId: ids.org, email: 'other-scoped@critical.test', password: 'unused', name: 'Other Scoped Admin', role: Role.SUB_ADMIN, status: UserStatus.ACTIVE, departmentScopeType: DepartmentScopeType.SELECTED },
        { id: ids.studentUser, organizationId: ids.org, email: 'student@critical.test', password: 'unused', name: 'Student', role: Role.STUDENT, status: UserStatus.ACTIVE },
      ],
    });
    await prisma.subAdminDepartment.createMany({
      data: [
        { organizationId: ids.org, userId: ids.scopedAdmin, departmentId: ids.department },
        { organizationId: ids.org, userId: ids.otherScopedAdmin, departmentId: ids.otherDepartment },
      ],
    });
    await prisma.student.create({
      data: { id: ids.student, userId: ids.studentUser, organizationId: ids.org, registrationNumber: 'REG-001', rollNumber: 'ROLL-001' },
    });
  }

  async function session(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { organization: true } });
    const token = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.organizationId,
      status: user.organization?.status,
      userStatus: user.status,
      accessLevel: AccessLevel.WRITE,
    });
    await prisma.session.create({ data: { userId, deviceId: 'critical-api', token, expiresAt: new Date(Date.now() + 3_600_000) } });
    return token;
  }

  it('exposes liveness/readiness and protects organization APIs', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200).expect({ status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(200).expect({ status: 'ready' });
    await request(app.getHttpServer()).get('/org/programs').expect(401);
  });

  it('runs the current stable-program, offering, and student-placement lifecycle', async () => {
    const programPayload = {
      name: 'BS Computer Science',
      code: 'BSCS',
      departmentId: ids.department,
      structureType: 'TERM_BASED',
      progressionMode: 'SEQUENTIAL',
      completionMode: 'FINAL_STAGE',
      isVisibleForAdmissions: true,
      curriculumName: 'BSCS 2026',
      curriculumCode: 'BSCS-2026',
      stages: [{
        name: 'Semester 1',
        code: 'SEM-1',
        courseRequirements: [{ courseId: ids.course, requirementType: 'REQUIRED' }],
      }],
    };
    const program = await request(app.getHttpServer())
      .post('/org/programs')
      .set(auth(tokens.scoped))
      .send(programPayload)
      .expect(201);

    expect(program.body).not.toHaveProperty('academicCycles');
    const curriculum = program.body.curriculumVersions[0];
    const stage = curriculum.stages[0];
    await request(app.getHttpServer())
      .post('/org/programs')
      .set(auth(tokens.otherScoped))
      .send({ ...programPayload, code: 'DENIED', name: 'Denied Program' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/org/programs/curricula/${curriculum.id}/status`)
      .set(auth(tokens.scoped))
      .send({ status: 'ACTIVE', defaultForAdmissions: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/org/programs/${program.body.id}/status`)
      .set(auth(tokens.scoped))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const cycle = await request(app.getHttpServer())
      .post('/org/academic-cycles')
      .set(auth(tokens.admin))
      .send({ name: 'Fall 2026', code: 'FALL-2026', startDate: '2026-09-01', endDate: '2026-12-31' })
      .expect(201);
    const offering = await request(app.getHttpServer())
      .post('/org/program-offerings')
      .set(auth(tokens.scoped))
      .send({
        programId: program.body.id,
        curriculumVersionId: curriculum.id,
        academicCycleId: cycle.body.id,
        stages: [{ programStageId: stage.id }],
      })
      .expect(201);

    const readiness = await request(app.getHttpServer())
      .get(`/org/program-offerings/${offering.body.id}/readiness`)
      .set(auth(tokens.scoped))
      .expect(200);
    expect(readiness.body.readyForAdmissions).toBe(true);
    expect(readiness.body.readyForDelivery).toBe(false);

    const opened = await request(app.getHttpServer())
      .patch(`/org/program-offerings/${offering.body.id}`)
      .set(auth(tokens.scoped))
      .send({ status: 'OPEN', stages: [{ programStageId: stage.id, status: 'OPEN' }] })
      .expect(200);
    const stageOffering = opened.body.stageOfferings[0];

    const publicResult = await request(app.getHttpServer())
      .get('/public/organizations/critical-institute/program-offerings')
      .expect(200);
    expect(publicResult.body.offerings[0].eligibleEntryCycles).toEqual([
      expect.objectContaining({ programOfferingId: offering.body.id }),
    ]);

    const admitted = await request(app.getHttpServer())
      .post(`/org/students/${ids.student}/program-enrollments/admit`)
      .set(auth(tokens.scoped))
      .send({ programId: program.body.id })
      .expect(201);
    expect(admitted.body.stageEnrollments).toHaveLength(0);
    await request(app.getHttpServer())
      .post(`/org/students/${ids.student}/program-enrollments/${admitted.body.id}/stages/activate`)
      .set(auth(tokens.scoped))
      .send({ programStageOfferingId: stageOffering.id })
      .expect(201);
    const history = await request(app.getHttpServer())
      .get(`/org/students/${ids.student}/program-enrollments`)
      .set(auth(tokens.scoped))
      .expect(200);
    expect(history.body[0].stageEnrollments[0]).toMatchObject({
      programStageId: stage.id,
      programStageOfferingId: stageOffering.id,
      cycleCodeSnapshot: 'FALL-2026',
    });
  }, 60_000);
});
