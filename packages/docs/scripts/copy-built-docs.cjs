const fs = require('node:fs');
const path = require('node:path');

const targetRoot = path.resolve(process.cwd(), process.argv[2] || '.');
const sourceDir = process.argv[3]
  ? path.resolve(process.cwd(), process.argv[3])
  : path.resolve(__dirname, '..', 'dist');
const targetDir = path.join(targetRoot, '.generated', 'docs');
const files = ['index.js', 'index.d.ts'];

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
}
