export const APP_VERSION = __APP_VERSION__;
export const APP_BUILD_ID = __APP_BUILD_ID__;
export const APP_CACHE_VERSION = `${APP_VERSION}-${APP_BUILD_ID}`;
export const APP_UPDATE_VERSION = APP_VERSION;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_UPDATE_PUBLISHED_AT = __APP_PUBLISHED_AT__;
export const APP_MINIMUM_SUPPORTED_VERSION = __APP_MINIMUM_SUPPORTED_VERSION__;
export const APP_RELEASE_NOTES_SEEN_KEY = 'servesync-release-notes-seen-version';
export const APP_DAILY_UPDATE_CHECK_KEY = 'servesync-daily-update-check-date:v1';

function numericVersionParts(version: string) {
  return version
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map(part => Number.parseInt(part, 10) || 0);
}

export function compareAppVersions(left: string, right: string) {
  const leftParts = numericVersionParts(left);
  const rightParts = numericVersionParts(right);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }

  return 0;
}

export function isAppVersionBelow(currentVersion: string, minimumVersion: string) {
  return compareAppVersions(currentVersion, minimumVersion) < 0;
}

export const APP_UPDATE_FEATURES = [
  'A new ServeSync opening screen now prepares your saved workspace before any account screen appears.',
  'ServeSync remembers the last useful page you opened and returns you there after a cold start.',
  'Profile now includes About ServeSync, where you can see the installed version, check for updates, and reopen What’s New.',
  'Long-running app sessions now check for a fresh version after returning from the background or reconnecting to the internet.',
];

export const APP_UPDATE_FIXES = [
  'Signed-in users no longer see the Login page while their saved session is being restored.',
  'Routine updates can be installed later, while truly incompatible versions can still require an immediate update.',
  'Version information now comes from the release build instead of separate hard-coded labels that can drift apart.',
];
