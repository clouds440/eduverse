#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}

const parsedUrl = new URL(connectionString);
const database = {
  host: parsedUrl.hostname,
  port: parsedUrl.port || '5432',
  database: parsedUrl.pathname.replace(/^\//, ''),
};

const countQueries = [
  ['organizations', 'SELECT COUNT(*)::int AS count FROM "Organization"'],
  ['programs', 'SELECT COUNT(*)::int AS count FROM "Program"'],
  ['programAcademicCycles', 'SELECT COUNT(*)::int AS count FROM "ProgramAcademicCycle"'],
  ['programConfigurationRevisions', 'SELECT COUNT(*)::int AS count FROM "ProgramConfigurationRevision"'],
  ['curriculumVersions', 'SELECT COUNT(*)::int AS count FROM "CurriculumVersion"'],
  ['programStages', 'SELECT COUNT(*)::int AS count FROM "ProgramStage"'],
  ['stageCourseRequirements', 'SELECT COUNT(*)::int AS count FROM "StageCourseRequirement"'],
  ['studentProgramEnrollments', 'SELECT COUNT(*)::int AS count FROM "StudentProgramEnrollment"'],
  ['studentProgramEnrollmentCycles', 'SELECT COUNT(*)::int AS count FROM "StudentProgramEnrollmentCycle"'],
  ['studentStageAttempts', 'SELECT COUNT(*)::int AS count FROM "StudentStageAttempt"'],
  ['academicCycles', 'SELECT COUNT(*)::int AS count FROM "AcademicCycle"'],
  ['cohorts', 'SELECT COUNT(*)::int AS count FROM "Cohort"'],
  ['sections', 'SELECT COUNT(*)::int AS count FROM "Section"'],
  ['enrollments', 'SELECT COUNT(*)::int AS count FROM "Enrollment"'],
  ['enrollmentHistories', 'SELECT COUNT(*)::int AS count FROM "EnrollmentHistory"'],
  ['cohortMembershipHistories', 'SELECT COUNT(*)::int AS count FROM "CohortMembershipHistory"'],
  ['assessments', 'SELECT COUNT(*)::int AS count FROM "Assessment"'],
  ['grades', 'SELECT COUNT(*)::int AS count FROM "Grade"'],
  ['submissions', 'SELECT COUNT(*)::int AS count FROM "Submission"'],
  ['sectionSchedules', 'SELECT COUNT(*)::int AS count FROM "SectionSchedule"'],
  ['attendanceSessions', 'SELECT COUNT(*)::int AS count FROM "AttendanceSession"'],
  ['attendanceRecords', 'SELECT COUNT(*)::int AS count FROM "AttendanceRecord"'],
  ['courseMaterials', 'SELECT COUNT(*)::int AS count FROM "CourseMaterial"'],
  ['evaluationWindows', 'SELECT COUNT(*)::int AS count FROM "EvaluationWindow"'],
  ['evaluations', 'SELECT COUNT(*)::int AS count FROM "Evaluation"'],
  ['preferenceWindows', 'SELECT COUNT(*)::int AS count FROM "PreferenceWindow"'],
  ['preferenceSubmissions', 'SELECT COUNT(*)::int AS count FROM "PreferenceSubmission"'],
  ['files', 'SELECT COUNT(*)::int AS count FROM "File"'],
  ['answerbookAttachments', 'SELECT COUNT(*)::int AS count FROM "GradeAnswerbookAttachment"'],
  ['detachedAnswerbookFiles', `SELECT COUNT(*)::int AS count FROM "File" f WHERE f."entityType" = 'GRADE_ANSWERBOOK' AND NOT EXISTS (SELECT 1 FROM "GradeAnswerbookAttachment" gaa WHERE gaa."fileId" = f.id)`],
  ['academicCycleArchives', 'SELECT COUNT(*)::int AS count FROM "AcademicCycleArchive"'],
  ['academicCycleArchiveSections', 'SELECT COUNT(*)::int AS count FROM "AcademicCycleArchiveSection"'],
  ['academicCycleArchiveProgramIndexes', 'SELECT COUNT(*)::int AS count FROM "AcademicCycleArchiveSectionProgramIndex"'],
  ['academicCycleArchiveStudentIndexes', 'SELECT COUNT(*)::int AS count FROM "AcademicCycleArchiveStudentIndex"'],
  ['archiveLockedFiles', 'SELECT COUNT(*)::int AS count FROM "File" WHERE "lockedByArchiveId" IS NOT NULL'],
];

const checks = [
  {
    id: 'organization_missing_public_slug',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "Organization" WHERE slug IS NULL OR BTRIM(slug) = \'\'',
  },
  {
    id: 'multiple_active_cycles_per_organization',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT "organizationId"
        FROM "AcademicCycle"
        WHERE status::text = 'ACTIVE'
        GROUP BY "organizationId"
        HAVING COUNT(*) > 1
      ) conflicts
    `,
  },
  {
    id: 'invalid_cycle_date_ranges',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "AcademicCycle" WHERE "startDate" >= "endDate"',
  },
  {
    id: 'cohort_cycle_organization_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Cohort" c
      JOIN "AcademicCycle" ac ON ac.id = c."academicCycleId"
      WHERE c."organizationId" <> ac."organizationId"
    `,
  },
  {
    id: 'program_department_organization_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Program" p
      JOIN "Department" d ON d.id = p."departmentId"
      WHERE p."organizationId" <> d."organizationId"
    `,
  },
  {
    id: 'program_cycle_organization_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "ProgramAcademicCycle" pac
      JOIN "Program" p ON p.id = pac."programId"
      JOIN "AcademicCycle" ac ON ac.id = pac."academicCycleId"
      WHERE pac."organizationId" <> p."organizationId"
         OR pac."organizationId" <> ac."organizationId"
    `,
  },
  {
    id: 'program_required_cycle_count_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Program" p
      WHERE p."requiredCycleCount" <> (
        SELECT COUNT(*)::int
        FROM "ProgramAcademicCycle" pac
        WHERE pac."programId" = p.id AND pac.status::text = 'ACTIVE' AND pac."isRequired" = true
      )
    `,
  },
  {
    id: 'program_current_revision_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Program" p
      LEFT JOIN "ProgramConfigurationRevision" pcr
        ON pcr."programId" = p.id AND pcr.version = p."configurationVersion"
      WHERE pcr.id IS NULL
         OR pcr."organizationId" <> p."organizationId"
         OR pcr."requiredCycleCount" <> p."requiredCycleCount"
    `,
  },
  {
    id: 'admission_visible_program_incomplete',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Program" p
      JOIN "Department" d ON d.id = p."departmentId"
      LEFT JOIN "ProgramConfigurationRevision" revision
        ON revision."programId" = p.id AND revision.version = p."configurationVersion"
      LEFT JOIN "CurriculumVersion" curriculum
        ON curriculum."programId" = p.id
       AND curriculum."programConfigurationRevisionId" = revision.id
       AND curriculum.status::text = 'ACTIVE'
       AND curriculum."isDefaultForAdmissions" = true
      WHERE p.status::text = 'ACTIVE'
        AND p."isVisibleForAdmissions" = true
        AND (
          d."isActive" = false
          OR revision.id IS NULL
          OR revision."requiredCycleCount" <> p."requiredCycleCount"
          OR curriculum.id IS NULL
          OR p."requiredCycleCount" < 1
          OR (SELECT COUNT(*) FROM "ProgramAcademicCycle" pac WHERE pac."programId" = p.id AND pac.status::text = 'ACTIVE' AND pac."isRequired" = true) <> p."requiredCycleCount"
          OR (SELECT COUNT(*) FROM "ProgramStage" stage WHERE stage."curriculumVersionId" = curriculum.id) <> p."requiredCycleCount"
          OR EXISTS (
            SELECT 1 FROM "ProgramStage" stage
            WHERE stage."curriculumVersionId" = curriculum.id
              AND stage."isOptional" = false
              AND NOT EXISTS (SELECT 1 FROM "StageCourseRequirement" requirement WHERE requirement."programStageId" = stage.id)
          )
        )
    `,
  },
  {
    id: 'program_stage_relationship_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "ProgramStage" ps
      JOIN "CurriculumVersion" cv ON cv.id = ps."curriculumVersionId"
      JOIN "ProgramAcademicCycle" pac ON pac.id = ps."programAcademicCycleId"
      WHERE ps."organizationId" <> cv."organizationId"
         OR ps."organizationId" <> pac."organizationId"
         OR cv."programId" <> pac."programId"
    `,
  },
  {
    id: 'program_course_department_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "StageCourseRequirement" scr
      JOIN "ProgramStage" ps ON ps.id = scr."programStageId"
      JOIN "CurriculumVersion" cv ON cv.id = ps."curriculumVersionId"
      JOIN "Program" p ON p.id = cv."programId"
      JOIN "Course" c ON c.id = scr."courseId"
      WHERE scr."organizationId" <> p."organizationId"
         OR c."organizationId" <> p."organizationId"
         OR c."departmentId" IS DISTINCT FROM p."departmentId"
    `,
  },
  {
    id: 'cohort_classification_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Cohort"
      WHERE ("programClassificationStatus"::text = 'STANDALONE'
          AND ("programAcademicCycleId" IS NOT NULL OR "programStageId" IS NOT NULL))
         OR ("programClassificationStatus"::text = 'PROGRAM_MAPPED'
          AND ("programAcademicCycleId" IS NULL OR "programStageId" IS NULL))
    `,
  },
  {
    id: 'section_cycle_or_cohort_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Section" s
      JOIN "AcademicCycle" ac ON ac.id = s."academicCycleId"
      LEFT JOIN "Cohort" c ON c.id = s."cohortId"
      WHERE s."organizationId" <> ac."organizationId"
         OR (c.id IS NOT NULL AND (
           c."organizationId" <> s."organizationId"
           OR c."academicCycleId" <> s."academicCycleId"
         ))
    `,
  },
  {
    id: 'enrollment_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "Enrollment" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'section_classification_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Section" s
      LEFT JOIN "Cohort" c ON c.id = s."cohortId"
      WHERE c.id IS NOT NULL
        AND s."programClassificationStatus"::text <> c."programClassificationStatus"::text
    `,
  },
  {
    id: 'enrollment_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Enrollment" e
      JOIN "Section" s ON s.id = e."sectionId"
      WHERE e."academicCycleId" IS NOT NULL
        AND e."academicCycleId" <> s."academicCycleId"
    `,
  },
  {
    id: 'assessment_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "Assessment" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'assessment_cycle_or_course_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Assessment" a
      JOIN "Section" s ON s.id = a."sectionId"
      WHERE (a."academicCycleId" IS NOT NULL AND a."academicCycleId" <> s."academicCycleId")
         OR a."courseId" <> s."courseId"
         OR a."organizationId" <> s."organizationId"
    `,
  },
  {
    id: 'grade_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "Grade" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'grade_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Grade" g
      JOIN "Assessment" a ON a.id = g."assessmentId"
      JOIN "Section" s ON s.id = a."sectionId"
      WHERE g."academicCycleId" IS NOT NULL
        AND g."academicCycleId" <> s."academicCycleId"
    `,
  },
  {
    id: 'submission_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "Submission" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'submission_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Submission" sub
      JOIN "Assessment" a ON a.id = sub."assessmentId"
      JOIN "Section" s ON s.id = a."sectionId"
      WHERE sub."academicCycleId" IS NOT NULL
        AND sub."academicCycleId" <> s."academicCycleId"
    `,
  },
  {
    id: 'schedule_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "SectionSchedule" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'schedule_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "SectionSchedule" ss
      JOIN "Section" s ON s.id = ss."sectionId"
      WHERE ss."academicCycleId" IS NOT NULL
        AND ss."academicCycleId" <> s."academicCycleId"
    `,
  },
  {
    id: 'attendance_session_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "AttendanceSession" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'attendance_session_cycle_or_schedule_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AttendanceSession" ats
      JOIN "Section" s ON s.id = ats."sectionId"
      JOIN "SectionSchedule" ss ON ss.id = ats."scheduleId"
      WHERE ss."sectionId" <> ats."sectionId"
         OR (ats."academicCycleId" IS NOT NULL AND ats."academicCycleId" <> s."academicCycleId")
         OR (ss."academicCycleId" IS NOT NULL AND ss."academicCycleId" <> s."academicCycleId")
    `,
  },
  {
    id: 'course_material_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "CourseMaterial" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'course_material_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "CourseMaterial" cm
      JOIN "Section" s ON s.id = cm."sectionId"
      WHERE cm."academicCycleId" IS NOT NULL
        AND cm."academicCycleId" <> s."academicCycleId"
    `,
  },
  {
    id: 'enrollment_history_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "EnrollmentHistory" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'enrollment_history_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "EnrollmentHistory" eh
      JOIN "Section" s ON s.id = eh."sectionId"
      WHERE eh."academicCycleId" IS NOT NULL
        AND eh."academicCycleId" <> s."academicCycleId"
    `,
  },
  {
    id: 'cohort_history_missing_cycle',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "CohortMembershipHistory" WHERE "academicCycleId" IS NULL',
  },
  {
    id: 'cohort_history_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "CohortMembershipHistory" ch
      JOIN "Cohort" c ON c.id = ch."cohortId"
      WHERE ch."academicCycleId" IS NOT NULL
        AND ch."academicCycleId" <> c."academicCycleId"
    `,
  },
  {
    id: 'evaluation_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "Evaluation" e
      JOIN "Section" s ON s.id = e."sectionId"
      WHERE e."academicCycleId" <> s."academicCycleId"
         OR e."courseId" <> s."courseId"
         OR e."organizationId" <> s."organizationId"
    `,
  },
  {
    id: 'evaluation_window_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "EvaluationWindow" ew
      JOIN "Section" s ON s.id = ew."sectionId"
      WHERE ew."sectionId" IS NOT NULL
        AND (ew."academicCycleId" <> s."academicCycleId"
          OR ew."organizationId" <> s."organizationId")
    `,
  },
  {
    id: 'files_missing_sha256',
    severity: 'BLOCKER',
    sql: 'SELECT COUNT(*)::int AS count FROM "File" WHERE "sha256" IS NULL OR "sha256" = \'\'',
  },
  {
    id: 'answerbook_attachment_relationship_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "GradeAnswerbookAttachment" gaa
      JOIN "Grade" g ON g.id = gaa."gradeId"
      JOIN "Assessment" a ON a.id = g."assessmentId"
      JOIN "File" f ON f.id = gaa."fileId"
      WHERE gaa."organizationId" <> a."organizationId"
        OR f."orgId" <> gaa."organizationId"
        OR f."entityType" <> 'GRADE_ANSWERBOOK'
        OR f."entityId" <> gaa."gradeId"
    `,
  },
  {
    id: 'answerbook_attachment_limit_exceeded',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT "gradeId"
        FROM "GradeAnswerbookAttachment"
        GROUP BY "gradeId"
        HAVING COUNT(*) > 5
      ) conflicts
    `,
  },
  {
    id: 'detached_answerbook_files',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "File" f
      WHERE f."entityType" = 'GRADE_ANSWERBOOK'
        AND NOT EXISTS (
          SELECT 1 FROM "GradeAnswerbookAttachment" gaa WHERE gaa."fileId" = f.id
        )
    `,
  },
  {
    id: 'answerbook_file_policy_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "GradeAnswerbookAttachment" gaa
      JOIN "File" f ON f.id = gaa."fileId"
      WHERE LOWER(COALESCE(f.extension, '')) NOT IN ('.pdf', '.jpg', '.jpeg', '.png', '.webp')
        OR (LOWER(COALESCE(f.extension, '')) = '.pdf' AND f.size > 52428800)
        OR (LOWER(COALESCE(f.extension, '')) IN ('.jpg', '.jpeg', '.png', '.webp') AND f.size > 5242880)
    `,
  },
  {
    id: 'archived_cycles_missing_ready_current_archive',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycle" ac
      LEFT JOIN "AcademicCycleArchive" aca ON aca.id = ac."currentArchiveId"
      WHERE ac.status::text = 'ARCHIVED'
        AND (aca.id IS NULL
          OR aca.status::text <> 'READY'
          OR aca."academicCycleId" <> ac.id
          OR aca."organizationId" <> ac."organizationId")
    `,
  },
  {
    id: 'non_archived_cycles_with_current_archive',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycle"
      WHERE status::text <> 'ARCHIVED' AND "currentArchiveId" IS NOT NULL
    `,
  },
  {
    id: 'archiving_cycles_without_resumable_revision',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycle" ac
      WHERE ac.status::text = 'ARCHIVING'
        AND NOT EXISTS (
          SELECT 1 FROM "AcademicCycleArchive" aca
          WHERE aca."academicCycleId" = ac.id AND aca.status::text IN ('BUILDING', 'FAILED')
        )
    `,
  },
  {
    id: 'ready_archives_missing_manifest_or_checksum',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycleArchive"
      WHERE status::text = 'READY'
        AND (manifest IS NULL OR "recordCounts" IS NULL OR checksum IS NULL OR "completedAt" IS NULL)
    `,
  },
  {
    id: 'archive_section_count_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycleArchive" aca
      WHERE aca.status::text = 'READY'
        AND COALESCE((aca."recordCounts"->>'sections')::int, -1) <>
          (SELECT COUNT(*)::int FROM "AcademicCycleArchiveSection" acas WHERE acas."archiveId" = aca.id)
    `,
  },
  {
    id: 'archive_section_tenant_or_cycle_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycleArchiveSection" acas
      JOIN "AcademicCycleArchive" aca ON aca.id = acas."archiveId"
      JOIN "Section" s ON s.id = acas."sourceSectionId"
      WHERE acas."organizationId" <> aca."organizationId"
        OR s."organizationId" <> aca."organizationId"
        OR s."academicCycleId" <> aca."academicCycleId"
    `,
  },
  {
    id: 'archive_program_index_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycleArchiveSectionProgramIndex" idx
      JOIN "AcademicCycleArchive" aca ON aca.id = idx."archiveId"
      JOIN "AcademicCycleArchiveSection" sec ON sec.id = idx."archiveSectionId"
      WHERE idx."organizationId" <> aca."organizationId"
        OR sec."organizationId" <> aca."organizationId"
        OR sec."archiveId" <> aca.id
    `,
  },
  {
    id: 'archive_student_index_mismatches',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "AcademicCycleArchiveStudentIndex" idx
      JOIN "AcademicCycleArchive" aca ON aca.id = idx."archiveId"
      JOIN "AcademicCycleArchiveSection" sec ON sec.id = idx."archiveSectionId"
      JOIN "Student" s ON s.id = idx."sourceStudentId"
      WHERE idx."organizationId" <> aca."organizationId"
        OR sec."organizationId" <> aca."organizationId"
        OR sec."archiveId" <> aca.id
        OR s."organizationId" <> aca."organizationId"
    `,
  },
  {
    id: 'files_locked_to_non_ready_archives',
    severity: 'BLOCKER',
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "File" f
      JOIN "AcademicCycleArchive" aca ON aca.id = f."lockedByArchiveId"
      WHERE aca.status::text <> 'READY' OR f."orgId" <> aca."organizationId"
    `,
  },
];

const readinessQueries = {
  lifecycleCycleClassification: `
    SELECT
      COUNT(*) FILTER (WHERE status::text = 'ACTIVE')::int AS active,
      COUNT(*) FILTER (WHERE status::text = 'DRAFT')::int AS draft,
      COUNT(*) FILTER (WHERE status::text = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status::text = 'ARCHIVING')::int AS archiving,
      COUNT(*) FILTER (WHERE status::text = 'ARCHIVED')::int AS archived,
      0::int AS manual_review_required
    FROM "AcademicCycle"
  `,
  destructiveHistory: `
    SELECT
      COUNT(*) FILTER (WHERE
        EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."sectionId" = s.id)
        OR EXISTS (SELECT 1 FROM "EnrollmentHistory" eh WHERE eh."sectionId" = s.id)
        OR EXISTS (SELECT 1 FROM "Assessment" a WHERE a."sectionId" = s.id)
        OR EXISTS (SELECT 1 FROM "AttendanceSession" ats WHERE ats."sectionId" = s.id)
        OR EXISTS (SELECT 1 FROM "CourseMaterial" cm WHERE cm."sectionId" = s.id)
        OR EXISTS (SELECT 1 FROM "Evaluation" ev WHERE ev."sectionId" = s.id)
      )::int AS sections_with_delivery_history,
      (SELECT COUNT(*)::int FROM "Assessment" a WHERE
        EXISTS (SELECT 1 FROM "Grade" g WHERE g."assessmentId" = a.id)
        OR EXISTS (SELECT 1 FROM "Submission" sub WHERE sub."assessmentId" = a.id)
      ) AS assessments_with_delivery_history
    FROM "Section" s
  `,
};

async function queryCount(client, sql) {
  const result = await client.query(sql);
  return result.rows[0]?.count ?? 0;
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query("SET LOCAL statement_timeout = '30s'");

    const counts = {};
    for (const [name, sql] of countQueries) {
      counts[name] = await queryCount(client, sql);
    }

    const checkResults = [];
    for (const check of checks) {
      checkResults.push({
        id: check.id,
        severity: check.severity,
        count: await queryCount(client, check.sql),
      });
    }

    const cycleClassification = (
      await client.query(
        readinessQueries.lifecycleCycleClassification,
      )
    ).rows[0];
    const destructiveHistory = (
      await client.query(readinessQueries.destructiveHistory)
    ).rows[0];
    const migrationsPath = path.join(__dirname, '..', 'prisma', 'migrations');
    const repositoryMigrations = fs
      .readdirSync(migrationsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const migrationRows = (
      await client.query(`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY migration_name
      `)
    ).rows;
    const appliedMigrations = new Set(
      migrationRows
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => row.migration_name),
    );
    const pendingMigrations = repositoryMigrations.filter(
      (migration) => !appliedMigrations.has(migration),
    );
    const failedMigrations = migrationRows
      .filter((row) => !row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name);
    const databaseOnlyMigrations = [...appliedMigrations].filter(
      (migration) => !repositoryMigrations.includes(migration),
    );

    await client.query('COMMIT');

    const blockers = checkResults.filter(
      (check) => check.severity === 'BLOCKER' && check.count > 0,
    );
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
      database,
      summary: {
        blockerChecksFailed: blockers.length,
        pendingMigrations: pendingMigrations.length,
        failedMigrations: failedMigrations.length,
        databaseOnlyMigrations: databaseOnlyMigrations.length,
        readyForPhase10:
          blockers.length === 0 &&
          pendingMigrations.length === 0 &&
          failedMigrations.length === 0 &&
          databaseOnlyMigrations.length === 0,
        readyForRelease:
          blockers.length === 0 &&
          pendingMigrations.length === 0 &&
          failedMigrations.length === 0 &&
          databaseOnlyMigrations.length === 0,
      },
      counts,
      cycleClassification,
      cycleLifecycleSource: 'status',
      destructiveHistory,
      migrations: {
        repositoryCount: repositoryMigrations.length,
        appliedCount: appliedMigrations.size,
        pending: pendingMigrations,
        failed: failedMigrations,
        databaseOnly: databaseOnlyMigrations,
      },
      checks: checkResults,
    };

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.summary.readyForPhase10 ? 0 : 1;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Programs preflight failed: ${error.message}`);
  process.exit(2);
});
