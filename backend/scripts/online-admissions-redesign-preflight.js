#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const analyze = args.has('--analyze');
const outputArg = process.argv.slice(2).find((arg) => arg.startsWith('--output='));
const outputPath = outputArg ? path.resolve(process.cwd(), outputArg.slice('--output='.length)) : null;

if (!apply) {
  console.error('Refusing database access without --apply. Use a disposable, staging, or approved sanitized database.');
  process.exit(2);
}
if (analyze && process.env.ONLINE_ADMISSIONS_ALLOW_ANALYZE !== 'true') {
  console.error('Refusing EXPLAIN ANALYZE unless ONLINE_ADMISSIONS_ALLOW_ANALYZE=true.');
  process.exit(2);
}

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
  'ProgramOffering',
  'AdmissionApplicationTemplate',
  'AdmissionApplicationTemplateVersion',
  'AdmissionDocumentRequirement',
  'ProgramOfferingApplicationConfig',
  'ProgramOfferingPublication',
  'OnlineAdmissionSubmission',
  'OnlineAdmissionDocumentUpload',
  'OnlineAdmissionStatusEvent',
  'File',
  'Student',
  'StudentProgramEnrollment',
];

const checks = [
  ['submission_context_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count
    FROM "OnlineAdmissionSubmission" s
    JOIN "Program" p ON p.id = s."programId"
    JOIN "ProgramOffering" o ON o.id = s."programOfferingId"
    LEFT JOIN "CampusProgramOfferingBinding" binding ON binding."programOfferingId" = o.id
    WHERE s."providerId" <> p."providerId"
       OR s."providerId" <> o."providerId"
       OR o."programId" <> p.id
       OR (binding.id IS NOT NULL AND s."organizationId" IS DISTINCT FROM binding."organizationId")
       OR (binding.id IS NOT NULL AND s."academicCycleId" IS DISTINCT FROM binding."academicCycleId")`],
  ['document_requirement_context_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count
    FROM "AdmissionDocumentRequirement" r
    JOIN "AdmissionApplicationTemplateVersion" v ON v.id = r."templateVersionId"
    JOIN "AdmissionApplicationTemplate" t ON t.id = v."templateId"
    WHERE t."providerId" IS NULL`],
  ['document_upload_context_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count
    FROM "OnlineAdmissionDocumentUpload" u
    JOIN "OnlineAdmissionSubmission" s ON s.id = u."submissionId"
    LEFT JOIN "AdmissionDocumentRequirement" r ON r.id = u."requirementId"
    JOIN "File" f ON f.id = u."fileId"
    WHERE u."providerId" <> s."providerId"
       OR u."organizationId" IS DISTINCT FROM s."organizationId"
       OR f."providerId" IS DISTINCT FROM u."providerId"
       OR f."orgId" IS DISTINCT FROM u."organizationId"
       OR f."entityType" <> 'ONLINE_ADMISSION'
       OR f."entityId" <> s.id`],
  ['admitted_student_context_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count
    FROM "OnlineAdmissionSubmission" s
    JOIN "Student" st ON st.id = s."admittedStudentId"
    WHERE s."admittedStudentId" IS NOT NULL
      AND (s."organizationId" <> st."organizationId"
        OR NOT EXISTS (
          SELECT 1
          FROM "StudentProgramEnrollment" e
          JOIN "ProgramOffering" o ON o.id = s."programOfferingId"
          WHERE e."studentId" = st.id
            AND e."organizationId" = s."organizationId"
            AND e."programId" = s."programId"
            AND e."curriculumVersionId" = (
              SELECT binding."curriculumVersionId"
              FROM "CampusProgramOfferingBinding" binding
              WHERE binding."programOfferingId" = o.id
            )
        ))`],
  ['duplicate_active_application_groups', 'BLOCKER', `
    SELECT COUNT(*)::int AS count FROM (
      SELECT "programOfferingId", LOWER(BTRIM("applicantEmail"))
      FROM "OnlineAdmissionSubmission"
      WHERE status::text NOT IN ('REJECTED', 'WITHDRAWN')
      GROUP BY "programOfferingId", LOWER(BTRIM("applicantEmail"))
      HAVING COUNT(*) > 1
    ) duplicates`],
  ['enabled_organization_without_eligible_offering', 'WARNING', `
    SELECT COUNT(*)::int AS count
    FROM "Organization" org
    WHERE org."onlineAdmissionsEnabled" = true
      AND NOT EXISTS (
        SELECT 1 FROM "CampusProgramOfferingBinding" binding
        JOIN "ProgramOffering" o ON o.id = binding."programOfferingId"
        JOIN "Program" p ON p.id = o."programId"
        JOIN "CampusProgramConfiguration" cfg ON cfg."programId" = p.id
        JOIN "Department" d ON d.id = cfg."departmentId"
        WHERE binding."organizationId" = org.id
          AND o."onlineAdmissionEnabled" = true
          AND o.status::text = 'OPEN'
          AND p.status::text = 'ACTIVE'
          AND p."isVisibleForAdmissions" = true
          AND d."isActive" = true
      )`],
];

const providerChecks = [
  ['campus_organization_provider_count_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count
    FROM "Organization" org
    WHERE (SELECT COUNT(*) FROM "EducationProvider" provider
           WHERE provider."campusOrganizationId" = org.id) <> 1`],
  ['provider_owned_record_missing_provider', 'BLOCKER', `
    SELECT (
      (SELECT COUNT(*) FROM "Program" WHERE "providerId" IS NULL) +
      (SELECT COUNT(*) FROM "ProgramOffering" WHERE "providerId" IS NULL) +
      (SELECT COUNT(*) FROM "AdmissionApplicationTemplate" WHERE "providerId" IS NULL) +
      (SELECT COUNT(*) FROM "ProgramOfferingApplicationConfig" WHERE "providerId" IS NULL) +
      (SELECT COUNT(*) FROM "OnlineAdmissionSubmission" WHERE "providerId" IS NULL) +
      (SELECT COUNT(*) FROM "OnlineAdmissionDocumentUpload" WHERE "providerId" IS NULL) +
      (SELECT COUNT(*) FROM "File" WHERE "providerId" IS NULL)
    )::int AS count`],
  ['provider_organization_ownership_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count FROM (
      SELECT p.id FROM "Program" p
      JOIN "EducationProvider" provider ON provider.id = p."providerId"
      WHERE provider."campusOrganizationId" IS NOT NULL
        AND provider."campusOrganizationId" IS DISTINCT FROM p."organizationId"
      UNION ALL
      SELECT s.id FROM "OnlineAdmissionSubmission" s
      JOIN "EducationProvider" provider ON provider.id = s."providerId"
      WHERE provider."campusOrganizationId" IS NOT NULL
        AND provider."campusOrganizationId" IS DISTINCT FROM s."organizationId"
    ) mismatches`],
  ['campus_provider_membership_mismatch', 'BLOCKER', `
    SELECT COUNT(*)::int AS count
    FROM "EducationProviderMembership" membership
    JOIN "EducationProvider" provider ON provider.id = membership."providerId"
    JOIN "User" usr ON usr.id = membership."userId"
    WHERE provider."campusOrganizationId" IS NOT NULL
      AND provider."campusOrganizationId" IS DISTINCT FROM usr."organizationId"`],
];

const queryBaselines = [
  ['public_offering_discovery', `
    SELECT o.id
    FROM "ProgramOffering" o
    JOIN "EducationProvider" provider ON provider.id = o."providerId"
    JOIN "Program" p ON p.id = o."programId"
    WHERE o."onlineAdmissionEnabled" = true
      AND o.status::text = 'OPEN'
      AND p.status::text = 'ACTIVE'
      AND provider.status::text = 'ACTIVE'
    ORDER BY o."applicationClosesAt" ASC NULLS LAST LIMIT 50`],
  ['public_offering_detail', `
    SELECT o.id FROM "ProgramOffering" o
    JOIN "Program" p ON p.id = o."programId"
    JOIN "EducationProvider" provider ON provider.id = o."providerId"
    WHERE o.id = '00000000-0000-0000-0000-000000000000'
      AND o."onlineAdmissionEnabled" = true
      AND o.status::text = 'OPEN'
      AND p.status::text = 'ACTIVE'
      AND provider.status::text = 'ACTIVE'`],
  ['admin_applicant_inbox', `
    SELECT id FROM "OnlineAdmissionSubmission"
    WHERE "organizationId" = '00000000-0000-0000-0000-000000000000'
    ORDER BY "submittedAt" DESC LIMIT 25`],
  ['active_duplicate_lookup', `
    SELECT id FROM "OnlineAdmissionSubmission"
    WHERE "programOfferingId" = '00000000-0000-0000-0000-000000000000'
      AND LOWER(BTRIM("applicantEmail")) = 'baseline@example.invalid'
      AND status::text NOT IN ('REJECTED', 'WITHDRAWN')
    LIMIT 1`],
];

function summarizePlan(plan) {
  const root = plan?.[0]?.Plan;
  return {
    totalCost: root?.['Total Cost'] ?? null,
    planRows: root?.['Plan Rows'] ?? null,
    nodeType: root?.['Node Type'] ?? null,
    planningTimeMs: plan?.[0]?.['Planning Time'] ?? null,
    executionTimeMs: plan?.[0]?.['Execution Time'] ?? null,
  };
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('SET statement_timeout = 30000');
    await client.query('SET lock_timeout = 5000');

    const counts = {};
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      counts[table] = result.rows[0].count;
    }
    const providerSchemaResult = await client.query(`
      SELECT to_regclass('"EducationProvider"') IS NOT NULL AS present
    `);
    const providerSchemaPresent = providerSchemaResult.rows[0].present;
    if (providerSchemaPresent) {
      for (const table of ['EducationProvider', 'EducationProviderMembership']) {
        const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
        counts[table] = result.rows[0].count;
      }
    }

    const integrity = [];
    const activeChecks = providerSchemaPresent ? [...checks, ...providerChecks] : checks;
    for (const [id, severity, sql] of activeChecks) {
      const result = await client.query(sql);
      integrity.push({ id, severity, count: result.rows[0].count });
    }

    const queryPlans = [];
    const explainPrefix = analyze
      ? 'EXPLAIN (ANALYZE true, BUFFERS true, FORMAT JSON)'
      : 'EXPLAIN (ANALYZE false, FORMAT JSON)';
    for (const [id, sql] of queryBaselines) {
      const result = await client.query(`${explainPrefix} ${sql}`);
      queryPlans.push({ id, ...summarizePlan(result.rows[0]['QUERY PLAN']) });
    }

    const blockers = integrity.filter((item) => item.severity === 'BLOCKER' && item.count > 0);
    const report = {
      generatedAt: new Date().toISOString(),
      database,
      analyze,
      providerSchemaPresent,
      counts,
      integrity,
      queryPlans,
      passed: blockers.length === 0,
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (outputPath) fs.writeFileSync(outputPath, serialized, { encoding: 'utf8', flag: 'wx' });
    process.stdout.write(serialized);
    if (blockers.length) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Online admissions redesign preflight failed: ${error.message}`);
  process.exit(2);
});
