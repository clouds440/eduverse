#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

if (!process.argv.includes('--apply')) {
  console.error(
    'This check creates and drops a temporary database. Re-run with --apply after confirming the target connection.',
  );
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}

const sourceUrl = new URL(connectionString);
if (!['localhost', '127.0.0.1', '::1'].includes(sourceUrl.hostname)) {
  console.error(
    'Refusing to create a restore-test database on a non-local server. Use an approved disposable environment.',
  );
  process.exit(2);
}

const suffix = `${process.pid}_${Date.now()}`;
const restoreDatabase = `eduverse_programs_restore_${suffix}`;
const backupPath = path.join(os.tmpdir(), `${restoreDatabase}.dump`);
const sourceDatabase = sourceUrl.pathname.replace(/^\//, '');
const adminUrl = new URL(connectionString);
adminUrl.pathname = '/postgres';
const restoreUrl = new URL(connectionString);
restoreUrl.pathname = `/${restoreDatabase}`;

const tableNames = [
  'Organization',
  'AcademicCycle',
  'Cohort',
  'Section',
  'Enrollment',
  'EnrollmentHistory',
  'CohortMembershipHistory',
  'Assessment',
  'Grade',
  'Submission',
  'SectionSchedule',
  'AttendanceSession',
  'AttendanceRecord',
  'CourseMaterial',
  'EvaluationWindow',
  'Evaluation',
  'PreferenceWindow',
  'PreferenceSubmission',
  'File',
  '_prisma_migrations',
];

function findPostgresTool(name) {
  const configured = process.env.POSTGRES_BIN
    ? path.join(process.env.POSTGRES_BIN, `${name}.exe`)
    : null;
  const candidates = [
    configured,
    `C:\\Program Files\\PostgreSQL\\18\\bin\\${name}.exe`,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${name}.exe`,
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${name}.exe`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  if (process.platform !== 'win32') return name;
  throw new Error(`${name} was not found. Set POSTGRES_BIN to the PostgreSQL bin directory.`);
}

function runTool(command, args) {
  const result = spawnSync(command, args, {
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(sourceUrl.password),
    },
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(command)} failed: ${(
        result.error?.message ||
        result.stderr ||
        result.stdout ||
        `exit ${result.status}`
      ).trim()}`,
    );
  }
}

async function getCounts(client) {
  const counts = {};
  for (const tableName of tableNames) {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM "${tableName}"`,
    );
    counts[tableName] = result.rows[0].count;
  }
  return counts;
}

async function main() {
  const pgDump = findPostgresTool('pg_dump');
  const pgRestore = findPostgresTool('pg_restore');
  const sourceClient = new Client({ connectionString });
  const adminClient = new Client({ connectionString: adminUrl.toString() });
  let restoreClient;
  let createdRestoreDatabase = false;

  await sourceClient.connect();
  await adminClient.connect();

  try {
    const sourceCounts = await getCounts(sourceClient);
    runTool(pgDump, [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--host',
      sourceUrl.hostname,
      '--port',
      sourceUrl.port || '5432',
      '--username',
      decodeURIComponent(sourceUrl.username),
      '--dbname',
      sourceDatabase,
      '--file',
      backupPath,
    ]);

    await adminClient.query(`CREATE DATABASE "${restoreDatabase}"`);
    createdRestoreDatabase = true;

    runTool(pgRestore, [
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--host',
      sourceUrl.hostname,
      '--port',
      sourceUrl.port || '5432',
      '--username',
      decodeURIComponent(sourceUrl.username),
      '--dbname',
      restoreDatabase,
      backupPath,
    ]);

    restoreClient = new Client({ connectionString: restoreUrl.toString() });
    await restoreClient.connect();
    const restoredCounts = await getCounts(restoreClient);
    await restoreClient.end();
    restoreClient = undefined;

    const mismatches = tableNames
      .filter((tableName) => sourceCounts[tableName] !== restoredCounts[tableName])
      .map((tableName) => ({
        table: tableName,
        source: sourceCounts[tableName],
        restored: restoredCounts[tableName],
      }));

    console.log(
      JSON.stringify(
        {
          mode: 'LOCAL_DISPOSABLE_RESTORE',
          sourceDatabase,
          restoredDatabase: restoreDatabase,
          tablesCompared: tableNames.length,
          mismatches,
          passed: mismatches.length === 0,
        },
        null,
        2,
      ),
    );
    if (mismatches.length > 0) process.exitCode = 1;
  } finally {
    if (restoreClient) await restoreClient.end().catch(() => undefined);
    if (createdRestoreDatabase) {
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [restoreDatabase],
      );
      await adminClient.query(`DROP DATABASE IF EXISTS "${restoreDatabase}"`);
    }
    await sourceClient.end().catch(() => undefined);
    await adminClient.end().catch(() => undefined);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }
}

main().catch((error) => {
  console.error(`Backup/restore check failed: ${error.message}`);
  process.exit(2);
});
