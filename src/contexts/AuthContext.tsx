import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Organization, Profile, Role, UserRole } from '../types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  userRoles: UserRole[];
  roles: Role[];
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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
    return data;
  };

  const fetchOrganization = async (orgId: string | null | undefined) => {
    if (!orgId) {
      setOrganization(null);
      return null;
    }

    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    setOrganization(data);
    return data;
  };

  const fetchUserRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('*, roles(*)')
      .eq('user_id', userId);
    setUserRoles(data || []);
  };

  const fetchRoles = async () => {
    const { data } = await supabase
      .from('roles')
      .select('*')
      .order('sort_order');
    setRoles(data || []);
  };

  const hydrateUserContext = async (userId: string) => {
    const [profileData] = await Promise.all([
      fetchProfile(userId),
      fetchUserRoles(userId),
      fetchRoles(),
    ]);
    await fetchOrganization(profileData?.org_id);
  };

  const refreshProfile = async () => {
    if (user) {
      const [profileData] = await Promise.all([fetchProfile(user.id), fetchUserRoles(user.id)]);
      await fetchOrganization(profileData?.org_id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        hydrateUserContext(s.user.id).finally(() => setLoading(false));
      } else {
        fetchRoles().finally(() => {
          setOrganization(null);
          setLoading(false);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await hydrateUserContext(s.user.id);
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName } },
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
          email,
          first_name: firstName,
        });
      }
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setOrganization(null);
    setUserRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, organization, userRoles, roles, loading,
        hasOrganization, isOrgAdmin, isPlatformOwner,
        isLeader, isAdmin, isAdminCoordinator, isProductionDirector, isMusicDirector, isStageDirector, isSetlistCoordinator,
        canApproveLeave, canManageDiscipline, canManageMembers,
        signUp, signIn, signOut, refreshProfile,
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
