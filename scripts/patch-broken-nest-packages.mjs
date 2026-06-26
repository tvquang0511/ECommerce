import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const packages = [
  {
    name: '@nestjs/cqrs',
    packageDir: path.resolve(
      workspaceRoot,
      'services/order-subgraph/node_modules/@nestjs/cqrs',
    ),
  },
  {
    name: '@nestjs/schedule',
    packageDir: path.resolve(
      workspaceRoot,
      'services/order-subgraph/node_modules/@nestjs/schedule',
    ),
  },
];

function ensureFile(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function ensurePackageEntrypoints(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let changed = false;

  if (!packageJson.main) {
    packageJson.main = 'index.js';
    changed = true;
  }

  if (!packageJson.types) {
    packageJson.types = 'index.d.ts';
    changed = true;
  }

  if (!packageJson.exports) {
    packageJson.exports = {
      '.': {
        types: './index.d.ts',
        default: './index.js',
      },
    };
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  ensureFile(
    path.join(packageDir, 'index.js'),
    "module.exports = require('./dist');\n",
  );
  ensureFile(
    path.join(packageDir, 'index.d.ts'),
    "export * from './dist';\n",
  );
}

function ensureRuntimeStubs(packageDir) {
  const distDir = path.join(packageDir, 'dist');
  if (!fs.existsSync(distDir)) {
    return;
  }

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith('.d.ts')) {
        continue;
      }

      const jsPath = fullPath.replace(/\.d\.ts$/u, '.js');
      if (fs.existsSync(jsPath)) {
        continue;
      }

      fs.writeFileSync(
        jsPath,
        "'use strict';\nObject.defineProperty(exports, '__esModule', { value: true });\n",
        'utf8',
      );
    }
  };

  walk(distDir);
}

for (const pkg of packages) {
  const realPackageDir = fs.existsSync(pkg.packageDir)
    ? fs.realpathSync(pkg.packageDir)
    : null;

  if (!realPackageDir) {
    continue;
  }

  ensurePackageEntrypoints(realPackageDir);
  ensureRuntimeStubs(realPackageDir);
}

console.log('[patch-broken-nest-packages] completed');
