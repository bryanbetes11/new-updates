import type { Location, NavigateOptions } from 'react-router-dom';

export function isEventModalBackgroundPath(pathname: string): boolean {
  return pathname.startsWith('/') && !pathname.startsWith('//')
    && !/^\/(events|announcements)\/[^/]+/.test(pathname)
    && !/^\/(login|register|reset-password|auth|invite|onboarding|preview)(\/|$)/.test(pathname);
}

export function eventModalNavigationOptions(destination: string, location: Location, desktop: boolean): NavigateOptions | undefined {
  if (!desktop || !/^\/events\/[^/?#]+(?:[?#]|$)/.test(destination)) return undefined;
  const saved = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
  const backgroundLocation = saved && isEventModalBackgroundPath(saved.pathname) ? saved
    : isEventModalBackgroundPath(location.pathname) ? location
    : { ...location, pathname: '/events', search: '', hash: '', state: null };
  return { state: { backgroundLocation, returnTo: `${backgroundLocation.pathname}${backgroundLocation.search}${backgroundLocation.hash}` } };
}
