#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
const planPath = path.join(backendRoot, '..', 'online-admissions-redesign-plan.md');

function modelBody(schema, modelName) {
  const match = schema.match(new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Prisma model ${modelName} was not found`);
  return match[1];
}

const allowedProgramAdmissionsFields = new Set([
  'onlineAdmissionSubmissions',
]);

const schema = fs.readFileSync(schemaPath, 'utf8');
const programFields = modelBody(schema, 'Program')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'))
  .map((line) => line.split(/\s+/)[0]);

const admissionsLikeFields = programFields.filter((field) =>
  /(admission|application|document|fee|funding|public|publish)/i.test(field),
);
const unexpected = admissionsLikeFields.filter((field) => !allowedProgramAdmissionsFields.has(field));
const failures = [];

if (unexpected.length) {
  failures.push(
    `Program has new admissions/publication fields: ${unexpected.join(', ')}. Put them in Admissions configuration or ProgramOffering publication models.`,
  );
}

if (!fs.existsSync(planPath)) {
  failures.push('online-admissions-redesign-plan.md is missing');
}

if (failures.length) {
  console.error(JSON.stringify({ passed: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  programAdmissionsFieldFreeze: [...allowedProgramAdmissionsFields],
  checkedProgramFields: programFields.length,
  plan: path.basename(planPath),
}, null, 2));
