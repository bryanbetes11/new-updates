import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PREVIOUS_ROUTE_KEY = 'servesync.previousRoute';
const CURRENT_ROUTE_KEY = 'servesync.currentRoute';

function isClient() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function buildAppRoute(pathname: string, search = '', hash = '') {
  return `${pathname}${search}${hash}`;
}

export function rememberRoute(nextRoute: string) {
  if (!isClient()) return;

  const currentRoute = window.sessionStorage.getItem(CURRENT_ROUTE_KEY);
  if (currentRoute && currentRoute !== nextRoute) {
    window.sessionStorage.setItem(PREVIOUS_ROUTE_KEY, currentRoute);
  }

  window.sessionStorage.setItem(CURRENT_ROUTE_KEY, nextRoute);
}

export function getPreviousRoute(currentRoute: string, fallbackRoute: string) {
  if (!isClient()) return fallbackRoute;

  const previousRoute = window.sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
  if (!previousRoute || previousRoute === currentRoute) return fallbackRoute;
  if (!previousRoute.startsWith('/')) return fallbackRoute;

  return previousRoute;
}

export function useSmartBack(fallbackRoute: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const currentRoute = buildAppRoute(location.pathname, location.search, location.hash);
    navigate(getPreviousRoute(currentRoute, fallbackRoute));
  }, [fallbackRoute, location.hash, location.pathname, location.search, navigate]);
}
