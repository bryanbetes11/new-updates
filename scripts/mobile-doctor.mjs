import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const windows = process.platform === 'win32';
const adoptium = join(process.env.ProgramFiles || 'C:/Program Files', 'Eclipse Adoptium');
const temurin21 = windows && existsSync(adoptium)
  ? readdirSync(adoptium).find(name => name.startsWith('jdk-21.')) : undefined;
const candidates = [
  process.env.JAVA_HOME,
  temurin21 && join(adoptium, temurin21),
  windows && join(process.env.ProgramFiles || 'C:/Program Files', 'Android', 'Android Studio', 'jbr'),
].filter(Boolean);
const javaHome = candidates.find(path => existsSync(join(path, 'bin', windows ? 'java.exe' : 'java')));
const java = javaHome ? join(javaHome, 'bin', windows ? 'java.exe' : 'java') : 'java';
const javaCheck = spawnSync(java, ['-version'], { encoding: 'utf8', windowsHide: true });
const javaMajor = Number((javaCheck.stderr || javaCheck.stdout || '').match(/version "(\d+)/)?.[1]);
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (windows
  ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk')
  : join(homedir(), 'Library', 'Android', 'sdk'));
const checks = [
  ['Node 22 or newer', Number(process.versions.node.split('.')[0]) >= 22],
  ['Android project', existsSync('android/gradlew')],
  ['Java 21–24 for this Gradle build (Java 21 recommended)', javaCheck.status === 0 && javaMajor >= 21 && javaMajor <= 24],
  ['Android SDK platform 36', existsSync(join(sdk, 'platforms', 'android-36', 'android.jar'))],
  ['Android SDK build tools 36.0.0', existsSync(join(sdk, 'build-tools', '36.0.0'))],
  ['Android device tools', existsSync(join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb'))],
];
for (const [name, passed] of checks) console.log(`${passed ? 'OK' : 'MISSING'}  ${name}`);
console.log(`SDK location: ${sdk}`);
console.log('iOS source is preparable here; compiling and device verification require macOS/Xcode.');
console.log('This checks build tools only, not store readiness, signing, push, or device behavior.');
if (checks.some(([, passed]) => !passed)) process.exitCode = 1;
