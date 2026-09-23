import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const windows = process.platform === 'win32';
if (windows && !process.env.JAVA_HOME) {
  const parent = join(process.env.ProgramFiles || 'C:/Program Files', 'Eclipse Adoptium');
  const jdk = existsSync(parent) && readdirSync(parent).find(name => name.startsWith('jdk-21.'));
  if (jdk) process.env.JAVA_HOME = join(parent, jdk);
}
if (windows && !process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT && process.env.LOCALAPPDATA) {
  process.env.ANDROID_HOME = join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ['scripts/mobile-doctor.mjs']);
const push = process.argv.includes('--push');
if (process.argv.includes('--skip-web-build')) {
  throw new Error('Rebuild web assets for every APK so the Android push setting matches this build.');
}
if (push) {
  const filename = join(root, 'android/app/google-services.json');
  if (!existsSync(filename)) throw new Error('Add Firebase Android configuration to android/app/google-services.json before building with --push.');
  const services = JSON.parse(readFileSync(filename, 'utf8'));
  if (!services.client?.some(client => client.client_info?.android_client_info?.package_name === 'com.babcreations.servesync')) {
    throw new Error('Firebase Android package must be com.babcreations.servesync.');
  }
}
process.env.VITE_ANDROID_PUSH_ENABLED = push ? 'true' : 'false';
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
if (windows) {
  // Fixed trusted command; no user-controlled text is passed to the shell.
  run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --console=plain'], join(root, 'android'));
} else {
  run('sh', ['gradlew', 'assembleDebug', '--console=plain'], join(root, 'android'));
}
console.log('Debug APK: android/app/build/outputs/apk/debug/app-debug.apk');
console.log('Development build only; this is not a signed Play Store release.');
