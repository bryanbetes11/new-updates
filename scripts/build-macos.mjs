import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';

if (process.platform !== 'darwin') {
  throw new Error('A Mac is required to build a real .dmg. Run this script on your Mac or the prepared GitHub Mac runner.');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const env = { ...process.env, ...loadEnv('production', root, 'VITE_') };
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('The existing public client URL and anon key are required. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for this build.');
}
// Only client keys may be bundled. Never accept a secret or service-role key.
const key = env.VITE_SUPABASE_ANON_KEY;
if (!key.startsWith('sb_publishable_')) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* rejected below */ }
  if (role !== 'anon') throw new Error('The Mac build requires a public client key; privileged keys cannot be bundled.');
}
const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const version = config.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Set an explicit desktop version before building.');
const target = 'aarch64-apple-darwin';
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error?.message || result.status}`);
  return result.stdout?.trim();
}
run(process.execPath, [resolve('node_modules/@tauri-apps/cli/tauri.js'), 'build', '--target', target, '--bundles', 'dmg'], { stdio: 'inherit' });
const bundle = resolve(`src-tauri/target/${target}/release/bundle`);
const app = join(bundle, 'macos', `${config.productName}.app`);
const dmgFolder = join(bundle, 'dmg');
const dmgName = readdirSync(dmgFolder).find(name => name.endsWith(`_${version}_aarch64.dmg`));
if (!dmgName || !existsSync(app)) throw new Error('The expected Apple Silicon app and disk image were not produced.');
const dmg = join(dmgFolder, dmgName);
const executable = JSON.parse(readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^name = ("[^"]+")/m)[1]);
function verifyApp(appPath) {
  const appVersion = run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', join(appPath, 'Contents/Info.plist')]);
  if (appVersion !== version) throw new Error('Mac app version does not match the requested version.');
  const binary = join(appPath, 'Contents/MacOS', executable);
  run('lipo', ['-verify_arch', 'arm64', binary]);
  run('codesign', ['--verify', '--deep', '--strict', appPath]);
  if (!existsSync(join(appPath, 'Contents/Resources/icon.icns'))) throw new Error('Mac application icon is missing.');
  return createHash('sha256').update(readFileSync(binary)).digest('hex');
}
const appHash = verifyApp(app);
run('hdiutil', ['verify', dmg]);
const mount = mkdtempSync(join(tmpdir(), 'servesync-dmg-'));
let attached = false;
try {
  run('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg]);
  attached = true;
  if (verifyApp(join(mount, `${config.productName}.app`)) !== appHash) throw new Error('The app inside the DMG differs from the verified app bundle.');
  if (!existsSync(join(mount, 'Applications'))) throw new Error('The disk image is missing its Applications shortcut.');
} finally {
  if (attached) run('hdiutil', ['detach', mount]);
  rmdirSync(mount);
}
const output = resolve('output/macos', version);
mkdirSync(output, { recursive: true });
const name = `ServeSync-${version}-Mac-Apple-Silicon.dmg`;
copyFileSync(dmg, join(output, name));
const hash = createHash('sha256').update(readFileSync(dmg)).digest('hex');
writeFileSync(join(output, 'SHA256SUMS.txt'), `${hash}  ${name}\n`);
writeFileSync(join(output, 'verification.json'), `${JSON.stringify({ version, target, sha256: hash, appExecutableSha256: appHash, checks: ['app version', 'arm64 executable', 'ad-hoc signature integrity', 'Mac icon', 'disk image integrity', 'mounted app matches build', 'Applications shortcut'], appleNotarized: false, installedRuntimeTested: false }, null, 2)}\n`);
writeFileSync(join(output, 'INSTALL.txt'), 'Personal Mac test build. Requires an Apple M-series Mac running macOS 12 or newer.\n\nOpen the DMG and drag ServeSync into Applications. Launch ServeSync from Applications.\n\nThis build is ad-hoc signed, without Apple notarization. If macOS blocks opening, review the app in System Settings > Privacy & Security and use Open Anyway only if you trust this build. No security settings need to be disabled.\n\nMac updates are manual in this first test build. Download a newer DMG, quit ServeSync, then replace the app in Applications. Your app data is kept separately.\n\nBuild verification does not prove login, notifications, or other runtime behavior on your Mac.\n');
console.log(`Prepared verified Mac test installer in ${output}. Nothing was published.`);
