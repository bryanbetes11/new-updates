type RouteLoader = () => Promise<unknown>;

const routeLoaders: Record<string, RouteLoader> = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/events': () => import('../pages/Events'),
  '/announcements': () => import('../pages/Announcements'),
  '/library': () => import('../pages/Library'),
  '/messages': () => import('../pages/Messages'),
};

const preloadPromises = new Map<string, Promise<unknown>>();

function getRouteKey(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname.startsWith('/events/')) return '/events';
  if (pathname.startsWith('/announcements/')) return '/announcements';
  return pathname;
}

export function preloadRoute(path: string) {
  const routeKey = getRouteKey(path);
  const loader = routeLoaders[routeKey];
  if (!loader) return Promise.resolve();

  const existing = preloadPromises.get(routeKey);
  if (existing) return existing;

  const preload = loader().catch((error) => {
    preloadPromises.delete(routeKey);
    throw error;
  });
  preloadPromises.set(routeKey, preload);
  return preload;
}

export function preloadPrimaryRoutes() {
  return Promise.allSettled([
    preloadRoute('/dashboard'),
    preloadRoute('/events'),
    preloadRoute('/announcements'),
    preloadRoute('/library'),
  ]);
}
