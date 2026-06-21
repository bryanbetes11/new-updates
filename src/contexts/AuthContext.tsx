import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createTransientSupabaseClient, supabase } from '../lib/supabase';
import { readSavedAccounts, removeSavedAccount, upsertSavedAccount, type SavedAccount } from '../lib/savedAccounts';
import type { Organization, Profile, Role, UserRole } from '../types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  userRoles: UserRole[];
  roles: Role[];
  savedAccounts: SavedAccount[];
  loading: boolean;
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
  signUp: (email: string, password: string, firstName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  addSavedAccount: (email: string, password: string) => Promise<{ error: Error | null }>;
  switchAccount: (userId: string) => Promise<{ error: Error | null }>;
  forgetSavedAccount: (userId: string) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CONTEXT_REQUEST_TIMEOUT_MS = 10000;

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
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => readSavedAccounts());
  const [loading, setLoading] = useState(true);

  const clearUserContext = () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setUserRoles([]);
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

  const hydrateUserContext = async (userId: string, activeSession?: Session | null) => {
    const [profileData] = await Promise.all([
      fetchProfile(userId),
      fetchUserRoles(userId),
      fetchRoles(),
    ]);
    await fetchOrganization(profileData?.org_id);
    syncSavedAccount(activeSession ?? null, profileData);
  };

  const refreshProfile = async () => {
    if (user) {
      const [profileData] = await Promise.all([fetchProfile(user.id), fetchUserRoles(user.id)]);
      await fetchOrganization(profileData?.org_id);
      syncSavedAccount(session, profileData);
    }
  };

  useEffect(() => {
    withAuthTimeout(
      supabase.auth.getSession(),
      { data: { session: null }, error: null },
      'Stored session restore',
    )
      .then(async ({ data: { session: s }, error }) => {
        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            console.warn('[Auth] Stored session refresh token is invalid; clearing local auth state.');
            await clearStoredAuthSession();
          } else {
            console.error('[Auth] Failed to restore session:', error);
          }
          clearUserContext();
          await fetchRoles();
          setLoading(false);
          return;
        }

        setSession(s);
        setUser(s?.user ?? null);
        syncSavedAccount(s);
        if (s?.user) {
          hydrateUserContext(s.user.id, s).finally(() => setLoading(false));
        } else {
          fetchRoles().finally(() => {
            setOrganization(null);
            setLoading(false);
          });
        }
      })
      .catch(async error => {
        if (isInvalidRefreshTokenError(error)) {
          console.warn('[Auth] Stored session refresh token is invalid; clearing local auth state.');
          await clearStoredAuthSession();
        } else {
          console.error('[Auth] Failed to restore session:', error);
        }
        clearUserContext();
        fetchRoles().finally(() => setLoading(false));
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(s);
        setUser(s?.user ?? null);
        syncSavedAccount(s, profile);
        return;
      }

      setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await hydrateUserContext(s.user.id, s);
        })().finally(() => setLoading(false));
      } else {
        setProfile(null);
        setOrganization(null);
        setUserRoles([]);
        fetchRoles().finally(() => setLoading(false));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const roleNames = userRoles.map(ur => ur.roles?.name || '');
  const hasOrganization = Boolean(profile?.org_id && organization);
  const isOrgAdmin = profile?.is_org_admin ?? false;
  const isPlatformOwner = [profile?.email, user?.email]
    .some(email => (email || '').toLowerCase() === 'bryanbetes11@gmail.com');
  const isLeader = roleNames.some(n => ['Admin', 'Admin Coordinator', 'Music Director', 'Stage Director', 'Production Director', 'Setlist Coordinator'].includes(n));
  const isAdmin = roleNames.includes('Admin');
  const isAdminCoordinator = roleNames.includes('Admin Coordinator');
  const isProductionDirector = roleNames.includes('Production Director');
  const isMusicDirector = roleNames.includes('Music Director');
  const isStageDirector = roleNames.includes('Stage Director');
  const isSetlistCoordinator = roleNames.includes('Setlist Coordinator');
  const canApproveLeave = isAdmin || isProductionDirector || isMusicDirector || isAdminCoordinator;
  const canManageDiscipline = isAdmin || isProductionDirector || isMusicDirector || isAdminCoordinator;
  const canManageMembers = isAdmin || isProductionDirector;

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
    await supabase.auth.signOut({ scope: 'local' });
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
    const targetAccount = savedAccounts.find(account => account.userId === userId);
    if (!targetAccount) return { error: new Error('Saved account not found.') };

    setLoading(true);

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id && currentSession.user.id !== targetAccount.userId) {
      syncSavedAccount(currentSession, profile);
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: targetAccount.session.accessToken,
      refresh_token: targetAccount.session.refreshToken,
    });

    if (error) {
      setLoading(false);
      if (isInvalidRefreshTokenError(error)) {
        setSavedAccounts(removeSavedAccount(userId));
        return { error: new Error('This saved account expired on this device. Sign in again once to restore it.') };
      }
      return { error: error as Error | null };
    }

    const nextSession = data.session ?? null;
    if (!nextSession?.user) {
      setLoading(false);
      return { error: new Error('Saved account could not be restored. Sign in again once to save it back.') };
    }

    setSession(nextSession);
    setUser(nextSession.user);
    await hydrateUserContext(nextSession.user.id, nextSession);
    setLoading(false);

    return { error: null };
  };

  const forgetSavedAccount = (userId: string) => {
    setSavedAccounts(removeSavedAccount(userId));
  };

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, organization, userRoles, roles, loading,
        savedAccounts,
        hasOrganization, isOrgAdmin, isPlatformOwner,
        isLeader, isAdmin, isAdminCoordinator, isProductionDirector, isMusicDirector, isStageDirector, isSetlistCoordinator,
        canApproveLeave, canManageDiscipline, canManageMembers,
        signUp, signIn, signOut, addSavedAccount, switchAccount, forgetSavedAccount, refreshProfile,
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
