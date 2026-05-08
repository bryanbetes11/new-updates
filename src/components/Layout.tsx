import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navigation } from './Navigation';
import { useAuth } from '../contexts/AuthContext';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const staticHideNav = ['/', '/login', '/register', '/onboarding'].includes(location.pathname);
  const isAnnouncementDetail = /^\/announcements\/[^/]+$/.test(location.pathname);
  const hideNavMobile = staticHideNav || isAnnouncementDetail;

  const sidebarWidth = collapsed ? 72 : 256;
  const applyOffset = isDesktop && user && !staticHideNav;

  return (
    <div className="min-h-screen">
      {user && !staticHideNav && (
        <Navigation
          hideMobile={hideNavMobile}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
        />
      )}

      <motion.main
        animate={{
          marginLeft: applyOffset ? sidebarWidth : 0,
          width: applyOffset ? `calc(100vw - ${sidebarWidth}px)` : '100vw',
        }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-x-hidden"
      >
        <div className={staticHideNav ? '' : 'px-4 sm:px-6 lg:px-8 mobile-layout-padding'}>
          <div key={location.pathname} className="animate-page-enter">
            <Outlet />
          </div>
        </div>
      </motion.main>
    </div>
  );
}
