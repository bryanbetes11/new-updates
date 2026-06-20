import { useState, useEffect, type CSSProperties, type WheelEvent as ReactWheelEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation } from './Navigation';
import { useAuth } from '../contexts/AuthContext';
import { BillingStatusBanner } from './BillingStatusBanner';
import { buildAppRoute, rememberRoute } from '../lib/navigationHistory';

const scrollableOverflowValues = new Set(['auto', 'scroll', 'overlay']);
const nativeWheelScrollSelectors = [
  '[data-modal-body]',
  '[data-mobile-menu-scroll]',
  '.messages-scroll-area',
  '.service-mode-chart-scroll',
  '.service-mode-edit-scroll',
].join(',');
const wheelContainmentSelectors = [
  '[data-modal-sheet]',
  '.chat-container',
  '.service-mode-overlay',
].join(',');

function canScrollElementWithWheel(element: HTMLElement, deltaY: number) {
  const style = window.getComputedStyle(element);
  if (!scrollableOverflowValues.has(style.overflowY)) return false;
  if (element.scrollHeight <= element.clientHeight + 1) return false;

  const atTop = element.scrollTop <= 0;
  const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
  return (deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom);
}

function hasNativeWheelScroller(target: HTMLElement | null, deltaY: number) {
  if (target?.closest(wheelContainmentSelectors)) return true;

  let element = target;
  while (element && element !== document.body && element !== document.documentElement) {
    if (element.matches(nativeWheelScrollSelectors) && canScrollElementWithWheel(element, deltaY)) return true;
    if (canScrollElementWithWheel(element, deltaY)) return true;
    element = element.parentElement;
  }
  return false;
}

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileChromeHidden = false;

  const staticHideNav = ['/', '/login', '/register', '/onboarding', '/reset-password', '/create-church'].includes(location.pathname)
    || /^\/invite\/[^/]+$/.test(location.pathname);
  const isEventDetail = /^\/events\/[^/]+$/.test(location.pathname);
  const isAnnouncementCreate = location.pathname === '/announcements/new';
  const isAnnouncementDetail = /^\/announcements\/[^/]+$/.test(location.pathname) && !isAnnouncementCreate;
  const isMessagesPage = location.pathname.startsWith('/messages');
  const isMessagesConversation = /^\/messages\/[^/]+$/.test(location.pathname);
  const isDashboardPage = location.pathname === '/dashboard';
  const isEventsPage = location.pathname === '/events';
  const isAnnouncementsPage = location.pathname === '/announcements';
  const isSongsPage = location.pathname === '/songs';
  const isVideosPage = location.pathname === '/videos';
  const isSetsPage = location.pathname === '/sets';
  const isRequestLeavePage = location.pathname === '/request-leave';
  const isNotificationsPage = location.pathname === '/notifications';
  const isProfilePage = location.pathname === '/profile';
  const isLeadershipPage = location.pathname.startsWith('/leadership');
  const isWideShellPage =
    isDashboardPage
    || isEventsPage
    || isEventDetail
    || isAnnouncementsPage
    || isAnnouncementCreate
    || isAnnouncementDetail
    || isSongsPage
    || isVideosPage
    || isSetsPage
    || isRequestLeavePage
    || isNotificationsPage
    || isProfilePage
    || isLeadershipPage;
  const hideNavMobile = staticHideNav || isAnnouncementDetail;
  const shouldShiftForMobileMenu = user && !staticHideNav && !isMessagesConversation && mobileOpen;
  const desktopSidebarWidth = user && !staticHideNav ? (collapsed ? 92 : 300) : 0;
  const mainStyle = {
    pointerEvents: shouldShiftForMobileMenu ? 'none' : undefined,
    '--desktop-sidebar-width': `${desktopSidebarWidth}px`,
  } as CSSProperties;
  const shouldAllowNativePullRefresh =
    isDashboardPage || isEventsPage || isEventDetail || isAnnouncementsPage || isAnnouncementDetail || isLeadershipPage;

  useEffect(() => {
    rememberRoute(buildAppRoute(location.pathname, location.search, location.hash));
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    document.body.classList.toggle('allow-native-pull-refresh', shouldAllowNativePullRefresh);
    return () => {
      document.body.classList.remove('allow-native-pull-refresh');
    };
  }, [shouldAllowNativePullRefresh]);

  useEffect(() => {
    const clampHorizontalScroll = () => {
      if (window.scrollX === 0) return;
      window.scrollTo(0, window.scrollY);
    };

    window.addEventListener('scroll', clampHorizontalScroll, { passive: true });
    return () => window.removeEventListener('scroll', clampHorizontalScroll);
  }, []);

  const handlePageWheelCapture = (event: ReactWheelEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    if (hasNativeWheelScroller(target, event.deltaY)) return;

    const scrollingElement = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
    if (maxScroll <= 0) return;

    const currentTop = scrollingElement.scrollTop;
    const nextTop = Math.min(maxScroll, Math.max(0, currentTop + event.deltaY));
    if (nextTop === currentTop) return;

    event.preventDefault();
    scrollingElement.scrollTop = nextTop;
  };

  useEffect(() => {
    if (!shouldShiftForMobileMenu) return;
    let touchStartY = 0;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    const preventBackgroundWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-mobile-menu-scroll]')) return;
      event.preventDefault();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      const scrollContainer = target?.closest('[data-mobile-menu-scroll]') as HTMLElement | null;

      if (!scrollContainer) {
        event.preventDefault();
        return;
      }

      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = currentY - touchStartY;
      const canScroll = scrollContainer.scrollHeight > scrollContainer.clientHeight + 1;
      const atTop = scrollContainer.scrollTop <= 0;
      const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1;

      if (!canScroll || (atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
    };

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.classList.add('mobile-menu-active');
    document.body.classList.add('mobile-menu-active');
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    document.addEventListener('wheel', preventBackgroundWheel, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('wheel', preventBackgroundWheel);
      document.documentElement.classList.remove('mobile-menu-active');
      document.body.classList.remove('mobile-menu-active');
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [shouldShiftForMobileMenu]);

  useEffect(() => {
    if (!user?.id) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    let cancelled = false;

    const claimExistingPushSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled || !sub) return;

        const subJson = sub.toJSON();
        await supabase.rpc('claim_push_subscription', {
          p_endpoint: subJson.endpoint || '',
          p_p256dh: subJson.keys?.p256dh || '',
          p_auth_key: subJson.keys?.auth || '',
        });
      } catch {
        // Push ownership sync is best-effort; the Profile toggle can surface errors.
      }
    };

    claimExistingPushSubscription();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'servesync:visibility-check') return;
      const visible = document.visibilityState === 'visible' && !document.hidden;
      event.ports?.[0]?.postMessage({
        type: 'servesync:visibility-response',
        visible,
        path: location.pathname,
      });
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#050505]">
      {user && !staticHideNav && (
        <Navigation
          hideMobile={hideNavMobile}
          hideMobileAll={isMessagesConversation}
          hideMobileHeader={isEventDetail}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          mobileChromeHidden={mobileChromeHidden}
        />
      )}

      <motion.main
        onWheelCapture={handlePageWheelCapture}
        animate={{
          marginLeft: 0,
          width: '100%',
          x: shouldShiftForMobileMenu ? 'min(82vw, 340px)' : 0,
          filter: shouldShiftForMobileMenu ? 'blur(1.25px) brightness(0.78)' : 'blur(0px) brightness(1)',
        }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className={`desktop-sidebar-main overflow-x-hidden ${isMessagesPage ? 'box-border flex flex-col min-h-[100dvh] overflow-hidden bg-white dark:bg-[#111013] lg:fixed lg:inset-0 lg:h-[100dvh]' : ''}`}
        style={mainStyle}
      >
        {isMessagesPage ? (
          <div className="flex flex-col flex-1 min-h-0 h-full">
            <Outlet />
          </div>
        ) : (
          <div
            className={
              staticHideNav
                ? ''
                : isWideShellPage
                  ? `wide-shell-spacing ${isDashboardPage ? 'dashboard-shell-spacing' : ''} ${isEventDetail ? 'event-detail-shell-spacing' : ''} bg-[#050505]`
                  : 'px-4 sm:px-6 lg:px-8 mobile-layout-padding'
            }
          >
            {!staticHideNav && !isWideShellPage && (
              <div className="max-w-7xl mx-auto pt-4 sm:pt-5">
                <BillingStatusBanner />
              </div>
            )}
            <div className={`relative ${isWideShellPage ? 'min-h-[calc(100dvh-(3.5rem+env(safe-area-inset-top)+64px+1rem))] lg:min-h-[calc(100dvh-4rem)]' : ''}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={location.pathname}
                  initial={isWideShellPage ? { opacity: 0 } : { opacity: 0, y: 10, filter: 'blur(6px)' }}
                  animate={
                    isWideShellPage
                      ? { opacity: 1, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }
                      : { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
                  }
                  exit={
                    isWideShellPage
                      ? { opacity: 0, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }
                      : { opacity: 0, y: -6, filter: 'blur(3px)', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }
                  }
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.main>
    </div>
  );
}
