#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const repositoryRoot = path.join(backendRoot, '..');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');

function modelBody(schema, model) {
  const match = schema.match(new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Prisma model ${model} was not found`);
  return match[1];
}

function sourceFiles(root) {
  const ignored = new Set(['.git', '.next', 'dist', 'node_modules', 'generated', 'coverage']);
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(fullPath);
    }
  };
  visit(root);
  return files;
}

const schema = fs.readFileSync(schemaPath, 'utf8');
const removedModels = [
  'ProgramAcademicCycle',
  'StudentProgramEnrollmentCycle',
  'StudentStageAttempt',
  'CohortMembershipHistory',
];
const removedModelFields = [
  ['AcademicCycle', 'isActive'],
  ['Cohort', 'isActive'],
  ['Program', 'requiredCycleCount'],
  ['Student', 'major'],
  ['Student', 'department'],
];
const failures = [];

for (const model of removedModels) {
  if (new RegExp(`model\\s+${model}\\s*\\{`).test(schema)) {
    failures.push(`prisma/schema.prisma: removed model ${model} still exists`);
  }
}

for (const [model, field] of removedModelFields) {
  const body = modelBody(schema, model);
  if (new RegExp(`^\\s*${field}\\s+`, 'm').test(body)) {
    failures.push(`prisma/schema.prisma: ${model}.${field} still exists`);
  }
}

const sourcePatterns = [
  { label: 'AcademicCycle.isActive reader/writer', regex: /\bacademicCycle\.isActive\b/g },
  { label: 'Cohort.isActive reader/writer', regex: /\bcohort\.isActive\b/g },
  { label: 'Student.major reader/writer', regex: /\bstudent\.major\b/g },
  { label: 'Student.department reader/writer', regex: /\bstudent\.department\b/g },
];

for (const root of [path.join(backendRoot, 'src'), path.join(repositoryRoot, 'frontend')]) {
  for (const file of sourceFiles(root)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of sourcePatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(content)) {
        failures.push(`${path.relative(repositoryRoot, file)}: ${pattern.label}`);
      }
    }
  }
}

if (failures.length) {
  console.error(JSON.stringify({ passed: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  checkedRemovedModels: removedModels,
  checkedModelFields: removedModelFields.map(([model, field]) => `${model}.${field}`),
  checkedSourceFiles: sourceFiles(path.join(backendRoot, 'src')).length + sourceFiles(path.join(repositoryRoot, 'frontend')).length,
}, null, 2));
