#!/usr/bin/env node

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

const tables = [
  'Organization',
  'Department',
  'Program',
  'ProgramConfigurationRevision',
  'CurriculumVersion',
  'ProgramStage',
  'StageCourseRequirement',
  'AcademicCycle',
  'ProgramOffering',
  'ProgramStageOffering',
  'Cohort',
  'CohortOffering',
  'CohortOfferingSection',
  'Section',
  'SectionProgramMapping',
  'StudentProgramEnrollment',
  'StudentStageEnrollment',
  'StudentCohortMembership',
  'StudentProgressionDecision',
  'ProgressionBulkOperation',
  'Enrollment',
  'EnrollmentHistory',
  'Assessment',
  'Grade',
  'GradeAnswerbookAttachment',
  'AcademicCycleArchive',
  'AcademicCycleArchiveSection',
  'AcademicCycleArchiveSectionProgramIndex',
  'AcademicCycleArchiveStudentIndex',
];

const checks = [
  ['organization_missing_public_slug', `SELECT COUNT(*)::int AS count FROM "Organization" WHERE slug IS NULL OR BTRIM(slug) = ''`],
  ['invalid_cycle_date_ranges', `SELECT COUNT(*)::int AS count FROM "AcademicCycle" WHERE "startDate" >= "endDate"`],
  ['program_department_tenant_mismatch', `
    SELECT COUNT(*)::int AS count FROM "Program" p
    JOIN "Department" d ON d.id = p."departmentId"
    WHERE p."organizationId" <> d."organizationId"`],
  ['invalid_program_progression_thresholds', `
    SELECT COUNT(*)::int AS count FROM "Program"
    WHERE "minimumPassingPercentage" < 0 OR "minimumPassingPercentage" > 100
       OR "minimumAttendancePercentage" < 0 OR "minimumAttendancePercentage" > 100`],
  ['program_current_revision_missing', `
    SELECT COUNT(*)::int AS count FROM "Program" p
    LEFT JOIN "ProgramConfigurationRevision" r
      ON r."programId" = p.id AND r.version = p."configurationVersion"
    WHERE r.id IS NULL OR r."organizationId" <> p."organizationId"`],
  ['curriculum_revision_mismatch', `
    SELECT COUNT(*)::int AS count FROM "CurriculumVersion" cv
    JOIN "Program" p ON p.id = cv."programId"
    JOIN "ProgramConfigurationRevision" r ON r.id = cv."programConfigurationRevisionId"
    WHERE cv."organizationId" <> p."organizationId"
       OR r."organizationId" <> p."organizationId"
       OR r."programId" <> p.id`],
  ['stage_curriculum_tenant_mismatch', `
    SELECT COUNT(*)::int AS count FROM "ProgramStage" s
    JOIN "CurriculumVersion" cv ON cv.id = s."curriculumVersionId"
    WHERE s."organizationId" <> cv."organizationId"`],
  ['requirement_course_or_stage_tenant_mismatch', `
    SELECT COUNT(*)::int AS count FROM "StageCourseRequirement" r
    JOIN "ProgramStage" s ON s.id = r."programStageId"
    JOIN "Course" c ON c.id = r."courseId"
    WHERE r."organizationId" <> s."organizationId"
       OR r."organizationId" <> c."organizationId"`],
  ['visible_admissions_program_not_ready', `
    SELECT COUNT(*)::int AS count FROM "Program" p
    JOIN "Department" d ON d.id = p."departmentId"
    LEFT JOIN "ProgramConfigurationRevision" r
      ON r."programId" = p.id AND r.version = p."configurationVersion"
    LEFT JOIN "CurriculumVersion" cv
      ON cv."programId" = p.id
     AND cv."programConfigurationRevisionId" = r.id
     AND cv.status::text = 'ACTIVE'
     AND cv."isDefaultForAdmissions" = true
    WHERE p.status::text = 'ACTIVE' AND p."isVisibleForAdmissions" = true
      AND (d."isActive" = false OR r.id IS NULL OR cv.id IS NULL
        OR NOT EXISTS (SELECT 1 FROM "ProgramStage" s WHERE s."curriculumVersionId" = cv.id)
        OR EXISTS (
          SELECT 1 FROM "ProgramStage" s
          WHERE s."curriculumVersionId" = cv.id AND s."isOptional" = false
            AND NOT EXISTS (SELECT 1 FROM "StageCourseRequirement" req WHERE req."programStageId" = s.id)
        ))`],
  ['program_offering_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "ProgramOffering" po
    JOIN "Program" p ON p.id = po."programId"
    JOIN "CurriculumVersion" cv ON cv.id = po."curriculumVersionId"
    JOIN "AcademicCycle" ac ON ac.id = po."academicCycleId"
    WHERE po."organizationId" <> p."organizationId"
       OR po."organizationId" <> cv."organizationId"
       OR po."organizationId" <> ac."organizationId"
       OR cv."programId" <> p.id`],
  ['stage_offering_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "ProgramStageOffering" pso
    JOIN "ProgramOffering" po ON po.id = pso."programOfferingId"
    JOIN "ProgramStage" ps ON ps.id = pso."programStageId"
    WHERE pso."organizationId" <> po."organizationId"
       OR pso."organizationId" <> ps."organizationId"
       OR ps."curriculumVersionId" <> po."curriculumVersionId"`],
  ['section_program_mapping_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "SectionProgramMapping" spm
    JOIN "Section" s ON s.id = spm."sectionId"
    JOIN "ProgramStageOffering" pso ON pso.id = spm."programStageOfferingId"
    JOIN "ProgramOffering" po ON po.id = pso."programOfferingId"
    JOIN "StageCourseRequirement" req ON req.id = spm."stageCourseRequirementId"
    WHERE spm."organizationId" <> s."organizationId"
       OR spm."organizationId" <> pso."organizationId"
       OR s."academicCycleId" <> po."academicCycleId"
       OR req."programStageId" <> pso."programStageId"
       OR req."courseId" <> s."courseId"`],
  ['cohort_offering_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "CohortOffering" co
    JOIN "Cohort" c ON c.id = co."cohortId"
    JOIN "AcademicCycle" ac ON ac.id = co."academicCycleId"
    LEFT JOIN "ProgramStageOffering" pso ON pso.id = co."programStageOfferingId"
    LEFT JOIN "ProgramOffering" po ON po.id = pso."programOfferingId"
    WHERE co."organizationId" <> c."organizationId"
       OR co."organizationId" <> ac."organizationId"
       OR (pso.id IS NOT NULL AND (pso."organizationId" <> co."organizationId" OR po."academicCycleId" <> co."academicCycleId"))`],
  ['cohort_section_cycle_mismatch', `
    SELECT COUNT(*)::int AS count FROM "CohortOfferingSection" cos
    JOIN "CohortOffering" co ON co.id = cos."cohortOfferingId"
    JOIN "Section" s ON s.id = cos."sectionId"
    WHERE cos."organizationId" <> co."organizationId"
       OR cos."organizationId" <> s."organizationId"
       OR co."academicCycleId" <> s."academicCycleId"`],
  ['student_program_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "StudentProgramEnrollment" spe
    JOIN "Student" st ON st.id = spe."studentId"
    JOIN "Program" p ON p.id = spe."programId"
    JOIN "CurriculumVersion" cv ON cv.id = spe."curriculumVersionId"
    JOIN "ProgramConfigurationRevision" r ON r.id = spe."programConfigurationRevisionId"
    WHERE spe."organizationId" <> st."organizationId"
       OR spe."organizationId" <> p."organizationId"
       OR cv."programId" <> p.id OR r."programId" <> p.id`],
  ['invalid_student_program_policy_snapshot', `
    SELECT COUNT(*)::int AS count FROM "StudentProgramEnrollment"
    WHERE "requiredStageCountSnapshot" < 0
       OR "minimumPassingPercentageSnapshot" < 0
       OR "minimumPassingPercentageSnapshot" > 100
       OR "minimumAttendancePercentageSnapshot" < 0
       OR "minimumAttendancePercentageSnapshot" > 100`],
  ['student_stage_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "StudentStageEnrollment" sse
    JOIN "StudentProgramEnrollment" spe ON spe.id = sse."studentProgramEnrollmentId"
    JOIN "ProgramStage" ps ON ps.id = sse."programStageId"
    JOIN "ProgramStageOffering" pso ON pso.id = sse."programStageOfferingId"
    WHERE sse."organizationId" <> spe."organizationId"
       OR ps."curriculumVersionId" <> spe."curriculumVersionId"
       OR pso."programStageId" <> ps.id`],
  ['cohort_membership_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "StudentCohortMembership" scm
    JOIN "Student" st ON st.id = scm."studentId"
    JOIN "CohortOffering" co ON co.id = scm."cohortOfferingId"
    LEFT JOIN "StudentStageEnrollment" sse ON sse.id = scm."studentStageEnrollmentId"
    WHERE scm."organizationId" <> st."organizationId"
       OR scm."organizationId" <> co."organizationId"
       OR (sse.id IS NOT NULL AND sse."programStageOfferingId" IS DISTINCT FROM co."programStageOfferingId")`],
  ['progression_decision_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "StudentProgressionDecision" d
    JOIN "StudentProgramEnrollment" spe ON spe.id = d."studentProgramEnrollmentId"
    LEFT JOIN "StudentStageEnrollment" source ON source.id = d."sourceStageEnrollmentId"
    LEFT JOIN "ProgramStage" target ON target.id = d."targetStageId"
    LEFT JOIN "ProgramStageOffering" offering ON offering.id = d."targetStageOfferingId"
    WHERE d."organizationId" <> spe."organizationId"
       OR (source.id IS NOT NULL AND source."studentProgramEnrollmentId" <> spe.id)
       OR (target.id IS NOT NULL AND target."curriculumVersionId" <> spe."curriculumVersionId")
       OR (offering.id IS NOT NULL AND offering."programStageId" IS DISTINCT FROM d."targetStageId")`],
  ['invalid_progression_bulk_operation_state', `
    SELECT COUNT(*)::int AS count FROM "ProgressionBulkOperation"
    WHERE (status::text = 'RUNNING' AND "completedAt" IS NOT NULL)
       OR (status::text = 'COMPLETED' AND (result IS NULL OR "completedAt" IS NULL))
       OR (status::text = 'FAILED' AND ("failureReason" IS NULL OR "completedAt" IS NULL))`],
  ['enrollment_cycle_mismatch', `
    SELECT COUNT(*)::int AS count FROM "Enrollment" e
    JOIN "Section" s ON s.id = e."sectionId"
    WHERE e."academicCycleId" <> s."academicCycleId"`],
  ['answerbook_attachment_context_mismatch', `
    SELECT COUNT(*)::int AS count FROM "GradeAnswerbookAttachment" a
    JOIN "Grade" g ON g.id = a."gradeId"
    JOIN "Assessment" assessment ON assessment.id = g."assessmentId"
    JOIN "File" f ON f.id = a."fileId"
    WHERE a."organizationId" <> assessment."organizationId"
       OR f."orgId" <> a."organizationId"
       OR f."entityType" <> 'GRADE_ANSWERBOOK'
       OR f."entityId" <> a."gradeId"`],
  ['archived_cycle_missing_ready_archive', `
    SELECT COUNT(*)::int AS count FROM "AcademicCycle" ac
    LEFT JOIN "AcademicCycleArchive" archive ON archive.id = ac."currentArchiveId"
    WHERE ac.status::text = 'ARCHIVED'
      AND (archive.id IS NULL OR archive.status::text <> 'READY'
        OR archive."academicCycleId" <> ac.id OR archive."organizationId" <> ac."organizationId")`],
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const counts = {};
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      counts[table] = result.rows[0].count;
    }
    const results = [];
    for (const [id, sql] of checks) {
      const result = await client.query(sql);
      results.push({ id, severity: 'BLOCKER', count: result.rows[0].count });
    }
    const blockers = results.filter((result) => result.count > 0);
    console.log(JSON.stringify({ database, counts, checks: results, passed: blockers.length === 0 }, null, 2));
    if (blockers.length) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Programs preflight failed: ${error.message}`);
  process.exit(2);
});
