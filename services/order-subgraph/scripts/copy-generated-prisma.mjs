import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serviceRoot, '..', '..');
const sourceDir = path.join(serviceRoot, 'prisma', 'generated');
const targetDir = path.join(serviceRoot, 'dist', 'src', 'generated', 'prisma');
const runtimeUtilsSourceDir = path.join(
  repoRoot,
  'node_modules',
  '.pnpm',
  'node_modules',
  '@prisma',
  'client-runtime-utils',
);
const runtimeUtilsTargetDir = path.join(
  sourceDir,
  'node_modules',
  '@prisma',
  'client-runtime-utils',
);

if (!fs.existsSync(sourceDir)) {
  console.error(`[copy-generated-prisma] source not found: ${sourceDir}`);
  process.exit(1);
}

if (!fs.existsSync(runtimeUtilsSourceDir)) {
  console.error(
    `[copy-generated-prisma] prisma runtime utils not found: ${runtimeUtilsSourceDir}`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(runtimeUtilsTargetDir), { recursive: true });
fs.rmSync(runtimeUtilsTargetDir, { recursive: true, force: true });
fs.cpSync(runtimeUtilsSourceDir, runtimeUtilsTargetDir, {
  recursive: true,
  dereference: true,
});

fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true, dereference: true });

console.log(`[copy-generated-prisma] copied to ${targetDir}`);
