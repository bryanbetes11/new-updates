import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(testsDirectory, '..');
const testFiles = (await readdir(testsDirectory))
  .filter(name => name.endsWith('.test.ts') && !name.startsWith('._'))
  .sort();

if (testFiles.length === 0) {
  throw new Error('No test files found.');
}

const server = await createServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

let failures = 0;

try {
  for (const testFile of testFiles) {
    try {
      await server.ssrLoadModule(`/tests/${testFile}`);
      console.log(`PASS tests/${testFile}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL tests/${testFile}`);
      console.error(error);
    }
  }
} finally {
  await server.close();
}

if (failures > 0) {
  throw new Error(`${failures} test file${failures === 1 ? '' : 's'} failed.`);
}

console.log(`All ${testFiles.length} test files passed.`);
