#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const backendRoot = path.join(__dirname, '..');
const prismaCli = path.join(
  backendRoot,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

const migration = spawnSync(
  process.execPath,
  [prismaCli, 'migrate', 'deploy'],
  {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  },
);

if (migration.error) {
  console.error(`Database migration failed: ${migration.error.message}`);
  process.exit(1);
}

if (migration.status !== 0) {
  console.error(`Database migration failed with exit code ${migration.status}`);
  process.exit(migration.status || 1);
}

require(path.join(backendRoot, 'dist', 'main.js'));
