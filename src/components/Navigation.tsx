import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  ListChecks,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Layers3,
  MessageCircle,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { PushNotificationSetting } from './PushNotificationSetting';
import {
  MOBILE_NAV_STYLE_CHANGE_EVENT,
  fetchMobileNavStylePreference,
  getDefaultMobileNavStyle,
  getStoredMobileNavStyle,
  saveMobileNavStylePreference,
  type MobileNavStyle,
} from '../lib/mobileNavPreference';
import { supabase } from '../lib/supabase';
import {
  HomeIcon, CalendarIcon, NewsIcon,
  LeaveIcon, ShieldNavIcon, MessageIcon,
} from './NavIcons';

type NavIcon = React.ComponentType<{ active?: boolean; className?: string; style?: React.CSSProperties }>;
type GlobalSearchKind = 'event' | 'song' | 'setlist' | 'person' | 'page';
interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  subtitle: string;
  path: string;
}
interface SearchAnchorRect {
  left: number;
  top: number;
  width: number;
}

interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
  tone?: string;
  badgeKey?: 'announcements' | 'events' | 'notifications' | 'pendingLeave' | 'messages';
  badgeColor?: 'red' | 'blue' | 'amber';
  exact?: boolean;
}

const SetsNavIcon: NavIcon = ({ className, style }) => <ListChecks className={className} style={style} />;
const LibraryNavIcon: NavIcon = ({ className, style }) => <Layers3 className={className} style={style} />;
const SwapsNavIcon: NavIcon = ({ className, style }) => <ArrowLeftRight className={className} style={style} />;
const TeamNavIcon: NavIcon = ({ className, style }) => <Users className={className} style={style} />;
const ConductNavIcon: NavIcon = ({ className, style }) => <AlertTriangle className={className} style={style} />;
const globalSearchTypeMeta: Record<GlobalSearchKind, { label: string; icon: LucideIcon; tone: string }> = {
  event: { label: 'Event', icon: Calendar, tone: 'text-emerald-300 bg-emerald-500/14' },
  song: { label: 'Song', icon: Music2, tone: 'text-sky-300 bg-sky-500/14' },
  setlist: { label: 'Set', icon: ListChecks, tone: 'text-violet-300 bg-violet-500/14' },
  person: { label: 'Person', icon: User, tone: 'text-amber-300 bg-amber-500/14' },
  page: { label: 'Page', icon: Layers3, tone: 'text-white/70 bg-white/[0.08]' },
};

const mobileNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue' },
  { path: '/library', label: 'Library', icon: LibraryNavIcon },
];

const sidebarMainItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: HomeIcon, exact: true, tone: 'from-emerald-500/85 via-green-900 to-black' },
  { path: '/events', label: 'Events', icon: CalendarIcon, badgeKey: 'events', badgeColor: 'red', tone: 'from-sky-500/85 via-blue-900 to-black' },
  { path: '/announcements', label: 'News', icon: NewsIcon, badgeKey: 'announcements', badgeColor: 'blue', tone: 'from-amber-500/85 via-zinc-800 to-black' },
  { path: '/messages', label: 'Chat', icon: MessageIcon, badgeKey: 'messages', badgeColor: 'red', tone: 'from-violet-500/85 via-indigo-900 to-black' },
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
  hideMobileAll?: boolean;
  hideMobileHeader?: boolean;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
  mobileChromeHidden?: boolean;
}

export function Navigation({ hideMobile, hideMobileAll, hideMobileHeader = false, collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange, mobileChromeHidden = false }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isLeader,
    isOrgAdmin,
    isPlatformOwner,
    canApproveLeave,
    canManageDiscipline,
    profile,
    signOut,
    savedAccounts,
    addSavedAccount,
    switchAccount,
    forgetSavedAccount,
  } = useAuth();
  const { toast } = useToast();
  const unread = useUnreadCounts();

  const [mobileNavStyle, setMobileNavStyle] = useState<MobileNavStyle>(getStoredMobileNavStyle);
  const [savingNavStyle, setSavingNavStyle] = useState(false);
  const [drawerPanel, setDrawerPanel] = useState<'menu' | 'settings'>('menu');
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [switchingAccountMeta, setSwitchingAccountMeta] = useState<{ id: string; name: string; email: string } | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccountEmail, setAddAccountEmail] = useState('');
  const [addAccountPassword, setAddAccountPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<GlobalSearchResult[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchAnchorRect, setGlobalSearchAnchorRect] = useState<SearchAnchorRect | null>(null);
  const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
  const mobileMenuScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSettingsScrollRef = useRef<HTMLDivElement | null>(null);
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchMobileInputRef = useRef<HTMLInputElement | null>(null);
  const globalSearchFormRef = useRef<HTMLFormElement | null>(null);
  const globalSearchDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuScrollTopRef = useRef(0);
  const mobileSettingsScrollTopRef = useRef(0);

  const isActive = useCallback((item: NavItem) => {
    if (item.path === '/library') {
      return ['/library', '/songs', '/sets'].some(p => location.pathname.startsWith(p));
    }
    if (item.path === '/more') {
      return ['/more', '/profile', '/notifications'].some(p => location.pathname.startsWith(p));
    }
    if (item.path === '/leadership/overview' || item.path === '/leadership/church') {
      return location.pathname.startsWith('/leadership');
    }
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  }, [location.pathname]);


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
    if (!user?.id) return;

    let cancelled = false;
    fetchMobileNavStylePreference(user.id).then((style) => {
      if (!cancelled && style) setMobileNavStyle(style);
    });

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!mobileOpen) setDrawerPanel('menu');
  }, [mobileOpen]);

  const handleNav = useCallback((path: string) => {
    navigate(path);
    onMobileOpenChange(false);
    setDesktopProfileOpen(false);
  }, [navigate, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) return;

    const target = drawerPanel === 'settings' ? mobileSettingsScrollRef.current : mobileMenuScrollRef.current;
    const savedTop = drawerPanel === 'settings' ? mobileSettingsScrollTopRef.current : mobileMenuScrollTopRef.current;

    if (!target) return;

    window.requestAnimationFrame(() => {
      if (target) target.scrollTop = savedTop;
    });
  }, [drawerPanel, mobileOpen]);


  const getBadgeCount = (item: NavItem) => {
    if (!item.badgeKey) return 0;
    if (item.badgeKey === 'announcements') return unread.announcements || 0;
    if (item.badgeKey === 'events') return unread.events || 0;
    if (item.badgeKey === 'pendingLeave') return unread.pendingLeave || 0;
    if (item.badgeKey === 'messages') return unread.messages || 0;
    return 0;
  };

  const updateGlobalSearchAnchor = useCallback(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      setGlobalSearchAnchorRect(null);
      return;
    }

    const rect = globalSearchFormRef.current?.getBoundingClientRect();
    if (!rect) {
      setGlobalSearchAnchorRect(null);
      return;
    }

    setGlobalSearchAnchorRect({
      left: Math.round(rect.left),
      top: Math.round(rect.bottom + 10),
      width: Math.round(rect.width),
    });
  }, []);

  const openGlobalSearch = useCallback(() => {
    updateGlobalSearchAnchor();
    setGlobalSearchOpen(true);
    window.setTimeout(() => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        globalSearchInputRef.current?.focus();
      } else {
        globalSearchMobileInputRef.current?.focus();
      }
    }, 0);
  }, [updateGlobalSearchAnchor]);

  const scheduleGlobalSearchOpen = useCallback(() => {
    window.setTimeout(openGlobalSearch, 0);
  }, [openGlobalSearch]);

  const closeGlobalSearch = useCallback(() => {
    setGlobalSearchOpen(false);
  }, []);

  const handleGlobalResultSelect = useCallback((result: GlobalSearchResult) => {
    setGlobalSearchOpen(false);
    setDesktopProfileOpen(false);
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
    handleNav(result.path);
  }, [handleNav]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setDesktopProfileOpen(false);
        openGlobalSearch();
      }
      if (event.key === 'Escape') {
        closeGlobalSearch();
        setDesktopProfileOpen(false);
      }
    };

    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, [closeGlobalSearch, openGlobalSearch]);

  useEffect(() => {
    if (!globalSearchOpen) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (globalSearchFormRef.current?.contains(target)) return;
      if (globalSearchDialogRef.current?.contains(target)) return;
      closeGlobalSearch();
    };

    updateGlobalSearchAnchor();
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    window.addEventListener('resize', updateGlobalSearchAnchor);
    window.addEventListener('scroll', updateGlobalSearchAnchor, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      window.removeEventListener('resize', updateGlobalSearchAnchor);
      window.removeEventListener('scroll', updateGlobalSearchAnchor, true);
    };
  }, [closeGlobalSearch, globalSearchOpen, updateGlobalSearchAnchor]);

  useEffect(() => {
    if (!globalSearchOpen) return;

    const query = globalSearchQuery.trim();
    if (query.length < 2) {
      setGlobalSearchLoading(false);
      setGlobalSearchResults([
        { id: 'page-events', kind: 'page', title: 'Events', subtitle: 'Schedule, create, and review services', path: '/events' },
        { id: 'page-songs', kind: 'page', title: 'Songs', subtitle: 'Chord charts and song library', path: '/songs' },
        { id: 'page-sets', kind: 'page', title: 'Sets', subtitle: 'Setlists and past worship sets', path: '/sets' },
        { id: 'page-team', kind: 'page', title: 'Team', subtitle: 'People, roles, and ministries', path: '/leadership/team' },
      ]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setGlobalSearchLoading(true);
      const pattern = `%${query}%`;
      const lowerQuery = query.toLowerCase();

      try {
        const [eventsRes, songsRes, profilesRes, setlistsRes] = await Promise.all([
          supabase
            .from('events')
            .select('id, title, event_type, event_date, start_time')
            .or(`title.ilike.${pattern},event_type.ilike.${pattern}`)
            .order('event_date', { ascending: false })
            .limit(6),
          supabase
            .from('songs')
            .select('id, title, artist, song_key')
            .or(`title.ilike.${pattern},artist.ilike.${pattern},song_key.ilike.${pattern}`)
            .order('title')
            .limit(6),
          supabase
            .from('profiles')
            .select('id, first_name, last_name, nickname')
            .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},nickname.ilike.${pattern}`)
            .order('first_name')
            .limit(6),
          supabase
            .from('setlists')
            .select('id, status, event_id, events(id, title, event_date)')
            .order('created_at', { ascending: false })
            .limit(40),
        ]);

        if (cancelled) return;

        const eventResults: GlobalSearchResult[] = ((eventsRes.data || []) as Array<{ id: string; title: string; event_type?: string | null; event_date?: string | null; start_time?: string | null }>)
          .map(event => ({
            id: `event-${event.id}`,
            kind: 'event',
            title: event.title,
            subtitle: [event.event_type, event.event_date].filter(Boolean).join(' · ') || 'Event',
            path: `/events/${event.id}`,
          }));

        const songResults: GlobalSearchResult[] = ((songsRes.data || []) as Array<{ id: string; title: string; artist?: string | null; song_key?: string | null }>)
          .map(song => ({
            id: `song-${song.id}`,
            kind: 'song',
            title: song.title,
            subtitle: [song.artist, song.song_key ? `Key ${song.song_key}` : ''].filter(Boolean).join(' · ') || 'Song library',
            path: `/songs?search=${encodeURIComponent(song.title)}`,
          }));

        const personResults: GlobalSearchResult[] = ((profilesRes.data || []) as Array<{ id: string; first_name?: string | null; last_name?: string | null; nickname?: string | null }>)
          .map(person => {
            const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.nickname || 'Team member';
            return {
              id: `person-${person.id}`,
              kind: 'person',
              title: name,
              subtitle: person.nickname ? `Nickname: ${person.nickname}` : 'Team member',
              path: `/leadership/team?search=${encodeURIComponent(name)}`,
            };
          });

        const setlistResults: GlobalSearchResult[] = ((setlistsRes.data || []) as Array<{ id: string; status?: string | null; event_id?: string | null; events?: { id?: string; title?: string | null; event_date?: string | null } | Array<{ id?: string; title?: string | null; event_date?: string | null }> | null }>)
          .map(setlist => {
            const event = Array.isArray(setlist.events) ? setlist.events[0] : setlist.events;
            return { setlist, event };
          })
          .filter(({ event }) => {
            const haystack = [event?.title, event?.event_date, 'setlist', 'set'].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(lowerQuery);
          })
          .slice(0, 6)
          .map(({ setlist, event }) => ({
            id: `setlist-${setlist.id}`,
            kind: 'setlist',
            title: event?.title || 'Untitled setlist',
            subtitle: [setlist.status, event?.event_date].filter(Boolean).join(' · ') || 'Setlist',
            path: event?.id ? `/events/${event.id}` : '/sets',
          }));

        setGlobalSearchResults([...eventResults, ...songResults, ...setlistResults, ...personResults].slice(0, 12));
      } finally {
        if (!cancelled) setGlobalSearchLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [globalSearchOpen, globalSearchQuery]);

  const leadershipHomePath = isOrgAdmin && !isLeader ? '/leadership/church' : '/leadership/overview';
  const sidebarManagementItems: NavItem[] = [
    {
      path: canApproveLeave ? '/leadership/leave' : '/request-leave',
      label: canApproveLeave ? 'Leave Queue' : 'Request Leave',
      icon: LeaveIcon,
      tone: 'from-orange-500/85 via-amber-900 to-black',
      ...(canApproveLeave ? { badgeKey: 'pendingLeave' as const, badgeColor: 'red' as const } : {}),
    },
    ...(isLeader
      ? [
          { path: '/leadership/setlists', label: 'Setlist Queue', icon: SetsNavIcon, tone: 'from-emerald-500/85 via-teal-900 to-black' },
          { path: '/leadership/swaps', label: 'Swap Requests', icon: SwapsNavIcon, tone: 'from-cyan-500/85 via-blue-900 to-black' },
        ]
      : []),
    ...(isLeader || isOrgAdmin
      ? [
          { path: leadershipHomePath, label: 'Leadership', icon: ShieldNavIcon, tone: 'from-indigo-500/85 via-violet-900 to-black' },
          { path: '/leadership/team', label: 'Team Roster', icon: TeamNavIcon, tone: 'from-fuchsia-500/80 via-slate-800 to-black' },
        ]
      : []),
    ...(isLeader || canManageDiscipline
      ? [{ path: '/leadership/discipline', label: 'Conduct', icon: ConductNavIcon, tone: 'from-red-500/85 via-rose-900 to-black' }]
      : []),
  ];
  const displayName = profile?.nickname || profile?.first_name || '';
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

  const useDockedMobileNav = mobileNavStyle === 'docked';
  const hideMobileChrome = mobileChromeHidden && !mobileOpen;
  const hideBottomMobileNav = hideMobileChrome;
  const mobileMenuTranslateX = mobileOpen ? 'translateX(min(82vw, 340px))' : 'translateX(0)';
  const mobileNavTransform = `${mobileMenuTranslateX} ${hideBottomMobileNav ? 'translateY(calc(100% + 10px))' : 'translateY(0)'}`;
  const mobileHeaderTransform = mobileMenuTranslateX;
  const mobileTitle = location.pathname.startsWith('/events')
    ? 'Events'
    : location.pathname.startsWith('/announcements')
      ? 'News'
      : ['/library', '/songs', '/sets'].some(path => location.pathname.startsWith(path))
        ? 'Library'
        : 'ServeSync';
  const desktopLibraryItems = [
    { title: 'Songs', caption: 'Charts & library', path: '/songs', tone: 'from-emerald-500/85 via-teal-800 to-black', icon: Music2 },
    { title: 'Sets', caption: 'Approved setlists', path: '/sets', tone: 'from-violet-500/85 via-indigo-800 to-black', icon: ListChecks },
    { title: 'Videos', caption: 'Training media', path: '/videos', tone: 'from-sky-500/85 via-cyan-900 to-black', icon: Video },
  ];
  const desktopShortcutItems = [
    { title: 'My Assignments', caption: 'Serving schedule', path: '/my-assignments', tone: 'from-emerald-500/85 via-green-900 to-black', icon: CheckCircle2 },
    { title: 'My Sets', caption: 'Created by me', path: '/sets?owner=me', tone: 'from-indigo-400 via-violet-700 to-black', icon: ListChecks },
    { title: 'Profile', caption: 'Account & details', path: '/profile', tone: 'from-zinc-300/75 via-zinc-700 to-black', icon: User },
  ];

  const sidebarWidth = collapsed ? 92 : 300;

  const handleMobileNavStyleChange = async (style: MobileNavStyle) => {
    if (!user?.id || style === mobileNavStyle || savingNavStyle) return;

    setSavingNavStyle(true);
    try {
      await saveMobileNavStylePreference(user.id, style);
      setMobileNavStyle(style);
      toast('success', `Navigation style set to ${style === 'floating' ? 'Floating' : 'Docked'}`);
    } catch {
      toast('error', 'Failed to save navigation style');
    } finally {
      setSavingNavStyle(false);
    }
  };

  const handleSwitchAccount = async (targetUserId: string) => {
    if (targetUserId === user?.id || switchingAccountId) return;

    const targetAccount = savedAccounts.find(account => account.userId === targetUserId);
    if (!targetAccount) {
      toast('error', 'Saved account not found');
      return;
    }

    setSwitchingAccountId(targetUserId);
    setSwitchingAccountMeta({
      id: targetAccount.userId,
      name: targetAccount.displayName,
      email: targetAccount.email,
    });

    const { error } = await switchAccount(targetUserId);
    if (error) {
      setSwitchingAccountId(null);
      setSwitchingAccountMeta(null);
      toast('error', error.message);
      return;
    }

    onMobileOpenChange(false);
    setDesktopProfileOpen(false);
    toast('success', 'Account switched');
    window.setTimeout(() => {
      setSwitchingAccountId(null);
      setSwitchingAccountMeta(null);
      navigate('/dashboard');
    }, 1500);
  };

  const handleForgetSavedAccount = (accountUserId: string) => {
    forgetSavedAccount(accountUserId);
    toast('info', 'Saved account removed from this device');
  };

  const handleAddAnotherAccount = () => {
    setAddAccountEmail('');
    setAddAccountPassword('');
    setShowAddPassword(false);
    setDesktopProfileOpen(false);
    setShowAddAccountModal(true);
  };

  const handleSaveAnotherAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAccountEmail.trim() || !addAccountPassword) return;

    setAddAccountLoading(true);
    const { error } = await addSavedAccount(addAccountEmail, addAccountPassword);
    setAddAccountLoading(false);

    if (error) {
      toast('error', error.message);
      return;
    }

    setShowAddAccountModal(false);
    setAddAccountEmail('');
    setAddAccountPassword('');
    setShowAddPassword(false);
    toast('success', 'Account saved on this device');
  };

  const baseProfileMenuItems: Array<{
    icon: LucideIcon;
    label: string;
    desc: string;
    path?: string;
    show: boolean;
    badge?: number;
    color: string;
    action?: () => void;
    keepDrawerOpen?: boolean;
  }> = [
    { icon: User, label: 'Profile', desc: 'Account and personal settings', path: '/profile', show: true, color: '#10b981' },
    { icon: Activity, label: 'Activity Log', desc: 'Church activity', path: '/activity-log', show: isPlatformOwner, color: '#0ea5e9' },
    { icon: BookOpen, label: 'Songs', desc: 'Song library and chord charts', path: '/songs', show: true, color: '#16a34a' },
    { icon: Video, label: 'Videos', desc: 'Training and reference videos', path: '/videos', show: true, color: '#0ea5e9' },
    { icon: ListChecks, label: 'Sets', desc: 'Past event sets', path: '/sets', show: true, color: '#10b981' },
    { icon: Calendar, label: 'Request Leave', desc: 'Submit unavailability', path: '/request-leave', show: true, color: '#f59e0b' },
  ];

  const leadershipMenuItems: typeof baseProfileMenuItems = [
    { icon: ListChecks, label: 'Approve Setlist', desc: 'Review submitted setlists', path: '/leadership/setlists', show: isLeader, badge: unread.pendingSetlists, color: '#16a34a' },
    { icon: Calendar, label: 'Approve Leave', desc: 'Review leave requests', path: '/leadership/leave', show: !!canApproveLeave, badge: unread.pendingLeave, color: '#f59e0b' },
    { icon: ArrowLeftRight, label: 'Approve Swaps', desc: 'Review swap requests', path: '/leadership/swaps', show: isLeader, badge: unread.pendingSwaps, color: '#0ea5e9' },
    { icon: AlertTriangle, label: 'Conduct', desc: 'Discipline and records', path: '/leadership/discipline', show: isLeader || !!canManageDiscipline, color: '#f97316' },
    { icon: Users, label: 'Team', desc: 'Manage team members', path: '/leadership/team', show: isLeader || isOrgAdmin, color: '#8b5cf6' },
  ].filter(item => item.show);

  const settingsMenuItem: typeof baseProfileMenuItems[number] = {
    icon: Settings,
    label: 'Settings',
    desc: 'Navigation, accounts, notifications',
    show: true,
    color: '#94a3b8',
    action: () => setDrawerPanel('settings'),
    keepDrawerOpen: true,
  };

  const primaryMenuItems = [
    ...baseProfileMenuItems.filter(item => item.show),
    settingsMenuItem,
  ];

  const openProfileMenuAction = (item: typeof primaryMenuItems[number]) => {
    if (item.action) {
      if (!item.keepDrawerOpen) onMobileOpenChange(false);
      item.action();
      return;
    }
    if (item.path) handleNav(item.path);
  };

  const renderNavItem = (item: NavItem, isCollapsed: boolean) => {
    const active = isActive(item);
    const Icon = item.icon;
    const badge = getBadgeCount(item);
    const iconTone = item.tone || 'from-zinc-300/75 via-zinc-700 to-black';

    if (isCollapsed) {
      return (
        <Tooltip key={item.path} label={item.label}>
          <button
            onClick={() => handleNav(item.path)}
            className={`group relative flex h-11 w-full items-center justify-center rounded-[0.8rem] border transition-all duration-200 ${
              active
                ? 'border-white/[0.10] bg-white/[0.10] text-white shadow-[0_14px_24px_-18px_rgba(0,0,0,0.85)]'
                : 'border-transparent text-white/58 hover:border-white/[0.08] hover:bg-white/[0.065] hover:text-white'
            }`}
          >
            {active && (
              <motion.div
                layoutId="activeNavBg"
                className="absolute inset-0 rounded-[0.8rem]"
                transition={{ type: 'spring', stiffness: 460, damping: 38 }}
              />
            )}
            <div className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[0.6rem] bg-gradient-to-br ${iconTone} shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]`}>
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),transparent_32%)]" />
              <Icon active={active} className="relative h-[17px] w-[17px] shrink-0 text-white/90" style={{ width: '17px', height: '17px', strokeWidth: 2.2 }} />
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
        className={`relative group flex h-12 w-full items-center gap-3 rounded-[0.8rem] border px-3.5 text-[13px] transition-all duration-200 ${
          active
            ? 'border-white/[0.10] bg-white/[0.10] font-bold text-white shadow-[0_16px_32px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)]'
            : 'border-transparent font-semibold text-white/62 hover:border-white/[0.08] hover:bg-white/[0.065] hover:text-white'
        }`}
      >
        {active && (
          <motion.div
            layoutId="activeNavBg"
            className="absolute inset-0 rounded-[0.8rem]"
            transition={{ type: 'spring', stiffness: 460, damping: 38 }}
          />
        )}
        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[0.55rem] bg-gradient-to-br ${iconTone} shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-transform group-hover:scale-[1.03]`}>
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),transparent_32%)]" />
          <Icon
            active={active}
            className="relative h-[17px] w-[17px] shrink-0 text-white/90"
            style={{ width: '17px', height: '17px', strokeWidth: 2.2 }}
          />
        </span>
        <span className="relative flex-1 truncate text-left">{item.label}</span>
        {badge > 0 && <SidebarBadge count={badge} color={item.badgeColor} />}
      </button>
    );
  };

  const renderMobileSettingsPanel = () => (
    <>
      <div className="border-b border-black/[0.06] px-4 pb-4 dark:border-white/[0.08]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.35rem)' }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerPanel('menu')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Back to menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-black leading-tight text-gray-900 dark:text-white">Settings</p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-gray-500 dark:text-gray-300">Navigation, accounts, notifications</p>
          </div>
          <button
            type="button"
            onClick={() => onMobileOpenChange(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={mobileSettingsScrollRef}
        data-mobile-menu-scroll
        onScroll={(event) => { mobileSettingsScrollTopRef.current = event.currentTarget.scrollTop; }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-action-pan-y px-3 py-3"
      >
        <div className="space-y-4">
          <section className="rounded-[1.55rem] border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Navigation Look</p>
              <h3 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-gray-900 dark:text-white">Choose bottom nav style.</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'floating', label: 'Floating', hint: 'iOS pill' },
                { id: 'docked', label: 'Docked', hint: 'Bottom bar' },
              ] as const).map(option => {
                const active = mobileNavStyle === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleMobileNavStyleChange(option.id)}
                    disabled={savingNavStyle}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? 'border-emerald-400/45 bg-emerald-400/[0.13] text-emerald-950 dark:text-white shadow-[0_0_30px_-20px_rgba(16,185,129,0.75)]'
                        : 'border-black/[0.08] bg-white/70 text-gray-700 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>
                        <span className="block text-[12px] font-black">{option.label}</span>
                        <span className="mt-0.5 block text-[10px] font-semibold text-gray-500 dark:text-gray-400">{option.hint}</span>
                      </span>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.12)]" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              Default on this device: {getDefaultMobileNavStyle() === 'floating' ? 'Floating' : 'Docked'}
            </p>
          </section>

          <section className="rounded-[1.55rem] border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Account Switcher</p>
                <h3 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-gray-900 dark:text-white">Saved on this device.</h3>
              </div>
              <button
                type="button"
                onClick={handleAddAnotherAccount}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_10px_22px_-12px_rgba(16,185,129,0.8)]"
                aria-label="Add account"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {savedAccounts.map(account => {
                const isCurrent = account.userId === user?.id;
                const isSwitching = switchingAccountId === account.userId;
                return (
                  <div
                    key={account.userId}
                    className="flex items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white/72 px-2.5 py-2.5 dark:border-white/[0.07] dark:bg-black/10"
                  >
                    <Avatar
                      src={account.avatarUrl}
                      firstName={account.displayName || account.email || '?'}
                      size="sm"
                      className="!h-9 !w-9 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-gray-900 dark:text-white">{account.displayName || 'Saved account'}</p>
                      <p className="truncate text-[10px] font-mono font-semibold text-gray-500 dark:text-gray-400">{account.email}</p>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-400/[0.13] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-200">
                        Current
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSwitchAccount(account.userId)}
                        disabled={isSwitching}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-emerald-400/[0.13] px-2.5 text-[10px] font-black text-emerald-800 transition-colors hover:bg-emerald-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-200"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSwitching ? 'animate-spin' : ''}`} />
                        Switch
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleForgetSavedAccount(account.userId)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-300"
                      aria-label="Forget saved account"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddAnotherAccount}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-white/70 text-[12px] font-black text-gray-700 transition-colors hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-gray-100 dark:hover:bg-white/[0.075]"
            >
              <Plus className="h-4 w-4" />
              Save another login
            </button>
          </section>

          <section>
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Device Alerts</p>
            <PushNotificationSetting surface="drawer" />
          </section>
        </div>
      </div>
    </>
  );

  return (
    <div className="dark contents">
      {/* ── Desktop top bar ── */}
      <div className="fixed inset-x-0 top-0 z-50 hidden h-[72px] items-center gap-4 bg-[#050505]/96 px-5 text-white backdrop-blur-2xl lg:flex">
        <button
          onClick={() => handleNav('/dashboard')}
          className="flex min-w-[170px] items-center gap-3 text-left"
          aria-label="Go to dashboard"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <img
              src="/generated/servesync-mark-dark.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 object-contain brightness-0 invert drop-shadow-[0_0_14px_rgba(255,255,255,0.14)]"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[18px] font-black leading-none">ServeSync</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.65rem] border border-white/[0.08] bg-white/[0.055] text-white/62 transition-colors hover:bg-white/[0.10] hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <button
          onClick={() => handleNav('/dashboard')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.65rem] border border-white/[0.08] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.13]"
          aria-label="Home"
        >
          <HomeIcon active className="h-5 w-5" />
        </button>

        <form
          ref={globalSearchFormRef}
          onSubmit={(event) => {
            event.preventDefault();
            if (globalSearchResults[0]) handleGlobalResultSelect(globalSearchResults[0]);
          }}
          className="flex h-11 max-w-[560px] flex-1 items-center gap-3 rounded-[0.65rem] border border-white/[0.10] bg-[#151515] px-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors focus-within:border-[#22c55e]/70 focus-within:bg-[#181818]"
        >
          <Search className="h-5 w-5 shrink-0 text-white/60" />
          <input
            ref={globalSearchInputRef}
            value={globalSearchQuery}
            onFocus={scheduleGlobalSearchOpen}
            onClick={scheduleGlobalSearchOpen}
            onChange={(event) => {
              setGlobalSearchQuery(event.target.value);
              setGlobalSearchOpen(true);
              updateGlobalSearchAnchor();
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/46"
            placeholder="Search events, songs, people, sets..."
            aria-label="Search events, songs, people, sets"
          />
          {globalSearchQuery ? (
            <button
              type="button"
              onClick={() => {
                setGlobalSearchQuery('');
                updateGlobalSearchAnchor();
                globalSearchInputRef.current?.focus();
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/42 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openGlobalSearch}
              className="rounded-md border border-white/[0.08] bg-white/[0.05] px-2 py-1 text-[11px] font-bold text-white/46 transition-colors hover:bg-white/[0.09] hover:text-white"
              aria-label="Open search"
            >
              ⌘ K
            </button>
          )}
        </form>

        <div className="ml-auto flex items-center gap-3">
          <button className="hidden h-11 items-center gap-2 rounded-[0.65rem] bg-white/[0.08] px-4 text-[13px] font-black text-white transition-colors hover:bg-white/[0.13] xl:flex">
            <Download className="h-4 w-4 text-[#22c55e]" />
            Install App
          </button>
          <NotificationBell />
          <button
            onClick={() => handleNav('/messages')}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08]"
            aria-label="Messages"
          >
            <MessageCircle className="h-6 w-6" />
            {unread.messages > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#22c55e]" />}
          </button>
          <button
            onClick={() => {
              setGlobalSearchOpen(false);
              setDesktopProfileOpen(open => !open);
            }}
            className={`flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-white/[0.08] ${desktopProfileOpen ? 'bg-white/[0.08]' : ''}`}
            aria-label="Open profile menu"
            aria-expanded={desktopProfileOpen}
          >
            <Avatar src={profile?.avatar_url} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" className="!h-11 !w-11 ring-1 ring-white/10" />
            <ChevronRight className={`h-4 w-4 text-white/70 transition-transform ${desktopProfileOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {desktopProfileOpen && (
          <>
            <motion.button
              aria-label="Close profile menu"
              className="fixed inset-0 z-[55] cursor-default bg-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={() => setDesktopProfileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.985 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-5 top-[4.55rem] z-[95] hidden w-[290px] overflow-hidden rounded-[0.9rem] border border-white/[0.10] bg-[#121212]/98 text-white shadow-[0_24px_80px_-34px_rgba(0,0,0,0.92)] backdrop-blur-2xl lg:block"
              role="menu"
              aria-label="Profile menu"
            >
              <div className="border-b border-white/[0.08] p-3">
                <div className="flex items-center gap-3 rounded-[0.75rem] bg-white/[0.045] p-2.5">
                  <Avatar
                    src={profile?.avatar_url}
                    firstName={profile?.first_name || '?'}
                    lastName={profile?.last_name}
                    size="sm"
                    className="ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black leading-tight text-white">{displayName || fullName || 'Profile'}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-white/42">{profile?.email}</p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={() => handleNav('/profile')}
                  className="group flex w-full items-center gap-3 rounded-[0.7rem] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]"
                  role="menuitem"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[0.65rem] bg-emerald-500/14 text-emerald-300">
                    <User className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-black text-white">Profile</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-white/42">Account and personal settings</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/28 transition-colors group-hover:text-white/72" />
                </button>

              </div>

              <div className="border-t border-white/[0.08] p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/34">Accounts</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-white/42">Switch without signing out</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAnotherAccount}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 transition-colors hover:bg-emerald-300"
                    aria-label="Save another login"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {savedAccounts.length === 0 ? (
                    <div className="rounded-[0.7rem] border border-white/[0.08] bg-white/[0.035] px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-white/55">No saved accounts yet.</p>
                      <button
                        type="button"
                        onClick={handleAddAnotherAccount}
                        className="mt-2 text-[11px] font-black text-emerald-300 transition-colors hover:text-emerald-200"
                      >
                        Save another login
                      </button>
                    </div>
                  ) : savedAccounts.map(account => {
                    const isCurrent = account.userId === user?.id;
                    const isSwitching = switchingAccountId === account.userId;
                    return (
                      <div
                        key={account.userId}
                        className="flex items-center gap-2 rounded-[0.7rem] px-2.5 py-2 transition-colors hover:bg-white/[0.05]"
                      >
                        <Avatar
                          src={account.avatarUrl}
                          firstName={account.displayName || account.email || '?'}
                          size="sm"
                          className="!h-8 !w-8 rounded-full ring-1 ring-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-black leading-tight text-white">{account.displayName || 'Saved account'}</p>
                          <p className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-white/38">{account.email}</p>
                        </div>
                        {isCurrent ? (
                          <span className="rounded-full bg-emerald-400/[0.13] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitchAccount(account.userId)}
                            disabled={isSwitching || switchingAccountId !== null}
                            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-emerald-400/[0.13] px-2.5 text-[10px] font-black text-emerald-200 transition-colors hover:bg-emerald-400/[0.20] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isSwitching ? 'animate-spin' : ''}`} />
                            Switch
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/[0.08] p-2">
                <button
                  type="button"
                  onClick={() => {
                    setDesktopProfileOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-3 rounded-[0.7rem] px-3 py-2.5 text-left text-red-300 transition-colors hover:bg-red-500/10"
                  role="menuitem"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[0.65rem] bg-red-500/10 text-red-300">
                    <LogOut className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[13px] font-black">Sign out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {globalSearchOpen && (
          <>
            <motion.button
              aria-label="Close search"
              className="fixed inset-x-0 bottom-0 top-0 z-[55] cursor-default bg-black/18 lg:top-[4.5rem]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={{ duration: 0.06 }}
              onPointerDown={closeGlobalSearch}
              onClick={closeGlobalSearch}
            />
            <motion.div
              ref={globalSearchDialogRef}
              initial={{ opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 0, scale: 1, transition: { duration: 0 } }}
              transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
              style={globalSearchAnchorRect ? {
                left: globalSearchAnchorRect.left,
                top: globalSearchAnchorRect.top,
                width: globalSearchAnchorRect.width,
              } : undefined}
              className="fixed left-1/2 top-[4.6rem] z-[90] w-[min(92vw,620px)] -translate-x-1/2 overflow-hidden rounded-[0.9rem] border border-white/[0.10] bg-[#121212]/98 text-white shadow-[0_24px_80px_-34px_rgba(0,0,0,0.92)] backdrop-blur-2xl lg:-translate-x-0"
              role="dialog"
              aria-label="Global search"
            >
              <div className="border-b border-white/[0.07] p-3 lg:hidden">
                <div className="flex h-11 items-center gap-3 rounded-[0.65rem] border border-white/[0.10] bg-[#181818] px-3">
                  <Search className="h-5 w-5 shrink-0 text-white/60" />
                  <input
                    ref={globalSearchMobileInputRef}
                    value={globalSearchQuery}
                    onChange={(event) => setGlobalSearchQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-white/42"
                    placeholder="Search events, songs, people, sets..."
                    aria-label="Search"
                  />
                  <button type="button" onClick={closeGlobalSearch} className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white" aria-label="Close search">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[min(68vh,540px)] overflow-y-auto p-2">
                <div className="flex items-center justify-between px-2 pb-2 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/36">
                    {globalSearchQuery.trim().length >= 2 ? 'Search results' : 'Quick search'}
                  </p>
                  {globalSearchLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#22c55e]" />}
                </div>

                {!globalSearchLoading && globalSearchResults.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Search className="mx-auto h-6 w-6 text-white/24" />
                    <p className="mt-3 text-[14px] font-black text-white">No results found</p>
                    <p className="mt-1 text-[12px] font-semibold text-white/42">Try a song title, service name, setlist, or team member.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {globalSearchResults.map((result) => {
                      const meta = globalSearchTypeMeta[result.kind];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => handleGlobalResultSelect(result)}
                          className="group flex w-full items-center gap-3 rounded-[0.7rem] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]"
                        >
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.65rem] ${meta.tone}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-black text-white">{result.title}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/42">{meta.label} · {result.subtitle}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/28 transition-colors group-hover:text-white/72" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile top bar ── */}
      <div
        className={`fixed top-0 left-0 right-0 z-30 flex items-end justify-between overflow-hidden px-4 lg:hidden ${hideMobileAll || hideMobileHeader ? 'hidden' : ''}`}
        style={{
          background: '#050505',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 14px 34px -30px rgba(0,0,0,0.85), inset 0 -1px 0 rgba(255,255,255,0.06)',
          top: '-1px',
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(3.5rem + env(safe-area-inset-top) + 1px)',
          transform: mobileHeaderTransform,
          filter: mobileOpen ? 'blur(1.25px) brightness(0.78)' : 'blur(0px) brightness(1)',
          transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 z-0 bg-[#050505]"
          style={{
            top: 'max(0px, calc(env(safe-area-inset-top) - 2px))',
            height: '4px',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
        <div className="relative flex h-14 w-full items-center justify-between gap-2 pb-0">
          <button
            onClick={() => {
              setDrawerPanel('menu');
              onMobileOpenChange(true);
            }}
            className="flex min-w-0 items-center gap-2 rounded-2xl px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
            aria-label="Open account menu"
          >
            <Avatar
              src={profile?.avatar_url}
              firstName={profile?.first_name || '?'}
              lastName={profile?.last_name}
              size="sm"
              className="!h-8 !w-8 !text-[11px] ring-1 ring-white/10"
            />
            <div className="min-w-0">
              <p className="truncate text-[20px] font-black leading-tight text-white">
                {mobileTitle}
              </p>
            </div>
          </button>

          <div className="relative z-20 flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => handleNav('/messages')} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08]" aria-label="Messages">
              <MessageCircle className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && !hideMobileAll && !hideMobileHeader && (
          <>
            <motion.button
              aria-label="Close account menu"
              className="fixed inset-0 z-[45] bg-black/42 backdrop-blur-[2px] backdrop-saturate-75 touch-action-none lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => onMobileOpenChange(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[70] w-[min(82vw,340px)] overflow-hidden touch-action-none bg-[#121212] text-white shadow-[24px_0_70px_-44px_rgba(0,0,0,0.9)] lg:hidden"
              style={{ overscrollBehaviorY: 'none' }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex h-full min-h-0 flex-col">
                {drawerPanel === 'settings' ? (
                  renderMobileSettingsPanel()
                ) : (
                  <>
                    <div className="border-b border-black/[0.06] px-5 pb-5 dark:border-white/[0.08]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.6rem)' }}>
                      <div className="flex items-center gap-4">
                        <Avatar
                          src={profile?.avatar_url}
                          firstName={profile?.first_name || '?'}
                          lastName={profile?.last_name}
                          size="md"
                          className="!h-16 !w-16 !text-2xl rounded-full ring-1 ring-black/10 dark:ring-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[21px] font-black leading-tight text-gray-900 dark:text-white">{displayName || fullName || 'Profile'}</p>
                          <button
                            onClick={() => handleNav('/profile')}
                            className="mt-1 text-left text-[14px] font-semibold text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                          >
                            View profile
                          </button>
                        </div>
                        <button
                          onClick={() => onMobileOpenChange(false)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                          aria-label="Close menu"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={mobileMenuScrollRef}
                      data-mobile-menu-scroll
                      onScroll={(event) => { mobileMenuScrollTopRef.current = event.currentTarget.scrollTop; }}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-action-pan-y px-3 py-3"
                    >
                      {primaryMenuItems.filter(item => item.label !== 'Profile').map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.path || item.label}
                            onClick={() => openProfileMenuAction(item)}
                            className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.055]"
                          >
                            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center text-gray-900 dark:text-white">
                              <Icon className="h-5 w-5" />
                              {!!item.badge && item.badge > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white">
                                  {item.badge > 9 ? '9+' : item.badge}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px] font-bold text-gray-900 dark:text-white">{item.label}</span>
                              <span className="mt-0.5 block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-300">{item.desc}</span>
                            </span>
                            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-400 transition-colors group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-200" />
                          </button>
                        );
                      })}

                      {leadershipMenuItems.length > 0 && (
                        <div className="pt-3">
                          <div className="px-3 pb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-400">Leadership</p>
                          </div>
                          {leadershipMenuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.path || item.label}
                                onClick={() => openProfileMenuAction(item)}
                                className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.055]"
                              >
                                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center text-gray-900 dark:text-white">
                                  <Icon className="h-5 w-5" />
                                  {!!item.badge && item.badge > 0 && (
                                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white">
                                      {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[16px] font-bold text-gray-900 dark:text-white">{item.label}</span>
                                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-300">{item.desc}</span>
                                </span>
                                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-400 transition-colors group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-200" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-black/[0.06] px-3 pb-3 pt-3 dark:border-white/[0.08]">
                      <button
                        onClick={() => {
                          onMobileOpenChange(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left text-red-500 transition-colors hover:bg-red-500/10 dark:text-red-400"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                          <LogOut className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1 text-[16px] font-bold">Sign out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-0 left-0 top-[72px] z-40 hidden flex-col border-r border-white/[0.08] bg-[#050505] lg:flex"
        style={{ overflow: 'visible' }}
      >
        <div
          className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_0%_0%,rgba(34,197,94,0.12),transparent_32%),linear-gradient(180deg,#07110b_0%,#050505_28%,#050505_100%)]"
          style={{
            WebkitBackdropFilter: 'blur(24px) saturate(145%)',
            backdropFilter: 'blur(24px) saturate(145%)',
          }}
        >
          <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-2 pb-2 pt-5' : 'px-4 pb-3 pt-5'} scrollbar-thin`}>
            {!collapsed && (
              <p className="px-2.5 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/36">Main</p>
            )}
            {collapsed && <div className="pt-1" />}

            <div className="space-y-1.5">
              {sidebarMainItems.map(item => renderNavItem(item, collapsed))}
            </div>

            {!collapsed && (
              <>
                <div className="mt-5 border-t border-white/[0.08] pt-4">
                  <div className="mb-2 px-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/36">Ministry Library</p>
                  </div>
                  <div className="space-y-1.5">
                    {desktopLibraryItems.map((entry) => (
                      <button
                        key={entry.title}
                        onClick={() => handleNav(entry.path)}
                        className="group flex w-full items-center gap-3 rounded-[0.7rem] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.065]"
                      >
                        <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.35rem] bg-gradient-to-br ${entry.tone}`}>
                          <span className="block h-full w-full bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.30),transparent_28%)]" />
                          <entry.icon className="absolute h-[18px] w-[18px] text-white/88" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold leading-tight text-white">{entry.title}</span>
                          <span className="mt-0.5 block truncate text-[11px] font-semibold leading-tight text-white/45">{entry.caption}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[0.08] pt-4">
                  <div className="mb-2 px-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/36">My Shortcuts</p>
                  </div>
                  <div className="space-y-1.5">
                    {desktopShortcutItems.map((entry) => (
                      <button
                        key={entry.title}
                        onClick={() => handleNav(entry.path)}
                        className="group flex w-full items-center gap-3 rounded-[0.7rem] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.065]"
                      >
                        <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.35rem] bg-gradient-to-br ${entry.tone}`}>
                          <span className="block h-full w-full bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.35),transparent_28%)]" />
                          <entry.icon className="absolute h-[18px] w-[18px] text-white/88" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold leading-tight text-white">{entry.title}</span>
                          <span className="mt-0.5 block truncate text-[11px] font-semibold leading-tight text-white/45">{entry.caption}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {sidebarManagementItems.length > 0 && (
              <div className="mt-5">
                {!collapsed && (
                  <div className="mb-2 px-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/36">Management</p>
                  </div>
                )}
                {collapsed && <div className="h-3" />}
                <div className="space-y-1.5">
                  {sidebarManagementItems.map(item => renderNavItem(item, collapsed))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Mobile bottom nav ── */}
      {!hideMobile && !hideMobileAll && (
        <div
          data-mobile-nav="true"
          className={`fixed bottom-0 left-0 right-0 overflow-hidden lg:hidden ${mobileOpen ? 'z-30' : 'z-50'} ${useDockedMobileNav ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            paddingBottom: useDockedMobileNav ? '0px' : 'max(0px, calc(env(safe-area-inset-bottom) - 6px))',
            paddingTop: useDockedMobileNav ? '0px' : '6px',
            background: useDockedMobileNav ? 'rgba(5,5,5,0.96)' : 'transparent',
            WebkitBackdropFilter: useDockedMobileNav ? 'blur(18px) saturate(160%) contrast(104%)' : undefined,
            backdropFilter: useDockedMobileNav ? 'blur(18px) saturate(160%) contrast(104%)' : undefined,
            borderTop: useDockedMobileNav ? '1px solid rgba(255,255,255,0.08)' : undefined,
            boxShadow: useDockedMobileNav ? '0 -18px 42px -34px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)' : undefined,
            transform: mobileNavTransform,
            filter: mobileOpen ? 'blur(1.25px) brightness(0.78)' : 'blur(0px) brightness(1)',
            opacity: hideBottomMobileNav ? 0 : 1,
            pointerEvents: hideMobileChrome ? 'none' : undefined,
            transition: 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), filter 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform, opacity',
          }}
        >
          <motion.div
            initial={false}
            animate={{
              y: hideMobileChrome ? 128 : 0,
              scale: hideMobileChrome ? 0.92 : 1,
              opacity: hideMobileChrome ? 0 : 1,
            }}
            transition={{
              y: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
            }}
            style={{ transformOrigin: 'center bottom', willChange: 'transform, opacity' }}
            className={`relative flex ${useDockedMobileNav ? 'justify-stretch px-0' : 'justify-center px-8'}`}
          >
            <nav
              className={`pointer-events-auto relative flex ${useDockedMobileNav ? 'w-full items-start overflow-visible px-2 pt-2' : 'w-full max-w-[480px] items-center overflow-hidden bg-[#080808]/92 p-1.5 rounded-full'}`}
              style={{
                height: useDockedMobileNav ? 'calc(64px + env(safe-area-inset-bottom))' : undefined,
                background: useDockedMobileNav ? 'transparent' : 'rgba(8,8,8,0.96)',
                WebkitBackdropFilter: useDockedMobileNav ? undefined : 'blur(26px) saturate(190%) contrast(108%)',
                backdropFilter: useDockedMobileNav ? undefined : 'blur(26px) saturate(190%) contrast(108%)',
                border: useDockedMobileNav ? undefined : '1px solid rgba(255,255,255,0.18)',
                boxShadow: useDockedMobileNav
                  ? 'none'
                  : '0 18px 44px -18px rgba(0,0,0,0.92), 0 8px 18px -10px rgba(0,0,0,0.78), inset 0 1px 0 rgba(255,255,255,0.16)',
                paddingBottom: useDockedMobileNav ? 'env(safe-area-inset-bottom)' : undefined,
              }}
            >
              {!useDockedMobileNav && (
                <>
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015))]" />
                  <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/26 to-transparent" />
                </>
              )}

              {mobileNavItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const badge = getBadgeCount(item);
                const navItemColor = active ? 'var(--mobile-nav-active-color)' : 'var(--mobile-nav-inactive-color)';
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    data-mobile-nav-item="true"
                    data-active={active ? 'true' : 'false'}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex flex-1 min-w-[44px] flex-col items-center justify-center gap-0.5 ${useDockedMobileNav ? 'h-[56px] pt-1' : 'h-12'}`}
                    style={{ WebkitTapHighlightColor: 'transparent', color: navItemColor }}
                  >
                    {active && !useDockedMobileNav && (
                      <motion.div
                        layoutId="mobileNavIndicator"
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background: 'var(--nav-indicator)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                      />
                    )}
                    <div className="relative">
                      <Icon
                        active={active}
                        className="transition-colors duration-200"
                      />
                      <MobileBadge count={badge} color={item.badgeColor} />
                    </div>
                    <span
                      className={`relative max-w-[4.25rem] truncate font-black leading-none transition-colors ${
                        useDockedMobileNav ? 'text-[10px]' : 'text-[9px]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </motion.div>
        </div>
      )}

      <Modal
        open={showAddAccountModal}
        onClose={() => { if (!addAccountLoading) setShowAddAccountModal(false); }}
        title="Save Account"
        size="md"
        closeOnBackdrop={!addAccountLoading}
        bodyClassName="px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-[24px] font-black tracking-[-0.03em] text-gray-900 dark:text-white">
              Add another login to Settings.
            </h3>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-gray-500 dark:text-gray-300">
              Enter the second account once. It will be saved on this device so you can switch from the avatar menu anytime.
            </p>
          </div>

          <form onSubmit={handleSaveAnotherAccount} className="space-y-4">
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-emerald-900 dark:text-emerald-200">Your current account stays active.</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/75 dark:text-emerald-200/75">
                    This only stores the other account on this device. It does not log you out of the one you are using now.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Email address
              </label>
              <input
                type="email"
                value={addAccountEmail}
                onChange={e => setAddAccountEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px] text-gray-900 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showAddPassword ? 'text' : 'password'}
                  value={addAccountPassword}
                  onChange={e => setAddAccountPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 text-[14px] text-gray-900 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                  placeholder="Enter the account password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-white"
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={addAccountLoading || !addAccountEmail.trim() || !addAccountPassword}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[13px] font-black text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.55)] transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {addAccountLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save account on this device
                </>
              )}
            </button>
          </form>
        </div>
      </Modal>

      <AnimatePresence>
        {switchingAccountMeta && (
          <motion.div
            key={switchingAccountMeta.id}
            className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-[#0c0f0d] px-6 text-center text-white"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 1.01 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative w-full max-w-sm">
              <motion.div
                aria-hidden="true"
                className="absolute left-1/2 top-6 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
                animate={{ scale: [0.86, 1.16, 0.98], opacity: [0.18, 0.5, 0.26] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border border-emerald-500/15"
                  animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.36, 0.7, 0.36] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-4 rounded-full border border-dashed border-emerald-300/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute -left-2 top-[3.3rem] flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-400/15 bg-white/[0.08] text-emerald-200"
                  animate={{ y: [0, -8, 0], opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Layers3 className="h-4 w-4" />
                </motion.div>
                <motion.div
                  aria-hidden="true"
                  className="absolute -right-2 top-[3.3rem] flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-400/15 bg-white/[0.08] text-emerald-200"
                  animate={{ y: [0, 8, 0], opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div>
                <motion.div
                  className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 text-white shadow-2xl shadow-emerald-600/30"
                  animate={{ y: [0, -7, 0], rotate: [0, -1.5, 1.5, 0], borderRadius: ['2rem', '2.35rem', '2rem'] }}
                  transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_42%,rgba(255,255,255,0.1))]"
                    animate={{ opacity: [0.28, 0.72, 0.36] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <RefreshCw className="relative h-9 w-9" />
                </motion.div>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
                Switching Account
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
                Moving into {switchingAccountMeta.name}.
              </h2>
              <p className="mx-auto mt-3 max-w-[18rem] text-sm font-semibold leading-relaxed text-white/70">
                Loading profile, roles, and live data for
                <span className="block">{switchingAccountMeta.email}.</span>
              </p>

              <div className="relative mt-6 h-4 overflow-hidden rounded-full bg-white/10 p-1">
                <motion.div
                  className="relative h-full w-full origin-left overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.35, ease: 'linear' }}
                >
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-20 rounded-full bg-white/45 blur-sm"
                    initial={{ x: '-120%' }}
                    animate={{ x: ['-120%', '620%'] }}
                    transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
