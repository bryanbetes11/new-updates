/* eslint-disable react-refresh/only-export-components -- The provider and its companion hook intentionally share this context module. */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { createAccessRefreshQueue } from '../lib/accessRefresh';
import { createTransientSupabaseClient, supabase } from '../lib/supabase';
import { readSavedAccounts, removeSavedAccount, upsertSavedAccount, type SavedAccount } from '../lib/savedAccounts';
import type { Organization, Profile, Role, UserRole } from '../types';
import { androidPushAvailable, disconnectNativePush } from '../lib/nativePush';
import { deviceCacheScope, setDeviceCacheScope } from '../lib/deviceCache';
import { setNativeImageCacheScope } from '../lib/nativeImageCache';
import { isDefinitelyInvalidSession, isOfflineNetworkError, readOfflineAccount, revokeOfflineAccount, saveOfflineAccount } from '../lib/offlineAccount';
import { hasPlatformOwnerAccess, loadPlatformOwnerAccess, type PlatformOwnerAccess } from '../lib/platformOwnerAccess';

function activateDeviceCache(scope: string | null) {
  return Promise.all([setDeviceCacheScope(scope), setNativeImageCacheScope(scope)])
    .catch(error => { console.warn('[Cache] Device cache unavailable:', error); });
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  userRoles: UserRole[];
  roles: Role[];
  savedAccounts: SavedAccount[];
  loading: boolean;
  offlineMode: boolean;
  hasOrganization: boolean;
  isOrgAdmin: boolean;
  isPlatformOwner: boolean;
  isLeader: boolean;
  isAdmin: boolean;
  isProductionDirector: boolean;
  isMusicDirector: boolean;
  isStageDirector: boolean;
  isAdminCoordinator: boolean;
  isSetlistCoordinator: boolean;
  canApproveLeave: boolean;
  canManageDiscipline: boolean;
  canManageMembers: boolean;
  capabilities: Record<string, boolean>;
  canPreviewMemberView: boolean;
  isViewingAsMember: boolean;
  isViewingAsSongLeader: boolean;
  setViewingAsMember: (enabled: boolean) => void;
  setViewingAsSongLeader: (enabled: boolean) => void;
  signUp: (email: string, password: string, firstName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  addSavedAccount: (email: string, password: string) => Promise<{ error: Error | null }>;
  switchAccount: (userId: string) => Promise<{ error: Error | null }>;
  forgetSavedAccount: (userId: string) => void;
  refreshProfile: () => Promise<void>;
  retryOnline: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CONTEXT_REQUEST_TIMEOUT_MS = 10000;
const MEMBER_VIEW_SESSION_KEY_PREFIX = 'servesync:view-as-member';

async function withAuthTimeout<T>(
  request: PromiseLike<T>,
  fallback: unknown,
  label: string,
  timeoutMs = AUTH_CONTEXT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const typedFallback = fallback as T;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Auth] ${label} timed out; continuing with fallback state.`);
      resolve(typedFallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } catch (error) {
    console.error(`[Auth] ${label} failed:`, error);
    return typedFallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function withAuthDeadline<T>(request: PromiseLike<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), AUTH_CONTEXT_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found');
}

function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

async function clearStoredAuthSession() {
  if (typeof window !== 'undefined') {
    Object.keys(window.localStorage)
      .filter(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach(key => window.localStorage.removeItem(key));
  }

  try {
    await withAuthTimeout(
      supabase.auth.signOut({ scope: 'local' }),
      { error: null } as Awaited<ReturnType<typeof supabase.auth.signOut>>,
      'Local sign-out cleanup',
      3000,
    );
  } catch (error) {
    console.warn('[Auth] Failed to clear local Supabase session:', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => readSavedAccounts());
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [platformOwnerAccess, setPlatformOwnerAccess] = useState<PlatformOwnerAccess | null>(null);
  const [previewModeRequested, setPreviewModeRequested] = useState<'member' | 'song_leader' | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const authTransitionRef = useRef(true);
  const offlineModeRef = useRef(false);
  const accessRefreshVersionRef = useRef(0);

  useLayoutEffect(() => {
    // Preserve the last signed-in cache during startup until live auth establishes its owner.
    if (loading) return;
    const scope = profile?.id === user?.id ? deviceCacheScope(user?.id, profile?.org_id) : null;
    void activateDeviceCache(scope);
  }, [loading, user?.id, profile?.id, profile?.org_id]);

  const clearUserContext = () => {
    void activateDeviceCache(null);
    setSession(null);
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setUserRoles([]);
    setCapabilities({});
    setPreviewModeRequested(null);
    setOfflineMode(false);
    offlineModeRef.current = false;
    activeUserIdRef.current = null;
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await withAuthTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),
      { data: null, error: null },
      'Profile request',
    );
    if (error) console.error('[Auth] Profile request error:', error);
    setProfile(data);
    return data;
  };

  const fetchOrganization = async (orgId: string | null | undefined) => {
    if (!orgId) {
      setOrganization(null);
      return null;
    }

    const { data, error } = await withAuthTimeout(
      supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle(),
      { data: null, error: null },
      'Organization request',
    );
    if (error) console.error('[Auth] Organization request error:', error);
    setOrganization(data);
    return data;
  };

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await withAuthTimeout(
      supabase
        .from('user_roles')
        .select('*, roles(*)')
        .eq('user_id', userId),
      { data: [], error: null },
      'User roles request',
    );
    if (error) console.error('[Auth] User roles request error:', error);
    setUserRoles(data || []);
  };

  const fetchCapabilities = async (userId: string) => {
    const { data } = await withAuthTimeout(
      supabase.from('organization_member_settings').select('capabilities').eq('user_id', userId).maybeSingle(),
      { data: null, error: null },
      'Member capabilities request',
    );
    setCapabilities((data?.capabilities || {}) as Record<string, boolean>);
  };

  const fetchRoles = async () => {
    const { data, error } = await withAuthTimeout(
      supabase
        .from('roles')
        .select('*')
        .order('sort_order'),
      { data: [], error: null },
      'Roles request',
    );
    if (error) console.error('[Auth] Roles request error:', error);
    setRoles(data || []);
  };

  const syncSavedAccount = (activeSession: Session | null, profileData?: Profile | null) => {
    if (!activeSession?.user?.id || !activeSession.access_token || !activeSession.refresh_token) return;

    const fullName = `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim();
    const displayName = profileData?.nickname || fullName || activeSession.user.email || 'Account';

    setSavedAccounts(upsertSavedAccount({
      userId: activeSession.user.id,
      email: profileData?.email || activeSession.user.email || '',
      displayName,
      avatarUrl: profileData?.avatar_url || null,
      lastUsedAt: new Date().toISOString(),
      session: {
        accessToken: activeSession.access_token,
        refreshToken: activeSession.refresh_token,
      },
    }));
  };

  const verifyLiveAccount = async (userId: string): Promise<{ profile: Profile | null; organization: Organization | null }> => {
    const profileResult = await withAuthDeadline(
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(), 'Profile revalidation');
    if (profileResult.error) throw profileResult.error;
    const profileData = profileResult.data as Profile | null;
    if (!profileData?.org_id) return { profile: profileData, organization: null };
    const organizationResult = await withAuthDeadline(
      supabase.from('organizations').select('*').eq('id', profileData.org_id).maybeSingle(), 'Church revalidation');
    if (organizationResult.error) throw organizationResult.error;
    return { profile: profileData, organization: organizationResult.data as Organization | null };
  };

  const hydrateUserContext = async (
    userId: string,
    activeSession?: Session | null,
    verifiedAccount?: { profile: Profile | null; organization: Organization | null },
  ) => {
    const [profileData] = await Promise.all([
      verifiedAccount ? Promise.resolve(verifiedAccount.profile) : fetchProfile(userId),
      fetchUserRoles(userId),
      fetchCapabilities(userId),
      fetchRoles(),
    ]);
    const organizationData = verifiedAccount
      ? verifiedAccount.organization
      : await fetchOrganization(profileData?.org_id);
    if (verifiedAccount) {
      setProfile(profileData);
      setOrganization(organizationData);
    }
    if (activeUserIdRef.current !== userId || offlineModeRef.current) return;
    syncSavedAccount(activeSession ?? null, profileData);
    if (activeSession?.user) saveOfflineAccount(activeSession.user, profileData, organizationData);
  };

  const refreshProfile = async () => {
    if (user && !offlineMode) {
      const userId = user.id;
      const refreshVersion = ++accessRefreshVersionRef.current;
      try {
        const [liveAccount, roleResult, capabilityResult, ownerAccess] = await Promise.all([
          verifyLiveAccount(userId),
          withAuthDeadline(supabase.from('user_roles').select('*, roles(*)').eq('user_id', userId), 'Role revalidation'),
          withAuthDeadline(supabase.from('organization_member_settings').select('capabilities').eq('user_id', userId).maybeSingle(), 'Capability revalidation'),
          loadPlatformOwnerAccess(userId, () => withAuthDeadline(supabase.rpc('is_platform_owner'), 'Owner revalidation')),
        ]);
        if (activeUserIdRef.current !== userId || offlineModeRef.current || refreshVersion !== accessRefreshVersionRef.current) return;
        if (!liveAccount.profile?.org_id || liveAccount.organization?.id !== liveAccount.profile.org_id) revokeOfflineAccount();
        setProfile(liveAccount.profile);
        setOrganization(liveAccount.organization);
        setUserRoles(roleResult.error ? [] : roleResult.data || []);
        setCapabilities(capabilityResult.error ? {} : capabilityResult.data?.capabilities || {});
        setPlatformOwnerAccess(ownerAccess);
        if (session?.user) saveOfflineAccount(session.user, liveAccount.profile, liveAccount.organization);
      } catch (error) {
        console.warn('[Auth] Could not refresh live account context:', error);
      }
    }
  };

  const refreshAccessRef = useRef(refreshProfile);
  useLayoutEffect(() => { refreshAccessRef.current = refreshProfile; });
  useEffect(() => {
    if (!user?.id || !session?.access_token || offlineMode) return;
    let active = true;
    let nativeListener: PluginListenerHandle | undefined;
    const queue = createAccessRefreshQueue(() => refreshAccessRef.current());
    const refreshVisible = () => {
      if (active && document.visibilityState === 'visible' && navigator.onLine) void queue.request();
    };
    const channel = supabase.channel(`access-revision:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_access_revisions', filter: `user_id=eq.${user.id}` }, refreshVisible);
    void supabase.realtime.setAuth(session.access_token).then(() => {
      if (active) channel.subscribe(status => { if (status === 'SUBSCRIBED') refreshVisible(); });
    }).catch(error => console.warn('[Auth] Access subscription unavailable:', error));
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    if (Capacitor.isNativePlatform()) void App.addListener('appStateChange', state => {
      if (state.isActive && active) void queue.request();
    }).then(listener => { if (active) nativeListener = listener; else void listener.remove(); })
      .catch(error => console.warn('[Auth] Native resume listener unavailable:', error));
    const timer = window.setInterval(refreshVisible, 30000);
    return () => {
      active = false;
      queue.dispose();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      void nativeListener?.remove();
      void supabase.removeChannel(channel);
    };
  }, [user?.id, session?.access_token, offlineMode]);

  useEffect(() => {
    let cancelled = false;
    const openOfflineAccount = async (snapshot: NonNullable<ReturnType<typeof readOfflineAccount>>) => {
      setSession(null);
      setUser(snapshot.user);
      setProfile(snapshot.profile);
      setOrganization(snapshot.organization);
      setUserRoles([]);
      setRoles([]);
      setCapabilities({});
      setPreviewModeRequested(null);
      setOfflineMode(true);
      offlineModeRef.current = true;
      activeUserIdRef.current = snapshot.user.id;
      await activateDeviceCache(deviceCacheScope(snapshot.user.id, snapshot.profile.org_id));
      console.info('[Auth] Opened saved Android account in read-only offline mode.');
    };
    const restore = async () => {
      let candidateSession: Session | null = null;
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const saved = readOfflineAccount(readSavedAccounts());
          if (saved) {
            await openOfflineAccount(saved);
            return;
          }
        }
        const { data, error } = await withAuthDeadline(supabase.auth.getSession(), 'Stored session restore');
        candidateSession = data.session;
        if (error) throw error;
        if (!candidateSession?.user) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Device is offline');
          if (!cancelled) {
            revokeOfflineAccount();
            clearUserContext();
            await fetchRoles();
          }
          return;
        }
        // getSession is local storage. Confirm the server still accepts this user before
        // opening online routes or renewing the offline identity record.
        const verified = await withAuthDeadline(supabase.auth.getUser(), 'User revalidation');
        if (verified.error) throw verified.error;
        if (verified.data.user?.id !== candidateSession.user.id) throw new Error('Stored account does not match the verified user.');
        const liveAccount = await verifyLiveAccount(verified.data.user.id);
        if (cancelled) return;
        if (!liveAccount.profile?.org_id || liveAccount.organization?.id !== liveAccount.profile.org_id) revokeOfflineAccount();
        setSession(candidateSession);
        setUser(verified.data.user);
        activeUserIdRef.current = verified.data.user.id;
        await hydrateUserContext(verified.data.user.id, candidateSession, liveAccount);
      } catch (error) {
        if (cancelled) return;
        const snapshot = readOfflineAccount(readSavedAccounts());
        const canRestore = snapshot && (!candidateSession || candidateSession.user.id === snapshot.user.id)
          && !isDefinitelyInvalidSession(error)
          && (isOfflineNetworkError(error) || (typeof navigator !== 'undefined' && !navigator.onLine));
        if (canRestore) {
          await openOfflineAccount(snapshot);
        } else {
          if (isDefinitelyInvalidSession(error)) {
            revokeOfflineAccount();
            await clearStoredAuthSession();
          }
          clearUserContext();
          await fetchRoles();
          console.warn('[Auth] Session restore unavailable:', error);
        }
      } finally {
        if (!cancelled) {
          authTransitionRef.current = false;
          setLoading(false);
        }
      }
    };
    void restore();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (authTransitionRef.current) return;
      if (offlineModeRef.current) return;

      if (event === 'TOKEN_REFRESHED') {
        setSession(s);
        setUser(s?.user ?? null);
        activeUserIdRef.current = s?.user?.id ?? null;
        syncSavedAccount(s, profile);
        return;
      }

      if (event === 'SIGNED_IN') {
        const nextUserId = s?.user?.id ?? null;
        const isSameUser = Boolean(nextUserId && nextUserId === activeUserIdRef.current);
        if (!isSameUser) revokeOfflineAccount();

        setSession(s);
        setUser(s?.user ?? null);
        setOfflineMode(false);
        offlineModeRef.current = false;
        activeUserIdRef.current = nextUserId;

        // Supabase may emit SIGNED_IN again when an existing browser tab
        // regains focus. Keep the current page mounted in that case.
        if (isSameUser) return;

        void activateDeviceCache(null);
        setLoading(true);
        if (s?.user) {
          hydrateUserContext(s.user.id, s).finally(() => setLoading(false));
        } else {
          clearUserContext();
          fetchRoles().finally(() => setLoading(false));
        }
        return;
      }

      if (event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
        setSession(s);
        setUser(s?.user ?? null);
        activeUserIdRef.current = s?.user?.id ?? null;
        if (event === 'USER_UPDATED' && s?.user) void hydrateUserContext(s.user.id, s);
        return;
      }

      setLoading(true);
      if (event === 'SIGNED_OUT') revokeOfflineAccount();
      setSession(s);
      setUser(s?.user ?? null);
      activeUserIdRef.current = s?.user?.id ?? null;
      if (s?.user) {
        (async () => {
          await hydrateUserContext(s.user.id, s);
        })().finally(() => setLoading(false));
      } else {
        void activateDeviceCache(null);
        setProfile(null);
        setOrganization(null);
        setUserRoles([]);
        fetchRoles().finally(() => setLoading(false));
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
    // The Supabase auth listener is registered once; recreating it on context updates can duplicate auth events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleNames = userRoles.map(ur => ur.roles?.name || '');
  const hasOrganization = Boolean(profile?.org_id && organization);
  const actualIsOrgAdmin = !offlineMode && (profile?.is_org_admin ?? false);
  useEffect(() => {
    setPlatformOwnerAccess(null);
    if (!user?.id || offlineMode) return;
    let active = true;
    void loadPlatformOwnerAccess(user.id, () => withAuthTimeout(
      supabase.rpc('is_platform_owner'),
      { data: false, error: 'Owner permission lookup unavailable' },
      'Owner permission lookup',
    )).then(access => { if (active) setPlatformOwnerAccess(access); });
    return () => { active = false; };
  }, [user?.id, offlineMode, profile?.org_id, profile?.email, profile?.is_org_admin]);
  const actualIsPlatformOwner = hasPlatformOwnerAccess(platformOwnerAccess, user?.id, offlineMode);
  const actualIsAdmin = !offlineMode && roleNames.includes('Admin');
  const canPreviewMemberView = actualIsOrgAdmin || actualIsPlatformOwner || actualIsAdmin;
  const isViewingAsMember = canPreviewMemberView && previewModeRequested === 'member';
  const isViewingAsSongLeader = canPreviewMemberView && previewModeRequested === 'song_leader';
  const isRolePreviewActive = isViewingAsMember || isViewingAsSongLeader;
  const effectiveCapabilities = isRolePreviewActive ? {} : capabilities;
  const isOrgAdmin = isRolePreviewActive ? false : actualIsOrgAdmin;
  const isPlatformOwner = isRolePreviewActive ? false : actualIsPlatformOwner;
  const isLeader = isRolePreviewActive ? false : roleNames.some(n => ['Admin', 'Admin Coordinator', 'Music Director', 'Stage Director', 'Production Director', 'Setlist Coordinator'].includes(n));
  const isAdmin = isRolePreviewActive ? false : actualIsAdmin;
  const isAdminCoordinator = !isRolePreviewActive && roleNames.includes('Admin Coordinator');
  const isProductionDirector = !isRolePreviewActive && roleNames.includes('Production Director');
  const isMusicDirector = !isRolePreviewActive && roleNames.includes('Music Director');
  const isStageDirector = !isRolePreviewActive && roleNames.includes('Stage Director');
  const isSetlistCoordinator = !isRolePreviewActive && roleNames.includes('Setlist Coordinator');
  const canApproveLeave = isOrgAdmin || isPlatformOwner || effectiveCapabilities.approve_leave || isAdmin || isProductionDirector || isMusicDirector || isAdminCoordinator;
  const canManageDiscipline = isOrgAdmin || isPlatformOwner || effectiveCapabilities.manage_accountability || isAdmin || isProductionDirector || isMusicDirector || isAdminCoordinator;
  const canManageMembers = isOrgAdmin || isPlatformOwner || effectiveCapabilities.manage_members || isAdmin || isProductionDirector;

  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    if (!user?.id) {
      setPreviewModeRequested(null);
      return;
    }

    const storageKey = `${MEMBER_VIEW_SESSION_KEY_PREFIX}:${user.id}`;
    if (!canPreviewMemberView) {
      window.sessionStorage.removeItem(storageKey);
      setPreviewModeRequested(null);
      return;
    }

    const storedMode = window.sessionStorage.getItem(storageKey);
    setPreviewModeRequested(
      storedMode === 'song_leader' ? 'song_leader' : storedMode === 'member' || storedMode === '1' ? 'member' : null,
    );
  }, [canPreviewMemberView, loading, user?.id]);

  const setViewingAsMember = (enabled: boolean) => {
    if (!user?.id || (enabled && !canPreviewMemberView)) return;
    setPreviewModeRequested(enabled ? 'member' : null);
    if (typeof window === 'undefined') return;
    const storageKey = `${MEMBER_VIEW_SESSION_KEY_PREFIX}:${user.id}`;
    if (enabled) window.sessionStorage.setItem(storageKey, 'member');
    else window.sessionStorage.removeItem(storageKey);
  };

  const setViewingAsSongLeader = (enabled: boolean) => {
    if (!user?.id || (enabled && !canPreviewMemberView)) return;
    setPreviewModeRequested(enabled ? 'song_leader' : null);
    if (typeof window === 'undefined') return;
    const storageKey = `${MEMBER_VIEW_SESSION_KEY_PREFIX}:${user.id}`;
    if (enabled) window.sessionStorage.setItem(storageKey, 'song_leader');
    else window.sessionStorage.removeItem(storageKey);
  };

  const signUp = async (email: string, password: string, firstName: string) => {
    const normalizedEmail = normalizeAuthEmail(email);
    const normalizedFirstName = firstName.trim();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { first_name: normalizedFirstName } },
    });
    if (error) return { error: error as Error | null };

    if (data.user) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: normalizedEmail,
          first_name: normalizedFirstName,
        });
      }
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeAuthEmail(email),
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    const mustSignOutLocally = offlineModeRef.current || (typeof navigator !== 'undefined' && !navigator.onLine);
    // Online sign-out keeps its existing safety gate: a failed server revoke
    // leaves this account signed in so notifications cannot cross accounts.
    if (!mustSignOutLocally) await disconnectNativePush();
    revokeOfflineAccount();
    clearUserContext();
    if (mustSignOutLocally) {
      try { await disconnectNativePush(); }
      catch (error) {
        // The controller retains its owner for a later server revoke. Stop
        // local delivery and erase visible notifications now.
        if (androidPushAvailable()) {
          await Promise.allSettled([
            PushNotifications.unregister(),
            PushNotifications.removeAllDeliveredNotifications(),
          ]);
        }
        console.warn('[Auth] Phone notification server cleanup will retry after reconnect:', error);
      }
    }
    await activateDeviceCache(null);
    try {
      const result = await withAuthDeadline(supabase.auth.signOut({ scope: 'local' }), 'Local sign-out');
      if (result.error) await clearStoredAuthSession();
    } catch {
      await clearStoredAuthSession();
    }
    setProfile(null);
    setOrganization(null);
    setUserRoles([]);
  };

  const addSavedAccount = async (email: string, password: string) => {
    const normalizedEmail = normalizeAuthEmail(email);
    const currentEmail = (profile?.email || user?.email || '').trim().toLowerCase();

    if (normalizedEmail && normalizedEmail === currentEmail) {
      syncSavedAccount(session, profile);
      return { error: null };
    }

    const tempClient = createTransientSupabaseClient();
    const { data, error } = await tempClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { error: error as Error | null };
    }

    const tempSession = data.session;
    const tempUser = data.user;
    if (!tempSession || !tempUser) {
      return { error: new Error('Failed to save that account on this device.') };
    }

    const { data: tempProfile } = await tempClient
      .from('profiles')
      .select('*')
      .eq('id', tempUser.id)
      .maybeSingle();

    const fullName = `${tempProfile?.first_name || ''} ${tempProfile?.last_name || ''}`.trim();
    const displayName = tempProfile?.nickname || fullName || tempUser.email || normalizedEmail;

    setSavedAccounts(upsertSavedAccount({
      userId: tempUser.id,
      email: tempProfile?.email || tempUser.email || normalizedEmail,
      displayName,
      avatarUrl: tempProfile?.avatar_url || null,
      lastUsedAt: new Date().toISOString(),
      session: {
        accessToken: tempSession.access_token,
        refreshToken: tempSession.refresh_token,
      },
    }));

    return { error: null };
  };

  const switchAccount = async (userId: string) => {
    if (offlineMode) return { error: new Error('Connect to the internet before switching accounts.') };
    const targetAccount = savedAccounts.find(account => account.userId === userId);
    if (!targetAccount) return { error: new Error('Saved account not found.') };

    try { await disconnectNativePush(); }
    catch (error) { return { error: error instanceof Error ? error : new Error('Could not disconnect phone notifications.') }; }

    revokeOfflineAccount();
    clearUserContext();
    await activateDeviceCache(null);
    setLoading(true);

    authTransitionRef.current = true;
    try {
      const { data: { session: currentSession } } = await withAuthDeadline(supabase.auth.getSession(), 'Current account save');
      if (currentSession?.user?.id && currentSession.user.id !== targetAccount.userId) {
        syncSavedAccount(currentSession, profile);
      }
      const { data, error } = await withAuthDeadline(supabase.auth.setSession({
        access_token: targetAccount.session.accessToken,
        refresh_token: targetAccount.session.refreshToken,
      }), 'Saved account switch');

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          setSavedAccounts(removeSavedAccount(userId));
          return { error: new Error('This saved account expired on this device. Sign in again once to restore it.') };
        }
        return { error: error as Error | null };
      }

      const nextSession = data.session ?? null;
      if (!nextSession?.user) {
        return { error: new Error('Saved account could not be restored. Sign in again once to save it back.') };
      }

      const verified = await withAuthDeadline(supabase.auth.getUser(), 'Saved account verification');
      if (verified.error || verified.data.user?.id !== targetAccount.userId) {
        return { error: (verified.error as Error | null) ?? new Error('Saved account could not be verified.') };
      }

      setSession(nextSession);
      setUser(verified.data.user);
      activeUserIdRef.current = verified.data.user.id;
      await hydrateUserContext(nextSession.user.id, nextSession);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Could not switch accounts.') };
    } finally {
      authTransitionRef.current = false;
      setLoading(false);
    }
  };

  const forgetSavedAccount = (userId: string) => {
    if (activeUserIdRef.current === userId) revokeOfflineAccount();
    setSavedAccounts(removeSavedAccount(userId));
  };

  const retryOnline = async (): Promise<{ error: Error | null }> => {
    if (!offlineMode) return { error: null };
    const snapshot = readOfflineAccount(readSavedAccounts());
    if (!snapshot || snapshot.user.id !== user?.id) {
      revokeOfflineAccount();
      clearUserContext();
      return { error: new Error('This offline account is no longer available. Sign in again.') };
    }
    authTransitionRef.current = true;
    try {
      let nextSession: Session | null = null;
      const stored = await withAuthDeadline(supabase.auth.getSession(), 'Stored session restore');
      if (stored.error && isDefinitelyInvalidSession(stored.error)) throw stored.error;
      if (!stored.error) nextSession = stored.data.session;
      if (!nextSession || nextSession.user.id !== snapshot.user.id) {
        const saved = readSavedAccounts().find(account => account.userId === snapshot.user.id);
        if (!saved) throw new Error('Saved account is no longer available.');
        const restored = await withAuthDeadline(supabase.auth.setSession({
          access_token: saved.session.accessToken,
          refresh_token: saved.session.refreshToken,
        }), 'Saved account revalidation');
        if (restored.error) throw restored.error;
        nextSession = restored.data.session;
      }
      if (!nextSession || nextSession.user.id !== snapshot.user.id) throw new Error('Saved account does not match the active account.');
      const verified = await withAuthDeadline(supabase.auth.getUser(), 'User revalidation');
      if (verified.error) throw verified.error;
      if (verified.data.user?.id !== snapshot.user.id) throw new Error('Saved account does not match the verified user.');

      // Confirm live church membership before leaving the restricted reader.
      const liveAccount = await verifyLiveAccount(snapshot.user.id);
      if (!liveAccount.profile?.org_id || liveAccount.organization?.id !== liveAccount.profile.org_id) revokeOfflineAccount();

      setSession(nextSession);
      setUser(verified.data.user);
      activeUserIdRef.current = verified.data.user.id;
      await hydrateUserContext(verified.data.user.id, nextSession, liveAccount);
      setOfflineMode(false);
      offlineModeRef.current = false;
      return { error: null };
    } catch (error) {
      if (isDefinitelyInvalidSession(error) || (error instanceof Error && /does not match|no longer available/.test(error.message))) {
        revokeOfflineAccount();
        await clearStoredAuthSession();
        clearUserContext();
      } else {
        // Any partial query state is replaced with the same saved identity.
        setSession(null);
        setUser(snapshot.user);
        setProfile(snapshot.profile);
        setOrganization(snapshot.organization);
        setUserRoles([]);
        setRoles([]);
        setCapabilities({});
      }
      return { error: error instanceof Error ? error : new Error('Could not reconnect.') };
    } finally {
      authTransitionRef.current = false;
    }
  };

  const retryOnlineRef = useRef(retryOnline);
  retryOnlineRef.current = retryOnline;
  useEffect(() => {
    if (!offlineMode) return;
    const reconnect = () => {
      if (navigator.onLine) void retryOnlineRef.current();
    };
    window.addEventListener('online', reconnect);
    const initialRetry = navigator.onLine ? window.setTimeout(reconnect, 1000) : null;
    return () => {
      window.removeEventListener('online', reconnect);
      if (initialRetry !== null) window.clearTimeout(initialRetry);
    };
  }, [offlineMode]);

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, organization, userRoles, roles, loading, offlineMode,
        savedAccounts,
        hasOrganization, isOrgAdmin, isPlatformOwner,
        isLeader, isAdmin, isAdminCoordinator, isProductionDirector, isMusicDirector, isStageDirector, isSetlistCoordinator,
        canApproveLeave, canManageDiscipline, canManageMembers, capabilities: effectiveCapabilities,
        canPreviewMemberView, isViewingAsMember, isViewingAsSongLeader, setViewingAsMember, setViewingAsSongLeader,
        signUp, signIn, signOut, addSavedAccount, switchAccount, forgetSavedAccount, refreshProfile, retryOnline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
