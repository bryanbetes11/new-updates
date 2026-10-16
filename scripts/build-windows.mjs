import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const version = config.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Set an explicit stable Windows version in tauri.conf.json.');
const key = process.env.TAURI_SIGNING_PRIVATE_KEY || join(homedir(), '.tauri', 'servesync-windows', 'updater.key');
if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !existsSync(key)) throw new Error('Windows updater signing key is missing. Restore the existing key; do not generate a replacement.');
const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY: key, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' };
const pathKey = Object.keys(env).find(name => name.toLowerCase() === 'path') || 'PATH';
env[pathKey] = `${join(homedir(), '.cargo', 'bin')};${env[pathKey] || ''}`;
const cli = resolve('node_modules/@tauri-apps/cli/tauri.js');
const result = spawnSync(process.execPath, [cli, 'build', '--bundles', 'nsis'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const source = resolve(`src-tauri/target/release/bundle/nsis/ServeSync_${version}_x64-setup.exe`);
const signature = readFileSync(`${source}.sig`, 'utf8').trim();
const output = resolve('output/windows', version);
mkdirSync(output, { recursive: true });
const name = `ServeSync-${version}-Windows-x64-Setup.exe`;
copyFileSync(source, join(output, name));
copyFileSync(`${source}.sig`, join(output, `${name}.sig`));
const manifest = {
  version,
  notes: 'Fixes the blank Team tab in event details on Windows. Existing notification and update features are retained.',
  pub_date: new Date().toISOString(),
  platforms: { 'windows-x86_64': { signature, url: `https://github.com/bryanbetes11/new-updates/releases/download/windows-updates/${name}` } },
};
writeFileSync(join(output, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const hash = createHash('sha256').update(readFileSync(source)).digest('hex');
writeFileSync(join(output, 'SHA256SUMS.txt'), `${hash}  ${name}\n`);
console.log(`Prepared signed Windows update artifacts in ${output}. Nothing was published.`);
