import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AcademicCycleStatus,
  CurriculumStatus,
  DepartmentScopeType,
  OnlineAdmissionSubmissionStatus,
  OrgStatus,
  ProgramCompletionMode,
  ProgramProgressionMode,
  ProgramStatus,
  ProgramStructureType,
  ProgramOfferingStatus,
  Role,
  StudentProgramEnrollmentStatus,
  UserStatus,
} from '@/prisma/prisma-client';
import { AppModule } from '../src/app.module';
import { AccessLevel } from '../src/common/access-control/access-level.enum';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/security/email.service';

const ids = {
  org: 'admissions-e2e-org',
  computing: 'admissions-e2e-computing',
  business: 'admissions-e2e-business',
  admin: 'admissions-e2e-admin',
  computingAdmin: 'admissions-e2e-computing-admin',
  businessAdmin: 'admissions-e2e-business-admin',
  cycle: 'admissions-e2e-cycle',
  studentUser: 'admissions-e2e-student-user',
  student: 'admissions-e2e-student',
};

describe('Online admissions API (disposable database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  let computing: Awaited<ReturnType<typeof createProgramFixture>>;
  let business: Awaited<ReturnType<typeof createProgramFixture>>;
  let publicSubmissionId: string;
  let admittedSubmissionId: string;

  beforeAll(async () => {
    if (process.env.ONLINE_ADMISSIONS_DISPOSABLE_DATABASE !== 'true') {
      throw new Error('Online admissions e2e tests require the disposable database runner');
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ send: jest.fn().mockResolvedValue(undefined) })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await fixture();
    tokens.admin = await session(ids.admin);
    tokens.computing = await session(ids.computingAdmin);
    tokens.business = await session(ids.businessAdmin);
  }, 120_000);

  afterAll(async () => app?.close());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createProgramFixture(departmentId: string, suffix: string) {
    const program = await prisma.program.create({
      data: {
        organizationId: ids.org,
        departmentId,
        name: `${suffix} Program`,
        code: suffix,
        status: ProgramStatus.ACTIVE,
        structureType: ProgramStructureType.TERM_BASED,
        progressionMode: ProgramProgressionMode.SEQUENTIAL,
        completionMode: ProgramCompletionMode.FINAL_STAGE,
        isVisibleForAdmissions: true,
      },
    });
    const revision = await prisma.programConfigurationRevision.create({
      data: {
        organizationId: ids.org,
        programId: program.id,
        version: 1,
        configurationSnapshot: {},
        checksum: `${suffix}-checksum`,
        createdById: ids.admin,
      },
    });
    const curriculum = await prisma.curriculumVersion.create({
      data: {
        organizationId: ids.org,
        programId: program.id,
        programConfigurationRevisionId: revision.id,
        name: `${suffix} Curriculum`,
        code: `${suffix}-CURR`,
        status: CurriculumStatus.ACTIVE,
        isDefaultForAdmissions: true,
      },
    });
    const stage = await prisma.programStage.create({
      data: {
        organizationId: ids.org,
        curriculumVersionId: curriculum.id,
        name: 'Stage 1',
        code: `${suffix}-S1`,
        sequence: 1,
      },
    });
    const offering = await prisma.programOffering.create({
      data: {
        organizationId: ids.org,
        programId: program.id,
        curriculumVersionId: curriculum.id,
        academicCycleId: ids.cycle,
        status: ProgramOfferingStatus.OPEN,
        onlineAdmissionEnabled: true,
        createdById: ids.admin,
      },
    });
    return { program, revision, curriculum, stage, offering };
  }

  async function fixture() {
    await prisma.organization.create({
      data: {
        id: ids.org,
        name: 'Admissions Institute',
        slug: 'admissions-institute',
        location: 'Lahore',
        type: 'UNIVERSITY',
        contactEmail: 'admissions@example.test',
        status: OrgStatus.APPROVED,
        onlineAdmissionsEnabled: true,
      },
    });
    await prisma.department.createMany({
      data: [
        { id: ids.computing, organizationId: ids.org, name: 'Computing', code: 'COMP' },
        { id: ids.business, organizationId: ids.org, name: 'Business', code: 'BUS' },
      ],
    });
    await prisma.user.createMany({
      data: [
        { id: ids.admin, organizationId: ids.org, email: 'admin@admissions.test', password: 'unused', name: 'Admin', role: Role.ORG_ADMIN, status: UserStatus.ACTIVE },
        { id: ids.computingAdmin, organizationId: ids.org, email: 'computing@admissions.test', password: 'unused', name: 'Computing Admin', role: Role.SUB_ADMIN, status: UserStatus.ACTIVE, departmentScopeType: DepartmentScopeType.SELECTED },
        { id: ids.businessAdmin, organizationId: ids.org, email: 'business@admissions.test', password: 'unused', name: 'Business Admin', role: Role.SUB_ADMIN, status: UserStatus.ACTIVE, departmentScopeType: DepartmentScopeType.SELECTED },
        { id: ids.studentUser, organizationId: ids.org, email: 'student@admissions.test', password: 'unused', name: 'Admitted Student', role: Role.STUDENT, status: UserStatus.ACTIVE },
      ],
    });
    await prisma.subAdminDepartment.createMany({
      data: [
        { organizationId: ids.org, userId: ids.computingAdmin, departmentId: ids.computing },
        { organizationId: ids.org, userId: ids.businessAdmin, departmentId: ids.business },
      ],
    });
    await prisma.academicCycle.create({
      data: {
        id: ids.cycle,
        organizationId: ids.org,
        name: 'Fall 2026',
        code: 'FALL-2026',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-31'),
        status: AcademicCycleStatus.ACTIVE,
      },
    });
    computing = await createProgramFixture(ids.computing, 'CS');
    business = await createProgramFixture(ids.business, 'BBA');
    await prisma.onlineAdmissionSubmission.create({
      data: {
        publicReference: 'OA-BUSINESS-1',
        organizationId: ids.org,
        departmentId: ids.business,
        programId: business.program.id,
        programOfferingId: business.offering.id,
        academicCycleId: ids.cycle,
        applicantEmail: 'business-applicant@example.test',
        applicantName: 'Business Applicant',
        formData: {},
      },
    });
    const admitSubmission = await prisma.onlineAdmissionSubmission.create({
      data: {
        publicReference: 'OA-ADMIT-1',
        organizationId: ids.org,
        departmentId: ids.computing,
        programId: computing.program.id,
        programOfferingId: computing.offering.id,
        academicCycleId: ids.cycle,
        applicantEmail: 'admit-applicant@example.test',
        applicantName: 'Admit Applicant',
        status: OnlineAdmissionSubmissionStatus.ACCEPTED,
        formData: {},
      },
    });
    admittedSubmissionId = admitSubmission.id;
    await prisma.student.create({
      data: {
        id: ids.student,
        userId: ids.studentUser,
        organizationId: ids.org,
        registrationNumber: 'OA-REG-1',
        rollNumber: 'OA-ROLL-1',
        primaryDepartmentId: ids.computing,
      },
    });
    await prisma.studentProgramEnrollment.create({
      data: {
        organizationId: ids.org,
        studentId: ids.student,
        programId: computing.program.id,
        curriculumVersionId: computing.curriculum.id,
        programConfigurationRevisionId: computing.revision.id,
        status: StudentProgramEnrollmentStatus.ADMITTED,
        openSlot: `student:${ids.student}`,
        requiredStageCountSnapshot: 1,
        programConfigurationVersionSnapshot: 1,
        curriculumSnapshotHash: computing.revision.checksum,
        progressionModeSnapshot: ProgramProgressionMode.SEQUENTIAL,
        completionModeSnapshot: ProgramCompletionMode.FINAL_STAGE,
        minimumPassingPercentageSnapshot: 50,
        entryStageId: computing.stage.id,
        admittedById: ids.admin,
      },
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
    await prisma.session.create({ data: { userId, deviceId: 'online-admissions-e2e', token, expiresAt: new Date(Date.now() + 3_600_000) } });
    return token;
  }

  async function challengeAnswer(purpose: string) {
    const response = await request(app.getHttpServer())
      .get('/public/human-verification/challenge')
      .query({ purpose })
      .expect(200);
    const match = String(response.body.prompt).match(/(\d+)\s*([+\-x])\s*(\d+)/);
    if (!match) throw new Error('Unexpected challenge prompt');
    const left = Number(match[1]);
    const right = Number(match[3]);
    const answer = match[2] === '+' ? left + right : match[2] === '-' ? left - right : left * right;
    return { challengeId: response.body.challengeId, challengeAnswer: String(answer) };
  }

  it('allows public discovery and a challenge-verified submission without authentication', async () => {
    const organizations = await request(app.getHttpServer())
      .get('/public/online-admissions/organizations')
      .expect(200);
    expect(organizations.body[0]).toMatchObject({ slug: 'admissions-institute' });
    const verification = await challengeAnswer('ONLINE_ADMISSION');
    const submitted = await request(app.getHttpServer())
      .post(`/public/online-admissions/offerings/${computing.offering.id}/submissions`)
      .send({
        applicantName: 'Public Applicant',
        applicantEmail: 'public-applicant@example.test',
        formData: { gender: 'Other' },
        ...verification,
      })
      .expect(201);
    expect(submitted.body).toMatchObject({ status: OnlineAdmissionSubmissionStatus.SUBMITTED });
    const stored = await prisma.onlineAdmissionSubmission.findUniqueOrThrow({ where: { publicReference: submitted.body.reference } });
    publicSubmissionId = stored.id;
  });

  it('protects admin APIs and enforces selected department scope', async () => {
    await request(app.getHttpServer()).get('/org/online-admissions').expect(401);
    const computingList = await request(app.getHttpServer())
      .get('/org/online-admissions')
      .set(auth(tokens.computing))
      .expect(200);
    expect(computingList.body.data.map((row: { departmentId: string }) => row.departmentId)).toEqual([ids.computing, ids.computing]);
    const businessList = await request(app.getHttpServer())
      .get('/org/online-admissions')
      .set(auth(tokens.business))
      .expect(200);
    expect(businessList.body.data).toHaveLength(1);
    expect(businessList.body.data[0].departmentId).toBe(ids.business);
    await request(app.getHttpServer())
      .get(`/org/online-admissions/${publicSubmissionId}`)
      .set(auth(tokens.business))
      .expect(400);
  });

  it('retains rejected submissions in the rejected filter and exports scoped CSV', async () => {
    await request(app.getHttpServer())
      .patch(`/org/online-admissions/${publicSubmissionId}/status`)
      .set(auth(tokens.computing))
      .send({ status: OnlineAdmissionSubmissionStatus.REJECTED, note: 'Entry requirements not met' })
      .expect(200);
    const rejected = await request(app.getHttpServer())
      .get('/org/online-admissions')
      .query({ status: OnlineAdmissionSubmissionStatus.REJECTED })
      .set(auth(tokens.computing))
      .expect(200);
    expect(rejected.body.data).toEqual([expect.objectContaining({ id: publicSubmissionId, status: OnlineAdmissionSubmissionStatus.REJECTED })]);
    const csv = await request(app.getHttpServer())
      .get('/org/online-admissions/export.csv')
      .query({ status: OnlineAdmissionSubmissionStatus.REJECTED })
      .set(auth(tokens.computing))
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(csv.text).toContain('Public Applicant');
    expect(csv.text).not.toContain('Business Applicant');
  });

  it('links a matching student enrollment and finalizes the submission as admitted', async () => {
    const admitted = await request(app.getHttpServer())
      .patch(`/org/online-admissions/${admittedSubmissionId}/admit`)
      .set(auth(tokens.computing))
      .send({ studentId: ids.student })
      .expect(200);
    expect(admitted.body).toMatchObject({ status: OnlineAdmissionSubmissionStatus.ADMITTED, admittedStudentId: ids.student });
    const stored = await prisma.onlineAdmissionSubmission.findUniqueOrThrow({ where: { id: admittedSubmissionId } });
    expect(stored.admittedStudentId).toBe(ids.student);
  });
});
