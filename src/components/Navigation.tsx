import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronLeft, ChevronRight, Music2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './Avatar';
import {
  MOBILE_NAV_STYLE_CHANGE_EVENT,
  fetchMobileNavStylePreference,
  getStoredMobileNavStyle,
  type MobileNavStyle,
} from '../lib/mobileNavPreference';
import {
  HomeIcon, CalendarIcon, NewsIcon, MediaIcon, MoreIcon,
  LeaveIcon, ShieldNavIcon,
} from './NavIcons';

type NavIcon = React.ComponentType<{ active?: boolean; className?: string }>;

interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
  badgeKey?: 'announcements' | 'events' | 'notifications' | 'pendingLeave';
  badgeColor?: 'red' | 'blue' | 'amber';
  exact?: boolean;
}

const mobileNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/library', label: 'Library', icon: MediaIcon },
  { path: '/more', label: 'More', icon: MoreIcon, badgeKey: 'pendingLeave', badgeColor: 'amber' },
];

const sidebarMainItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/library', label: 'Library', icon: MediaIcon },
];

function MobileBadge({ count, color }: { count: number; color?: 'red' | 'blue' | 'amber' }) {
  if (count <= 0) return null;
  const bg = color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full ${bg} text-white text-[9px] font-bold leading-none shadow-sm`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

function SidebarBadge({ count, color }: { count: number; color?: 'red' | 'blue' | 'amber' }) {
  if (count <= 0) return null;
  const bg = color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full ${bg} text-white text-[10px] font-bold leading-none`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg pointer-events-none"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NavigationProps {
  hideMobile?: boolean;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
}

export function Navigation({ hideMobile, collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLeader, isOrgAdmin, canApproveLeave, canManageDiscipline, profile, signOut } = useAuth();
  const unread = useUnreadCounts();

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [mobileNavStyle, setMobileNavStyle] = useState<MobileNavStyle>(getStoredMobileNavStyle);

  const isActive = useCallback((item: NavItem) => {
    if (item.path === '/more') {
      return ['/more', '/profile', '/notifications'].some(p => location.pathname.startsWith(p));
    }
    if (item.path === '/leadership/overview' || item.path === '/leadership/church') {
      return location.pathname.startsWith('/leadership');
    }
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }, [location.pathname]);

  const activeIndex = mobileNavItems.findIndex(item => isActive(item));

  const updateIndicator = useCallback(() => {
    const idx = activeIndex >= 0 ? activeIndex : 0;
    const el = itemRefs.current[idx];
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicatorStyle({ left: elRect.left - parentRect.left, width: elRect.width });
  }, [activeIndex]);

  useEffect(() => {
    const timer = setTimeout(() => { setMounted(true); updateIndicator(); }, 50);
    return () => clearTimeout(timer);
  }, [updateIndicator]);

  useEffect(() => {
    const handleStyleChange = () => setMobileNavStyle(getStoredMobileNavStyle());
    window.addEventListener(MOBILE_NAV_STYLE_CHANGE_EVENT, handleStyleChange as EventListener);
    window.addEventListener('storage', handleStyleChange);
    return () => {
      window.removeEventListener(MOBILE_NAV_STYLE_CHANGE_EVENT, handleStyleChange as EventListener);
      window.removeEventListener('storage', handleStyleChange);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;
    fetchMobileNavStylePreference(profile.id).then((style) => {
      if (!cancelled && style) setMobileNavStyle(style);
    });

    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => { if (mounted) updateIndicator(); }, [location.pathname, mounted, updateIndicator]);
  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const getBadgeCount = (item: NavItem) => {
    if (!item.badgeKey) return 0;
    if (item.badgeKey === 'announcements') return unread.announcements || 0;
    if (item.badgeKey === 'events') return unread.events || 0;
    if (item.badgeKey === 'pendingLeave') return unread.pendingLeave || 0;
    return 0;
  };

  const sidebarManagementItems: NavItem[] = [
    { path: '/request-leave', label: 'Request Leave', icon: LeaveIcon },
    ...(isLeader || isOrgAdmin || canApproveLeave || canManageDiscipline
      ? [{ path: isOrgAdmin && !isLeader ? '/leadership/church' : '/leadership/overview', label: isOrgAdmin && !isLeader ? 'Church' : 'Leadership', icon: ShieldNavIcon, badgeKey: 'pendingLeave' as const, badgeColor: 'amber' as const }]
      : []),
  ];

  const displayName = profile?.nickname || profile?.first_name || '';
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const useDockedMobileNav = mobileNavStyle === 'docked';

  const sidebarWidth = collapsed ? 72 : 256;

  const handleNav = (path: string) => {
    navigate(path);
    onMobileOpenChange(false);
  };

  const renderNavItem = (item: NavItem, isCollapsed: boolean) => {
    const active = isActive(item);
    const Icon = item.icon;
    const badge = getBadgeCount(item);

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} label={item.label}>
          <button
            onClick={() => handleNav(item.path)}
            className={`relative flex h-9 w-full items-center justify-center rounded-xl transition-all duration-150 ${
              active
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {active && (
              <motion.div
                layoutId="activeNavBg"
                className="absolute inset-0 rounded-xl bg-brand-600/10 dark:bg-brand-400/10"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <div className="relative">
              <Icon active={active} className="h-[17px] w-[17px] shrink-0" style={{ width: '17px', height: '17px' }} />
              {badge > 0 && (
                <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full text-white text-[8px] font-bold leading-none ${item.badgeColor === 'blue' ? 'bg-blue-500' : item.badgeColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
          </button>
        </Tooltip>
      );
    }

    return (
      <button
        key={item.path}
        onClick={() => handleNav(item.path)}
        className={`relative group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
          active
            ? 'text-gray-900 dark:text-white font-semibold'
            : 'text-gray-500 dark:text-gray-400 font-medium hover:bg-black/[0.035] dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-100'
        }`}
      >
        {active && (
          <motion.div
            layoutId="activeNavBg"
            className="absolute inset-0 rounded-xl border border-emerald-500/20 dark:border-emerald-400/20"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.04) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(16,185,129,0.06)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}
        {active && (
          <span
            className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-emerald-500 dark:bg-emerald-400"
            style={{ boxShadow: '0 0 6px rgba(16,185,129,0.6)' }}
          />
        )}
        <Icon
          active={active}
          className={`relative shrink-0 h-[17px] w-[17px] transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
          style={{ width: '17px', height: '17px', strokeWidth: 2 }}
        />
        <span className="relative flex-1 text-left truncate" style={{ letterSpacing: '-0.01em' }}>{item.label}</span>
        {badge > 0 && <SidebarBadge count={badge} color={item.badgeColor} />}
      </button>
    );
  };

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div
        className="fixed top-0 left-0 right-0 z-30 flex items-end justify-between px-4 lg:hidden"
        style={{
          background: 'var(--sidebar-bg)',
          WebkitBackdropFilter: 'blur(20px)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--sidebar-border)',
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(3.5rem + env(safe-area-inset-top))',
        }}
      >
        <div className="flex items-center justify-between w-full h-14 pb-0">
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-[22%] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            <Music2 className="text-emerald-400" style={{ width: '14px', height: '14px' }} />
          </div>
          <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight">ServeSync</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
        </div>
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => onMobileOpenChange(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 bottom-0 z-40 w-[280px] flex flex-col lg:hidden"
            style={{
              background: 'var(--sidebar-bg)',
              WebkitBackdropFilter: 'blur(24px)',
              backdropFilter: 'blur(24px)',
              borderRight: '1px solid var(--sidebar-border)',
            }}
          >
            {/* Mobile sidebar header */}
            <div className="h-14 flex items-center gap-2.5 px-4 shrink-0">
              <div
                className="h-8 w-8 rounded-[22%] flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Music2 className="text-emerald-400" style={{ width: '16px', height: '16px' }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">ServeSync</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Team Management</p>
              </div>
            </div>

            {/* Mobile nav items */}
            <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Main</p>
              {sidebarMainItems.map(item => renderNavItem(item, false))}

              {sidebarManagementItems.length > 0 && (
                <>
                  <p className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Management</p>
                  {sidebarManagementItems.map(item => renderNavItem(item, false))}
                </>
              )}
            </div>

            {/* Mobile footer */}
            <div className="shrink-0 px-2 pt-2 pb-2 space-y-1.5">
              <button
                onClick={() => handleNav('/profile')}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
              >
                <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight">{displayName || fullName}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight mt-px">{profile?.email}</p>
                </div>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex fixed left-0 top-0 h-screen z-40 flex-col p-3"
        style={{ overflow: 'visible' }}
      >
        {/* Inner card */}
        <div
          className="flex flex-col h-full rounded-2xl overflow-hidden"
          style={{
            background: 'var(--sidebar-bg)',
            WebkitBackdropFilter: 'blur(24px)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--sidebar-border)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.1), 0 4px 16px -4px rgba(0,0,0,0.06)',
          }}
        >
          {/* Brand header */}
          <div
            className={`h-[58px] flex shrink-0 ${collapsed ? 'flex-col items-center justify-center gap-1.5 py-3 px-2' : 'flex-row items-center gap-2.5 px-3.5'}`}
          >
            <div
              className="shrink-0 rounded-[22%] flex items-center justify-center"
              style={{
                width: '22px',
                height: '22px',
                background: 'linear-gradient(145deg, #1e2a1e 0%, #0d1a0d 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}
            >
              <Music2 className="text-emerald-400" style={{ width: '12px', height: '12px' }} />
            </div>

            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight truncate">ServeSync</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-px truncate">Team Management</p>
              </motion.div>
            )}

            {!collapsed && (
              <button
                onClick={() => onCollapsedChange(true)}
                className="ml-auto h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {collapsed && (
              <button
                onClick={() => onCollapsedChange(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Main nav */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
            {!collapsed && (
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Main</p>
            )}
            {collapsed && <div className="pt-1" />}

            {sidebarMainItems.map(item => renderNavItem(item, collapsed))}

            {sidebarManagementItems.length > 0 && (
              <>
                {!collapsed && (
                  <p className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Management</p>
                )}
                {collapsed && <div className="h-3" />}
                {sidebarManagementItems.map(item => renderNavItem(item, collapsed))}
              </>
            )}
          </div>

          {/* Footer / user profile */}
          <div className="shrink-0 px-2 pt-2 pb-2 space-y-1.5">
            {!collapsed ? (
              <>
                <div className="flex items-center gap-1 px-1 pb-0.5">
                  <ThemeToggle />
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />
                  <NotificationBell />
                </div>

                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors group"
                >
                  <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.02em' }}>
                      {displayName || fullName}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight mt-px">{profile?.email}</p>
                  </div>
                </button>

                <button
                  onClick={signOut}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Tooltip label="Theme">
                  <div className="flex justify-center w-full">
                    <ThemeToggle />
                  </div>
                </Tooltip>
                <Tooltip label="Notifications">
                  <div className="flex justify-center w-full">
                    <NotificationBell />
                  </div>
                </Tooltip>
                <Tooltip label={displayName || fullName || 'Profile'}>
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex h-9 w-full items-center justify-center rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
                  </button>
                </Tooltip>
                <Tooltip label="Sign out">
                  <button
                    onClick={signOut}
                    className="flex h-9 w-full items-center justify-center rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Mobile bottom nav ── */}
      {!hideMobile && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden ${useDockedMobileNav ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            paddingBottom: useDockedMobileNav ? '0px' : 'max(0px, calc(env(safe-area-inset-bottom) - 6px))',
            paddingTop: useDockedMobileNav ? '0px' : '6px',
            background: useDockedMobileNav ? 'var(--sidebar-bg)' : undefined,
            WebkitBackdropFilter: useDockedMobileNav ? 'blur(28px) saturate(180%)' : undefined,
            backdropFilter: useDockedMobileNav ? 'blur(28px) saturate(180%)' : undefined,
            borderTop: useDockedMobileNav ? '1px solid var(--sidebar-border)' : undefined,
            boxShadow: useDockedMobileNav ? '0 -10px 26px -24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)' : undefined,
          }}
        >
          <div className={`flex ${useDockedMobileNav ? 'justify-stretch px-0' : 'justify-center px-4'}`}>
            <nav
              className={`pointer-events-auto relative flex w-full ${useDockedMobileNav ? 'items-start overflow-visible px-2 pt-2' : 'items-center overflow-hidden p-1.5 rounded-full'}`}
              style={{
                height: useDockedMobileNav ? 'calc(64px + env(safe-area-inset-bottom))' : undefined,
                background: useDockedMobileNav ? 'var(--sidebar-bg)' : 'var(--nav-bg)',
                WebkitBackdropFilter: useDockedMobileNav ? undefined : 'blur(28px) saturate(180%)',
                backdropFilter: useDockedMobileNav ? undefined : 'blur(28px) saturate(180%)',
                border: useDockedMobileNav ? undefined : '1px solid var(--nav-border)',
                boxShadow: useDockedMobileNav
                  ? 'none'
                  : '0 12px 36px -8px rgba(0,0,0,0.22), 0 2px 8px -2px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
                paddingBottom: useDockedMobileNav ? 'env(safe-area-inset-bottom)' : undefined,
              }}
            >
              {mounted && !useDockedMobileNav && (
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-full pointer-events-none"
                  style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                    background: 'var(--nav-indicator)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                    transition: 'left 360ms cubic-bezier(0.22,1,0.36,1), width 360ms cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
              )}

              {mobileNavItems.map((item, idx) => {
                const active = isActive(item);
                const Icon = item.icon;
                const badge = getBadgeCount(item);
                return (
                  <button
                    key={item.path}
                    ref={el => { itemRefs.current[idx] = el; }}
                    onClick={() => navigate(item.path)}
                    className={`relative flex flex-1 items-center justify-center min-w-[44px] ${useDockedMobileNav ? 'h-[56px]' : 'h-12'}`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {useDockedMobileNav && active && (
                      <span
                        className="absolute left-1/2 top-1 h-[3px] w-8 -translate-x-1/2 rounded-full bg-brand-600 dark:bg-brand-400"
                        style={{ boxShadow: '0 0 10px rgba(16,185,129,0.28)' }}
                      />
                    )}
                    <div className="relative">
                      <Icon
                        active={active}
                        className={`transition-colors duration-200 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-black/50 dark:text-white/55'}`}
                      />
                      <MobileBadge count={badge} color={item.badgeColor} />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
