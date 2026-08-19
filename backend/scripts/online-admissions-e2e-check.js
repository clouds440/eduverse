#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

if (!process.argv.includes('--apply')) {
  console.error('This check creates and drops a temporary local database. Re-run with --apply.');
  process.exit(2);
}

const sourceConnectionString = process.env.DATABASE_URL;
if (!sourceConnectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}

const sourceUrl = new URL(sourceConnectionString);
if (!['localhost', '127.0.0.1', '::1'].includes(sourceUrl.hostname)) {
  console.error('Refusing to create an online-admissions test database on a non-local PostgreSQL server.');
  process.exit(2);
}

const databaseName = `eduverse_online_admissions_${process.pid}_${Date.now()}`;
const adminUrl = new URL(sourceConnectionString);
adminUrl.pathname = '/postgres';
adminUrl.searchParams.delete('schema');
const testUrl = new URL(sourceConnectionString);
testUrl.pathname = `/${databaseName}`;
const backendRoot = path.join(__dirname, '..');

function runNode(script, args = [], nodeArgs = []) {
  const result = spawnSync(process.execPath, [...nodeArgs, script, ...args], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      ONLINE_ADMISSIONS_DISPOSABLE_DATABASE: 'true',
    },
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || `${path.basename(script)} ${args.join(' ')} exited with ${result.status}`);
  }
}

async function main() {
  const admin = new Client({ connectionString: adminUrl.toString() });
  let created = false;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    runNode(path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js'), ['migrate', 'deploy']);
    runNode(
      path.join(backendRoot, 'node_modules', 'jest', 'bin', 'jest.js'),
      ['--config', 'test/jest-online-admissions.json', '--runInBand'],
      ['--experimental-vm-modules'],
    );
    console.log(JSON.stringify({ mode: 'LOCAL_DISPOSABLE_ONLINE_ADMISSIONS_E2E', database: databaseName, passed: true }, null, 2));
  } finally {
    if (created) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [databaseName]);
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    await admin.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`Online admissions e2e check failed: ${error.message}`);
  process.exit(1);
});
