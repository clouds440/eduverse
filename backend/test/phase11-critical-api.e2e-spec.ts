import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { performance } from 'perf_hooks';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FilesService } from '../src/files/files.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Phase11FilesService } from './phase11-files.service';

const phase11Metrics: Record<string, number> = {};
import {
  createPhase11Session,
  ensurePhase11ReleaseScenario,
  phase11Ids,
} from './phase11-release-scenario';

describe('Phase 11 critical program API matrix', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    if (process.env.PHASE11_DISPOSABLE_DATABASE !== 'true') {
      throw new Error(
        'Phase 11 e2e tests require the disposable database runner',
      );
    }
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FilesService)
      .useClass(Phase11FilesService)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await ensurePhase11ReleaseScenario(prisma);
    tokens.adminA = await createPhase11Session(prisma, phase11Ids.orgAdminA);
    tokens.subAdminA = await createPhase11Session(prisma, phase11Ids.subAdminA);
    tokens.subAdminAllA = await createPhase11Session(
      prisma,
      phase11Ids.subAdminAllA,
    );
    tokens.financeA = await createPhase11Session(prisma, phase11Ids.financeA);
    tokens.managerA = await createPhase11Session(prisma, phase11Ids.managerA);
    tokens.teacherA = await createPhase11Session(prisma, phase11Ids.teacherA);
    tokens.teacherUnassignedA = await createPhase11Session(
      prisma,
      phase11Ids.teacherUnassignedA,
    );
    tokens.guardianA = await createPhase11Session(prisma, phase11Ids.guardianA);
    tokens.guardianUnrelatedA = await createPhase11Session(
      prisma,
      phase11Ids.guardianUnrelatedA,
    );
    tokens.studentArchive = await createPhase11Session(
      prisma,
      'phase11-user-student-archive',
    );
    tokens.adminB = await createPhase11Session(prisma, phase11Ids.orgAdminB);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const programPayload = (
    departmentId: string,
    name: string,
    code: string,
  ) => ({
    name,
    code,
    departmentId,
    structureType: 'TERM_BASED',
    progressionMode: 'SEQUENTIAL',
    completionMode: 'FINAL_STAGE',
    curriculumName: `${name} Curriculum`,
    curriculumCode: `${code}-CURR`,
    cycles: [
      {
        kind: 'EXISTING',
        academicCycleId: phase11Ids.cycleShared,
        stage: {
          name: 'Semester 1',
          code: `${code}-SEM-1`,
          courseRequirements: [
            {
              courseId: phase11Ids.courseA,
              requirementType: 'REQUIRED',
            },
          ],
        },
      },
    ],
  });

  it('builds the deterministic fixture idempotently', async () => {
    await ensurePhase11ReleaseScenario(prisma);
    await expect(
      prisma.organization.count({
        where: {
          id: { in: [phase11Ids.orgA, phase11Ids.orgB, phase11Ids.orgPending] },
        },
      }),
    ).resolves.toBe(3);
    await expect(
      prisma.program.count({ where: { organizationId: phase11Ids.orgA } }),
    ).resolves.toBe(2);
  });

  it('exposes minimal public liveness and database readiness probes', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });

  it('keeps the offerings route public and returns a shared cycle under both safe programs', async () => {
    const response = await request(app.getHttpServer())
      .get('/public/organizations/phase11-institute-a/program-offerings')
      .expect(200);

    expect(response.body.organization).toEqual({
      name: 'Phase 11 Institute A',
      slug: 'phase11-institute-a',
      logoUrl: null,
    });
    expect(response.body.offerings).toHaveLength(2);
    expect(
      response.body.offerings.map(
        (offering: any) => offering.eligibleEntryCycles[0].academicCycle.id,
      ),
    ).toEqual([phase11Ids.cycleShared, phase11Ids.cycleShared]);
    expect(
      new Set(
        response.body.offerings.map(
          (offering: any) =>
            offering.eligibleEntryCycles[0].programAcademicCycleId,
        ),
      ).size,
    ).toBe(2);
    expect(JSON.stringify(response.body)).not.toContain(phase11Ids.orgA);
    expect(JSON.stringify(response.body)).not.toContain('checksum');
  });

  it('does not publish pending or unknown organizations', async () => {
    await request(app.getHttpServer())
      .get('/public/organizations/phase11-pending/program-offerings')
      .expect(404);
    await request(app.getHttpServer())
      .get('/public/organizations/unknown/program-offerings')
      .expect(404);
  });

  it('requires authentication for protected program APIs', async () => {
    await request(app.getHttpServer()).get('/org/programs').expect(401);
  });

  it('reserves institute-cycle writes for org admins while keeping scoped reads available', async () => {
    await request(app.getHttpServer())
      .get('/org/academic-cycles')
      .set(auth(tokens.managerA))
      .expect(200);
    const active = await request(app.getHttpServer())
      .get('/org/academic-cycles/active')
      .set(auth(tokens.subAdminA))
      .expect(200);
    expect(active.body.id).toBe(phase11Ids.cycleShared);

    await request(app.getHttpServer())
      .post('/org/academic-cycles')
      .set(auth(tokens.subAdminA))
      .send({
        name: 'Denied Sub Admin Cycle',
        code: 'P11-DENIED-SUB-CYCLE',
        startDate: '2028-01-01',
        endDate: '2028-05-31',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/org/academic-cycles/${phase11Ids.cycleShared}`)
      .set(auth(tokens.subAdminA))
      .send({ name: 'Denied' })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/org/academic-cycles')
      .set(auth(tokens.adminA))
      .send({
        name: 'Phase 11 API Cycle',
        code: 'P11-API-CYCLE',
        startDate: '2028-01-01',
        endDate: '2028-05-31',
      })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');

    await request(app.getHttpServer())
      .patch(`/org/academic-cycles/${created.body.id}`)
      .set(auth(tokens.adminA))
      .send({ name: 'Phase 11 API Cycle Updated' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/org/academic-cycles/${created.body.id}/status`)
      .set(auth(tokens.adminA))
      .send({ status: 'ACTIVE', reason: 'Concurrent active-cycle guard' })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/org/academic-cycles/${phase11Ids.cycleB}`)
      .set(auth(tokens.adminA))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/org/academic-cycles/${created.body.id}`)
      .set(auth(tokens.adminA))
      .expect(200);
  });

  it('returns only the signed-in organization programs', async () => {
    const own = await request(app.getHttpServer())
      .get('/org/programs?limit=20')
      .set(auth(tokens.adminA))
      .expect(200);
    expect(own.body.data.map((program: any) => program.id).sort()).toEqual(
      [phase11Ids.programA, phase11Ids.programA2].sort(),
    );

    const other = await request(app.getHttpServer())
      .get('/org/programs?limit=20')
      .set(auth(tokens.adminB))
      .expect(200);
    expect(other.body.data.map((program: any) => program.id)).toEqual([
      phase11Ids.programB,
    ]);
  });

  it('does not reveal a program belonging to another tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/org/programs/${phase11Ids.programB}`)
      .set(auth(tokens.adminA))
      .expect(404);
    expect(JSON.stringify(response.body)).not.toContain('Other Tenant Program');
  });

  it('enforces selected department scope on program reads', async () => {
    const list = await request(app.getHttpServer())
      .get('/org/programs?limit=20')
      .set(auth(tokens.subAdminA))
      .expect(200);
    expect(list.body.data.map((program: any) => program.id)).toEqual([
      phase11Ids.programA,
    ]);
    await request(app.getHttpServer())
      .get(`/org/programs/${phase11Ids.programA2}`)
      .set(auth(tokens.subAdminA))
      .expect(400);
  });

  it('enforces explicit department assignments on every sub-admin program write', async () => {
    const assigned = await request(app.getHttpServer())
      .post('/org/programs')
      .set(auth(tokens.subAdminAllA))
      .send(
        programPayload(
          phase11Ids.departmentA,
          'Assigned Department Program',
          'P11-ASSIGNED',
        ),
      )
      .expect(201);

    await request(app.getHttpServer())
      .post('/org/programs')
      .set(auth(tokens.subAdminAllA))
      .send(
        programPayload(
          phase11Ids.departmentA2,
          'Unassigned Department Program',
          'P11-UNASSIGNED',
        ),
      )
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/org/programs/${assigned.body.id}`)
      .set(auth(tokens.subAdminAllA))
      .send({ description: 'Allowed assigned-department edit' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/org/programs/${phase11Ids.programA2}`)
      .set(auth(tokens.adminA))
      .send({ description: 'Organization admin can edit every department' })
      .expect(200);

    const unassignedProgram = await prisma.program.findUniqueOrThrow({
      where: { id: phase11Ids.programA2 },
      include: {
        curriculumVersions: {
          include: {
            stages: { include: { courseRequirements: true } },
          },
        },
      },
    });
    const curriculum = unassignedProgram.curriculumVersions[0];
    const stage = curriculum.stages[0];
    const requirement = stage.courseRequirements[0];

    const deniedWrites: Array<{
      method: 'post' | 'patch' | 'put' | 'delete';
      path: string;
      body?: Record<string, unknown>;
    }> = [
      {
        method: 'patch',
        path: `/org/programs/${phase11Ids.programA2}`,
        body: { description: 'Denied' },
      },
      {
        method: 'put',
        path: `/org/programs/${phase11Ids.programA2}/cycles`,
        body: {
          configurationVersion: unassignedProgram.configurationVersion,
          changeReason: 'Denied',
          curriculumName: 'Denied',
          curriculumCode: 'P11-DENIED-CURR',
          cycles: programPayload(
            phase11Ids.departmentA2,
            'Denied',
            'P11-DENIED',
          ).cycles,
        },
      },
      {
        method: 'patch',
        path: `/org/programs/${phase11Ids.programA2}/status`,
        body: { status: 'PAUSED' },
      },
      {
        method: 'delete',
        path: `/org/programs/${phase11Ids.programA2}`,
      },
      {
        method: 'post',
        path: `/org/programs/${phase11Ids.programA2}/curricula`,
        body: { name: 'Denied Curriculum', code: 'P11-DENIED-CURR-2' },
      },
      {
        method: 'patch',
        path: `/org/programs/curricula/${curriculum.id}`,
        body: { name: 'Denied Curriculum Edit' },
      },
      {
        method: 'patch',
        path: `/org/programs/curricula/${curriculum.id}/status`,
        body: { status: 'RETIRED' },
      },
      {
        method: 'post',
        path: `/org/programs/curricula/${curriculum.id}/stages`,
        body: {
          programAcademicCycleId: stage.programAcademicCycleId,
          name: 'Denied Stage',
          code: 'P11-DENIED-STAGE',
          sequence: 3,
        },
      },
      {
        method: 'patch',
        path: `/org/programs/stages/${stage.id}`,
        body: { name: 'Denied Stage Edit' },
      },
      {
        method: 'delete',
        path: `/org/programs/stages/${stage.id}`,
      },
      {
        method: 'post',
        path: `/org/programs/stages/${stage.id}/requirements`,
        body: {
          courseId: phase11Ids.courseA2,
          requirementType: 'REQUIRED',
        },
      },
      {
        method: 'patch',
        path: `/org/programs/requirements/${requirement.id}`,
        body: {
          courseId: phase11Ids.courseA2,
          requirementType: 'REQUIRED',
        },
      },
      {
        method: 'delete',
        path: `/org/programs/requirements/${requirement.id}`,
      },
    ];

    for (const denied of deniedWrites) {
      const call = request(app.getHttpServer())
        [denied.method](denied.path)
        .set(auth(tokens.subAdminAllA));
      if (denied.body) call.send(denied.body);
      await call.expect(400);
    }

    await expect(
      prisma.program.findFirst({
        where: {
          organizationId: phase11Ids.orgA,
          code: 'P11-UNASSIGNED',
        },
      }),
    ).resolves.toBeNull();
  });

  it('denies finance roles and rejects unexpected DTO fields without a 500', async () => {
    await request(app.getHttpServer())
      .get('/org/programs')
      .set(auth(tokens.financeA))
      .expect(403);
    const response = await request(app.getHttpServer())
      .post('/org/programs')
      .set(auth(tokens.adminA))
      .send({ name: 'Invalid', unexpected: true })
      .expect(400);
    expect(response.status).toBeLessThan(500);
  });

  it('admits a student atomically, snapshots the full plan, and rejects a second open major', async () => {
    const admitted = await request(app.getHttpServer())
      .post(`/org/students/${phase11Ids.studentA}/program-enrollments/admit`)
      .set(auth(tokens.adminA))
      .send({
        programId: phase11Ids.programA,
        entryAcademicCycleId: phase11Ids.cycleShared,
      })
      .expect(201);
    expect(admitted.body).toMatchObject({
      studentId: phase11Ids.studentA,
      programId: phase11Ids.programA,
      requiredCycleCountSnapshot: 2,
      programConfigurationVersionSnapshot: 1,
    });
    expect(admitted.body.cycles).toHaveLength(2);

    await request(app.getHttpServer())
      .post(`/org/students/${phase11Ids.studentA}/program-enrollments/admit`)
      .set(auth(tokens.adminA))
      .send({ programId: phase11Ids.programA })
      .expect(409);

    const student = await prisma.student.findUniqueOrThrow({
      where: { id: phase11Ids.studentA },
    });
    expect(student.primaryDepartmentId).toBe(phase11Ids.departmentA);
  });

  it('blocks cross-tenant major admission and disallowed teacher writes', async () => {
    await request(app.getHttpServer())
      .post(`/org/students/${phase11Ids.studentB}/program-enrollments/admit`)
      .set(auth(tokens.adminA))
      .send({ programId: phase11Ids.programA })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/org/students/${phase11Ids.studentA}/program-enrollments/admit`)
      .set(auth(tokens.teacherA))
      .send({ programId: phase11Ids.programA })
      .expect(403);
  });

  it('rehearses mapped and standalone delivery plus durable student progression', async () => {
    const program = await prisma.program.findUniqueOrThrow({
      where: { id: phase11Ids.programA },
      include: {
        academicCycles: true,
        curriculumVersions: {
          where: { status: 'ACTIVE', isDefaultForAdmissions: true },
          include: {
            stages: { include: { courseRequirements: true } },
          },
        },
      },
    });
    const sharedAssociation = program.academicCycles.find(
      (row) => row.academicCycleId === phase11Ids.cycleShared,
    )!;
    const sharedStage = program.curriculumVersions[0].stages.find(
      (stage) => stage.programAcademicCycleId === sharedAssociation.id,
    )!;
    const sharedRequirement = sharedStage.courseRequirements[0];

    const mappedCohort = await request(app.getHttpServer())
      .post('/org/cohorts')
      .set(auth(tokens.adminA))
      .send({
        name: 'Phase 11 Mapped Cohort',
        code: 'P11-MAPPED-COHORT',
        academicCycleId: phase11Ids.cycleShared,
        status: 'ACTIVE',
        programClassificationStatus: 'PROGRAM_MAPPED',
        programAcademicCycleId: sharedAssociation.id,
        programStageId: sharedStage.id,
      })
      .expect(201);

    const mappedSection = await request(app.getHttpServer())
      .post('/org/sections')
      .set(auth(tokens.adminA))
      .send({
        name: 'Phase 11 Mapped Section',
        code: 'P11-MAPPED-SECTION',
        courseId: phase11Ids.courseA,
        academicCycleId: phase11Ids.cycleShared,
        cohortId: mappedCohort.body.id,
        status: 'ACTIVE',
        programClassificationStatus: 'PROGRAM_MAPPED',
        stageCourseRequirementIds: [sharedRequirement.id],
        teacherIds: ['phase11-teacher-a'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/org/sections')
      .set(auth(tokens.adminA))
      .send({
        name: 'Invalid Mapped Section',
        code: 'P11-INVALID-MAPPED',
        courseId: phase11Ids.courseA2,
        academicCycleId: phase11Ids.cycleShared,
        cohortId: mappedCohort.body.id,
        programClassificationStatus: 'PROGRAM_MAPPED',
        stageCourseRequirementIds: [sharedRequirement.id],
      })
      .expect(400);

    const standaloneSection = await request(app.getHttpServer())
      .post('/org/sections')
      .set(auth(tokens.adminA))
      .send({
        name: 'Phase 11 Standalone Section',
        code: 'P11-STANDALONE-SECTION',
        courseId: phase11Ids.courseA,
        academicCycleId: phase11Ids.cycleShared,
        status: 'ACTIVE',
        programClassificationStatus: 'STANDALONE',
        teacherIds: ['phase11-teacher-a'],
      })
      .expect(201);

    const admitted = await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/admit`,
      )
      .set(auth(tokens.adminA))
      .send({
        programId: phase11Ids.programA,
        entryAcademicCycleId: phase11Ids.cycleShared,
      })
      .expect(201);
    const originalSnapshot = JSON.stringify({
      revisionId: admitted.body.programConfigurationRevisionId,
      version: admitted.body.programConfigurationVersionSnapshot,
      checksum: admitted.body.programCyclePlanSnapshotHash,
      cycles: admitted.body.cycles.map((cycle: any) => ({
        academicCycleId: cycle.academicCycleId,
        sequence: cycle.sequenceSnapshot,
        stageId: cycle.programStageId,
      })),
    });

    await request(app.getHttpServer())
      .post(`/org/cohorts/${mappedCohort.body.id}/students`)
      .set(auth(tokens.adminA))
      .send({ studentIds: [phase11Ids.studentProgress] })
      .expect(201);
    const mappedEnrollment = await prisma.enrollment.findUniqueOrThrow({
      where: {
        studentId_sectionId: {
          studentId: phase11Ids.studentProgress,
          sectionId: mappedSection.body.id,
        },
      },
    });
    expect(mappedEnrollment).toMatchObject({
      studentProgramEnrollmentId: admitted.body.id,
      source: 'COHORT',
    });
    expect(mappedEnrollment.studentStageAttemptId).toBeTruthy();

    await request(app.getHttpServer())
      .post('/org/enrollments')
      .set(auth(tokens.adminA))
      .send({
        studentId: phase11Ids.studentWithdraw,
        sectionId: standaloneSection.body.id,
      })
      .expect(201);
    const standaloneEnrollment = await prisma.enrollment.findUniqueOrThrow({
      where: {
        studentId_sectionId: {
          studentId: phase11Ids.studentWithdraw,
          sectionId: standaloneSection.body.id,
        },
      },
    });
    expect(standaloneEnrollment.studentProgramEnrollmentId).toBeNull();

    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/hold`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Phase 11 temporary hold' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/resume`,
      )
      .set(auth(tokens.adminA))
      .expect(201);

    const firstPlan = admitted.body.cycles[0];
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/cycles/${firstPlan.id}/complete`,
      )
      .set(auth(tokens.adminA))
      .send({
        reason: 'Completed first attempt',
        resultSnapshot: { grade: 'A' },
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/cycles/${firstPlan.id}/repeat`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Repeat verification', cohortId: mappedCohort.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/cycles/${firstPlan.id}/complete`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Completed repeated attempt' })
      .expect(201);

    const transferAdmission = await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentTransfer}/program-enrollments/admit`,
      )
      .set(auth(tokens.adminA))
      .send({ programId: phase11Ids.programA })
      .expect(201);
    const transferred = await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentTransfer}/program-enrollments/transfer`,
      )
      .set(auth(tokens.adminA))
      .send({ programId: phase11Ids.programA2, reason: 'Change of major' })
      .expect(201);
    expect(transferred.body.programId).toBe(phase11Ids.programA2);
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentTransfer}/program-enrollments/${transferred.body.id}/withdraw`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Student withdrew', retainPrimaryDepartment: true })
      .expect(201);
    await expect(
      prisma.studentProgramEnrollment.findUnique({
        where: { id: transferAdmission.body.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: 'TRANSFERRED_OUT' });

    await request(app.getHttpServer())
      .patch(`/org/academic-cycles/${phase11Ids.cycleShared}/status`)
      .set(auth(tokens.adminA))
      .send({ status: 'COMPLETED', reason: 'Phase 11 progression' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/org/academic-cycles/${phase11Ids.cycleNext}/status`)
      .set(auth(tokens.adminA))
      .send({ status: 'ACTIVE', reason: 'Phase 11 progression' })
      .expect(200);

    const secondPlan = admitted.body.cycles[1];
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/cycles/${secondPlan.id}/skip`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Approved prior learning' })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentProgress}/program-enrollments/${admitted.body.id}/complete`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'All requirements resolved' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/org/programs/${phase11Ids.programA}/status`)
      .set(auth(tokens.adminA))
      .send({ status: 'PAUSED', reason: 'Configuration rehearsal' })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/org/programs/${phase11Ids.programA}/cycles`)
      .set(auth(tokens.adminA))
      .send({
        configurationVersion: program.configurationVersion,
        changeReason: 'Phase 11 snapshot isolation rehearsal',
        curriculumName: 'Phase 11 Revised Curriculum',
        curriculumCode: 'P11-CS-REVISED',
        cycles: [
          {
            kind: 'EXISTING',
            academicCycleId: phase11Ids.cycleShared,
            stage: {
              name: 'Revised Semester 1',
              code: 'P11-CS-REV-SEM-1',
              courseRequirements: [
                {
                  courseId: phase11Ids.courseA,
                  requirementType: 'REQUIRED',
                },
              ],
            },
          },
          {
            kind: 'EXISTING',
            academicCycleId: phase11Ids.cycleNext,
            stage: {
              name: 'Revised Semester 2',
              code: 'P11-CS-REV-SEM-2',
              courseRequirements: [
                {
                  courseId: phase11Ids.courseA,
                  requirementType: 'REQUIRED',
                },
              ],
            },
          },
        ],
      })
      .expect(200);

    const persisted = await prisma.studentProgramEnrollment.findUniqueOrThrow({
      where: { id: admitted.body.id },
      include: { cycles: { orderBy: { sequenceSnapshot: 'asc' } } },
    });
    expect(
      JSON.stringify({
        revisionId: persisted.programConfigurationRevisionId,
        version: persisted.programConfigurationVersionSnapshot,
        checksum: persisted.programCyclePlanSnapshotHash,
        cycles: persisted.cycles.map((cycle) => ({
          academicCycleId: cycle.academicCycleId,
          sequence: cycle.sequenceSnapshot,
          stageId: cycle.programStageId,
        })),
      }),
    ).toBe(originalSnapshot);
    expect(persisted.status).toBe('COMPLETED');
  }, 120_000);

  it('preserves invariants under competing program, major, progression, and cycle writes', async () => {
    const concurrentAdmission = await Promise.all([
      request(app.getHttpServer())
        .post(
          `/org/students/${phase11Ids.studentWithdraw}/program-enrollments/admit`,
        )
        .set(auth(tokens.adminA))
        .send({ programId: phase11Ids.programA2 }),
      request(app.getHttpServer())
        .post(
          `/org/students/${phase11Ids.studentWithdraw}/program-enrollments/admit`,
        )
        .set(auth(tokens.adminA))
        .send({ programId: phase11Ids.programA2 }),
    ]);
    expect(
      concurrentAdmission.map((response) => response.status).sort(),
    ).toEqual([201, 409]);
    const admitted = concurrentAdmission.find(
      (response) => response.status === 201,
    )!.body;
    await expect(
      prisma.studentProgramEnrollment.count({
        where: {
          studentId: phase11Ids.studentWithdraw,
          status: { in: ['ADMITTED', 'ACTIVE', 'ON_HOLD'] },
        },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentWithdraw}/program-enrollments/${admitted.id}/cycles/${admitted.cycles[0].id}/skip`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Completed cycle accepted at entry' })
      .expect(201);

    const activationPath = `/org/students/${phase11Ids.studentWithdraw}/program-enrollments/${admitted.id}/cycles/activate`;
    const activationBody = {
      studentProgramEnrollmentCycleId: admitted.cycles[1].id,
      reason: 'Concurrent activation rehearsal',
    };
    const activations = await Promise.all([
      request(app.getHttpServer())
        .post(activationPath)
        .set(auth(tokens.adminA))
        .send(activationBody),
      request(app.getHttpServer())
        .post(activationPath)
        .set(auth(tokens.adminA))
        .send(activationBody),
    ]);
    expect(activations.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);

    const completionPath = `/org/students/${phase11Ids.studentWithdraw}/program-enrollments/${admitted.id}/cycles/${admitted.cycles[1].id}/complete`;
    const completions = await Promise.all([
      request(app.getHttpServer())
        .post(completionPath)
        .set(auth(tokens.adminA))
        .send({ reason: 'Concurrent completion rehearsal' }),
      request(app.getHttpServer())
        .post(completionPath)
        .set(auth(tokens.adminA))
        .send({ reason: 'Concurrent completion rehearsal' }),
    ]);
    expect(completions.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await expect(
      prisma.studentStageAttempt.count({
        where: {
          studentProgramEnrollmentCycleId: admitted.cycles[1].id,
          status: 'COMPLETED',
        },
      }),
    ).resolves.toBe(1);
    await request(app.getHttpServer())
      .post(
        `/org/students/${phase11Ids.studentWithdraw}/program-enrollments/${admitted.id}/withdraw`,
      )
      .set(auth(tokens.adminA))
      .send({ reason: 'Concurrency cleanup', retainPrimaryDepartment: true })
      .expect(201);

    const currentProgram = await prisma.program.findUniqueOrThrow({
      where: { id: phase11Ids.programA },
    });
    const replacement = {
      configurationVersion: currentProgram.configurationVersion,
      changeReason: 'Concurrent configuration rehearsal',
      curriculumName: 'Concurrent Curriculum',
      curriculumCode: 'P11-CS-CONCURRENT',
      cycles: [
        {
          kind: 'EXISTING',
          academicCycleId: phase11Ids.cycleShared,
          stage: {
            name: 'Concurrent Semester 1',
            code: 'P11-CONCURRENT-SEM-1',
            courseRequirements: [
              {
                courseId: phase11Ids.courseA,
                requirementType: 'REQUIRED',
              },
            ],
          },
        },
        {
          kind: 'EXISTING',
          academicCycleId: phase11Ids.cycleNext,
          stage: {
            name: 'Concurrent Semester 2',
            code: 'P11-CONCURRENT-SEM-2',
            courseRequirements: [
              {
                courseId: phase11Ids.courseA,
                requirementType: 'REQUIRED',
              },
            ],
          },
        },
      ],
    };
    const configurations = await Promise.all([
      request(app.getHttpServer())
        .put(`/org/programs/${phase11Ids.programA}/cycles`)
        .set(auth(tokens.adminA))
        .send(replacement),
      request(app.getHttpServer())
        .put(`/org/programs/${phase11Ids.programA}/cycles`)
        .set(auth(tokens.adminA))
        .send(replacement),
    ]);
    expect(configurations.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    await expect(
      prisma.programConfigurationRevision.count({
        where: {
          programId: phase11Ids.programA,
          version: currentProgram.configurationVersion + 1,
        },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .patch(`/org/academic-cycles/${phase11Ids.cycleNext}/status`)
      .set(auth(tokens.adminA))
      .send({ status: 'COMPLETED', reason: 'Concurrency cycle handoff' })
      .expect(200);
    const raceCycles = await Promise.all(
      [1, 2].map((number) =>
        request(app.getHttpServer())
          .post('/org/academic-cycles')
          .set(auth(tokens.adminA))
          .send({
            name: `Phase 11 Activation Race ${number}`,
            code: `P11-ACTIVATION-RACE-${number}`,
            startDate: `2029-0${number}-01`,
            endDate: `2029-0${number + 4}-01`,
          })
          .expect(201),
      ),
    );
    const activationRace = await Promise.all(
      raceCycles.map((cycle) =>
        request(app.getHttpServer())
          .patch(`/org/academic-cycles/${cycle.body.id}/status`)
          .set(auth(tokens.adminA))
          .send({ status: 'ACTIVE', reason: 'Concurrent activation' }),
      ),
    );
    expect(activationRace.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    await expect(
      prisma.academicCycle.count({
        where: {
          organizationId: phase11Ids.orgA,
          status: 'ACTIVE',
        },
      }),
    ).resolves.toBe(1);
    const losingCycle = raceCycles.find(
      (cycle) =>
        !activationRace.some(
          (response) =>
            response.status === 200 && response.body.id === cycle.body.id,
        ),
    );
    if (losingCycle) {
      await request(app.getHttpServer())
        .delete(`/org/academic-cycles/${losingCycle.body.id}`)
        .set(auth(tokens.adminA))
        .expect(200);
    }
  }, 120_000);

  it('keeps import templates protected and validates missing upload bodies as 4xx', async () => {
    await request(app.getHttpServer())
      .get('/org/imports/students/template')
      .expect(401);
    await request(app.getHttpServer())
      .get('/org/imports/students/template')
      .set(auth(tokens.teacherA))
      .expect(403);
    const template = await request(app.getHttpServer())
      .get('/org/imports/students/template')
      .set(auth(tokens.adminA))
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(template.text).toContain('programClassificationStatus');
    await request(app.getHttpServer())
      .post('/org/imports/students/validate')
      .set(auth(tokens.adminA))
      .expect(400);
    await request(app.getHttpServer())
      .post('/org/imports/students/confirm')
      .set(auth(tokens.adminA))
      .send({ importSessionId: 'tampered-phase11-session' })
      .expect(400);
  });

  it('enforces answerbook ownership, release visibility, reference updates, and file lifecycle', async () => {
    const updated = await request(app.getHttpServer())
      .patch(
        `/org/assessments/${phase11Ids.archiveAssessment}/grades/${phase11Ids.studentArchive}`,
      )
      .set(auth(tokens.teacherA))
      .send({
        marksObtained: 89,
        status: 'PUBLISHED',
        answerbookReferenceNumber: ' P11-ANSWER-UPDATED ',
      })
      .expect(200);
    expect(updated.body.answerbookReferenceNumber).toBe('P11-ANSWER-UPDATED');

    for (const token of [
      tokens.adminA,
      tokens.teacherA,
      tokens.studentArchive,
      tokens.guardianA,
    ]) {
      const listed = await request(app.getHttpServer())
        .get(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
        .set(auth(token))
        .expect(200);
      expect(listed.body).toHaveLength(1);
      expect(JSON.stringify(listed.body)).not.toContain('publicId');
    }

    await request(app.getHttpServer())
      .get(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
      .set(auth(tokens.teacherUnassignedA))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
      .set(auth(tokens.guardianUnrelatedA))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
      .set(auth(tokens.adminB))
      .expect(404);

    const uploaded = await request(app.getHttpServer())
      .post(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
      .set(auth(tokens.teacherA))
      .attach('file', Buffer.from('phase11 image bytes'), {
        filename: 'phase11-answerbook.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(uploaded.body.file.filename).toBe('phase11-answerbook.png');

    await request(app.getHttpServer())
      .get(
        `/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments/${uploaded.body.id}/download`,
      )
      .set(auth(tokens.studentArchive))
      .expect(200)
      .expect('Content-Type', /image\/png/);
    await request(app.getHttpServer())
      .delete(
        `/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments/${uploaded.body.id}`,
      )
      .set(auth(tokens.teacherA))
      .expect(200);
    await expect(
      prisma.gradeAnswerbookAttachment.count({
        where: { gradeId: phase11Ids.archiveGrade },
      }),
    ).resolves.toBe(1);
  });

  it('serializes answerbook uploads at the five-file boundary without orphans', async () => {
    const uploads = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        request(app.getHttpServer())
          .post(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
          .set(auth(tokens.teacherA))
          .attach('file', Buffer.from(`phase11 concurrent image ${index}`), {
            filename: `phase11-concurrent-${index}.png`,
            contentType: 'image/png',
          }),
      ),
    );
    expect(
      uploads.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    expect(uploads.some((response) => response.status === 201)).toBe(true);
    const createdAttachmentIds = uploads
      .filter((response) => response.status === 201)
      .map((response) => response.body.id as string);
    let attachmentCount = await prisma.gradeAnswerbookAttachment.count({
      where: { gradeId: phase11Ids.archiveGrade },
    });
    expect(attachmentCount).toBeLessThanOrEqual(5);

    while (attachmentCount < 5) {
      const fill = await request(app.getHttpServer())
        .post(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
        .set(auth(tokens.teacherA))
        .attach(
          'file',
          Buffer.from(`phase11 boundary fill ${attachmentCount}`),
          {
            filename: `phase11-boundary-fill-${attachmentCount}.png`,
            contentType: 'image/png',
          },
        )
        .expect(201);
      createdAttachmentIds.push(fill.body.id);
      attachmentCount += 1;
    }

    await request(app.getHttpServer())
      .post(`/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments`)
      .set(auth(tokens.teacherA))
      .attach('file', Buffer.from('phase11 overflow'), {
        filename: 'phase11-overflow.png',
        contentType: 'image/png',
      })
      .expect(409);
    await expect(
      prisma.file.count({
        where: {
          entityType: 'GRADE_ANSWERBOOK',
          entityId: phase11Ids.archiveGrade,
          gradeAnswerbookAttachment: null,
        },
      }),
    ).resolves.toBe(0);

    for (const attachmentId of createdAttachmentIds) {
      await request(app.getHttpServer())
        .delete(
          `/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments/${attachmentId}`,
        )
        .set(auth(tokens.teacherA))
        .expect(200);
    }
  });

  it('archives a completed cycle and serves immutable, scoped past records', async () => {
    await request(app.getHttpServer())
      .post(`/org/academic-cycles/${phase11Ids.cycleArchive}/archive`)
      .set(auth(tokens.subAdminA))
      .expect(403);

    const archiveStartedAt = performance.now();
    const archiveRace = await Promise.all([
      request(app.getHttpServer())
        .post(`/org/academic-cycles/${phase11Ids.cycleArchive}/archive`)
        .set(auth(tokens.adminA)),
      request(app.getHttpServer())
        .post(`/org/academic-cycles/${phase11Ids.cycleArchive}/archive`)
        .set(auth(tokens.adminA)),
    ]);
    expect(
      archiveRace.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    expect(archiveRace.some((response) => response.status === 201)).toBe(true);
    const archived = await request(app.getHttpServer())
      .get(`/org/academic-cycles/${phase11Ids.cycleArchive}/archive`)
      .set(auth(tokens.adminA))
      .expect(200);
    phase11Metrics.archiveMs = Number(
      (performance.now() - archiveStartedAt).toFixed(2),
    );
    expect(archived.body.cycle.status).toBe('ARCHIVED');
    expect(archived.body.archive.status).toBe('READY');
    await expect(
      prisma.academicCycleArchive.count({
        where: { academicCycleId: phase11Ids.cycleArchive },
      }),
    ).resolves.toBe(1);

    const verified = await request(app.getHttpServer())
      .get(`/org/academic-cycles/${phase11Ids.cycleArchive}/archive/verify`)
      .set(auth(tokens.managerA))
      .expect(200);
    expect(verified.body).toMatchObject({
      valid: true,
      sectionChecksumsMatch: true,
      archiveChecksumMatches: true,
      filesLocked: true,
    });

    const cycles = await request(app.getHttpServer())
      .get('/org/past-records/cycles?search=Spring%202026')
      .set(auth(tokens.adminA))
      .expect(200);
    expect(cycles.body.data.map((cycle: any) => cycle.id)).toContain(
      phase11Ids.cycleArchive,
    );

    const sections = await request(app.getHttpServer())
      .get(
        `/org/past-records/sections?cycleId=${phase11Ids.cycleArchive}&departmentId=${phase11Ids.departmentA}&classification=STANDALONE`,
      )
      .set(auth(tokens.adminA))
      .expect(200);
    expect(sections.body.data).toHaveLength(1);
    const archiveSectionId = sections.body.data[0].id;

    const studentHistory = await request(app.getHttpServer())
      .get(
        `/org/past-records/students/${phase11Ids.studentArchive}?cycleId=${phase11Ids.cycleArchive}`,
      )
      .set(auth(tokens.guardianA))
      .expect(200);
    expect(studentHistory.body.student.sourceStudentId).toBe(
      phase11Ids.studentArchive,
    );
    await request(app.getHttpServer())
      .get(
        `/org/past-records/students/${phase11Ids.studentArchive}?cycleId=${phase11Ids.cycleArchive}`,
      )
      .set(auth(tokens.guardianUnrelatedA))
      .expect(403);

    const detail = await request(app.getHttpServer())
      .get(`/org/past-records/sections/${archiveSectionId}`)
      .set(auth(tokens.studentArchive))
      .expect(200);
    expect(detail.body.payload.assessments[0].grades[0]).toMatchObject({
      id: phase11Ids.archiveGrade,
      answerbookReferenceNumber: 'P11-ANSWER-UPDATED',
    });

    await request(app.getHttpServer())
      .get(
        `/org/past-records/sections/${archiveSectionId}/grades/${phase11Ids.archiveGrade}/answerbook-attachments/${phase11Ids.archiveAttachment}/download`,
      )
      .set(auth(tokens.guardianA))
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
    await request(app.getHttpServer())
      .delete(
        `/org/grades/${phase11Ids.archiveGrade}/answerbook-attachments/${phase11Ids.archiveAttachment}`,
      )
      .set(auth(tokens.adminA))
      .expect(409);
  }, 120_000);

  it('profiles critical reads with 1,000 students and full academic rows', async () => {
    const scale = 1_000;
    const seedStartedAt = performance.now();
    const activeCycle = await prisma.academicCycle.findFirstOrThrow({
      where: { organizationId: phase11Ids.orgA, status: 'ACTIVE' },
    });
    const program = await prisma.program.findUniqueOrThrow({
      where: { id: phase11Ids.programA2 },
      include: {
        academicCycles: {
          where: { status: 'ACTIVE' },
          orderBy: { sequence: 'asc' },
          include: { academicCycle: true },
        },
        configurationRevisions: {
          where: { version: 1 },
          take: 1,
        },
        curriculumVersions: {
          where: { status: 'ACTIVE', isDefaultForAdmissions: true },
          include: { stages: true },
          take: 1,
        },
      },
    });
    const revision = program.configurationRevisions[0];
    const curriculum = program.curriculumVersions[0];
    const stageByAssociation = new Map(
      curriculum.stages.map((stage) => [stage.programAcademicCycleId, stage]),
    );
    const indexes = Array.from({ length: scale }, (_, index) => index);

    await prisma.user.createMany({
      data: indexes.map((index) => ({
        id: `phase11-load-user-${index}`,
        organizationId: phase11Ids.orgA,
        email: `phase11-load-${index}@example.test`,
        password: 'not-used',
        name: `Phase 11 Load Student ${index}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        isFirstLogin: false,
      })),
    });
    await prisma.student.createMany({
      data: indexes.map((index) => ({
        id: `phase11-load-student-${index}`,
        userId: `phase11-load-user-${index}`,
        organizationId: phase11Ids.orgA,
        registrationNumber: `P11-LOAD-REG-${index}`,
        rollNumber: `P11-LOAD-ROLL-${index}`,
        gender: 'Unassigned',
        primaryDepartmentId: phase11Ids.departmentA2,
        status: 'ACTIVE',
        updatedBy: 'Phase 11 performance fixture',
      })),
    });
    await prisma.studentProgramEnrollment.createMany({
      data: indexes.map((index) => ({
        id: `phase11-load-program-enrollment-${index}`,
        organizationId: phase11Ids.orgA,
        studentId: `phase11-load-student-${index}`,
        programId: program.id,
        curriculumVersionId: curriculum.id,
        programConfigurationRevisionId: revision.id,
        status: 'ACTIVE',
        openSlot: `student:phase11-load-student-${index}`,
        requiredCycleCountSnapshot: program.requiredCycleCount,
        programConfigurationVersionSnapshot: revision.version,
        programCyclePlanSnapshotHash: revision.checksum,
        entryProgramAcademicCycleId: program.academicCycles[0].id,
        entryAcademicCycleId: program.academicCycles[0].academicCycleId,
        entryStageSequence: 1,
        admittedById: phase11Ids.orgAdminA,
        startedAt: new Date('2026-09-01'),
      })),
    });
    await prisma.studentProgramEnrollmentCycle.createMany({
      data: indexes.flatMap((index) =>
        program.academicCycles.map((association) => {
          const stage = stageByAssociation.get(association.id)!;
          return {
            id: `phase11-load-plan-${index}-${association.sequence}`,
            organizationId: phase11Ids.orgA,
            studentProgramEnrollmentId: `phase11-load-program-enrollment-${index}`,
            programAcademicCycleId: association.id,
            academicCycleId: association.academicCycleId,
            programStageId: stage.id,
            sequenceSnapshot: association.sequence,
            isRequiredSnapshot: association.isRequired,
            cycleNameSnapshot: association.academicCycle.name,
            cycleCodeSnapshot: association.academicCycle.code,
            cycleStartDateSnapshot: association.academicCycle.startDate,
            cycleEndDateSnapshot: association.academicCycle.endDate,
            stageNameSnapshot: stage.name,
            stageCodeSnapshot: stage.code,
            status: 'COMPLETED' as const,
            startedAt: association.academicCycle.startDate,
            completedAt: association.academicCycle.endDate,
            resolvedById: phase11Ids.orgAdminA,
          };
        }),
      ),
    });

    const loadSectionId = 'phase11-load-section';
    const loadAssessmentId = 'phase11-load-assessment';
    await prisma.section.create({
      data: {
        id: loadSectionId,
        organizationId: phase11Ids.orgA,
        name: 'Phase 11 Load Section',
        code: 'P11-LOAD-SECTION',
        courseId: phase11Ids.courseA,
        academicCycleId: activeCycle.id,
        status: 'ACTIVE',
        programClassificationStatus: 'STANDALONE',
        teachers: { connect: { id: 'phase11-teacher-a' } },
      },
    });
    await prisma.enrollment.createMany({
      data: indexes.map((index) => ({
        id: `phase11-load-enrollment-${index}`,
        studentId: `phase11-load-student-${index}`,
        sectionId: loadSectionId,
        academicCycleId: activeCycle.id,
      })),
    });
    await prisma.assessment.create({
      data: {
        id: loadAssessmentId,
        organizationId: phase11Ids.orgA,
        sectionId: loadSectionId,
        courseId: phase11Ids.courseA,
        academicCycleId: activeCycle.id,
        title: 'Phase 11 Load Final',
        type: 'FINAL',
        totalMarks: 100,
        weightage: 100,
        status: 'ACTIVE',
      },
    });
    await prisma.grade.createMany({
      data: indexes.map((index) => ({
        id: `phase11-load-grade-${index}`,
        assessmentId: loadAssessmentId,
        studentId: `phase11-load-student-${index}`,
        academicCycleId: activeCycle.id,
        marksObtained: 60 + (index % 40),
        status: 'PUBLISHED',
        updatedBy: phase11Ids.teacherA,
      })),
    });
    await prisma.sectionSchedule.create({
      data: {
        id: 'phase11-load-schedule',
        sectionId: loadSectionId,
        academicCycleId: activeCycle.id,
        day: 2,
        startTime: '10:00',
        endTime: '11:00',
        teacherId: 'phase11-teacher-a',
      },
    });
    await prisma.attendanceSession.create({
      data: {
        id: 'phase11-load-attendance-session',
        sectionId: loadSectionId,
        scheduleId: 'phase11-load-schedule',
        academicCycleId: activeCycle.id,
        date: new Date('2029-03-06'),
      },
    });
    await prisma.attendanceRecord.createMany({
      data: indexes.map((index) => ({
        id: `phase11-load-attendance-${index}`,
        sessionId: 'phase11-load-attendance-session',
        studentId: `phase11-load-student-${index}`,
        status: index % 10 === 0 ? ('ABSENT' as const) : ('PRESENT' as const),
      })),
    });
    phase11Metrics.syntheticSeedMs = Number(
      (performance.now() - seedStartedAt).toFixed(2),
    );

    const measure = async (name: string, run: () => Promise<void>) => {
      const startedAt = performance.now();
      await run();
      phase11Metrics[name] = Number((performance.now() - startedAt).toFixed(2));
    };
    await measure('programListMs', async () => {
      await request(app.getHttpServer())
        .get('/org/programs?limit=20')
        .set(auth(tokens.adminA))
        .expect(200);
    });
    await measure('studentProgramFilterMs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/org/students?programId=${phase11Ids.programA2}&limit=50`)
        .set(auth(tokens.adminA))
        .expect(200);
      expect(response.body.totalRecords).toBeGreaterThanOrEqual(scale);
    });
    await measure('transcriptMs', async () => {
      await request(app.getHttpServer())
        .get('/org/transcripts/students/phase11-load-student-0')
        .set(auth(tokens.adminA))
        .expect(200);
    });
    await measure('cycleReportMs', async () => {
      await request(app.getHttpServer())
        .get(`/org/transcripts/cycles/${activeCycle.id}/report`)
        .set(auth(tokens.adminA))
        .expect(200);
    });
    await measure('pastRecordSearchMs', async () => {
      await request(app.getHttpServer())
        .get('/org/past-records/sections?search=Archived%20Programming')
        .set(auth(tokens.adminA))
        .expect(200);
    });
    await measure('publicOfferingsMs', async () => {
      await request(app.getHttpServer())
        .get('/public/organizations/phase11-institute-a/program-offerings')
        .expect(200);
    });

    phase11Metrics.scaleStudents = scale;
    phase11Metrics.scaleProgramCycles = scale * program.requiredCycleCount;
    phase11Metrics.scaleGrades = scale;
    phase11Metrics.scaleAttendanceRecords = scale;
    phase11Metrics.rssMb = Number(
      (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
    );
    const measuredLatencies = Object.entries(phase11Metrics)
      .filter(([name]) => name.endsWith('Ms') && name !== 'syntheticSeedMs')
      .map(([, value]) => value);
    expect(Math.max(...measuredLatencies)).toBeLessThan(5_000);
    expect(phase11Metrics.syntheticSeedMs).toBeLessThan(30_000);
    console.log(`PHASE11_PERFORMANCE ${JSON.stringify(phase11Metrics)}`);
  }, 120_000);
});
