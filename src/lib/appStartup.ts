const LAST_APP_ROUTE_PREFIX = 'servesync-last-app-route:';

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/landing',
  '/register',
  '/invite/',
  '/auth/',
  '/reset-password',
  '/create-church',
];

const APP_PATH_PREFIXES = [
  '/dashboard',
  '/activity-log',
  '/onboarding',
  '/reflection',
  '/events',
  '/attendance',
  '/announcements',
  '/library',
  '/songs',
  '/videos',
  '/sets',
  '/my-assignments',
  '/unavailable-members',
  '/profile',
  '/change-password',
  '/request-leave',
  '/notifications',
  '/messages',
  '/leadership',
];

type RouteStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isRememberableAppRoute(path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path === '/') return false;
  if (PUBLIC_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix))) return false;
  return APP_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

export function rememberLastAppRoute(storage: RouteStorage, userId: string, path: string) {
  if (!userId || !isRememberableAppRoute(path)) return;
  storage.setItem(`${LAST_APP_ROUTE_PREFIX}${userId}`, path);
}

export function getLastAppRoute(storage: RouteStorage, userId: string) {
  if (!userId) return '/dashboard';
  const storedPath = storage.getItem(`${LAST_APP_ROUTE_PREFIX}${userId}`);
  return storedPath && isRememberableAppRoute(storedPath) ? storedPath : '/dashboard';
}
