import { supabase } from './supabase';
import { getMobilePlatform, hasBottomSafeAreaInset } from './device';

export type MobileNavStyle = 'floating' | 'docked';

const MOBILE_NAV_STYLE_KEY = 'servesync_mobile_nav_style';
export const MOBILE_NAV_STYLE_CHANGE_EVENT = 'servesync-mobile-nav-style-change';

export function getDefaultMobileNavStyle(): MobileNavStyle {
  return getMobilePlatform() === 'ios' && hasBottomSafeAreaInset() ? 'floating' : 'docked';
}

export function getStoredMobileNavStyle(): MobileNavStyle {
  if (typeof window === 'undefined') return getDefaultMobileNavStyle();
  const stored = window.localStorage.getItem(MOBILE_NAV_STYLE_KEY);
  return stored === 'floating' || stored === 'docked' ? stored : getDefaultMobileNavStyle();
}

export function setStoredMobileNavStyle(style: MobileNavStyle) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MOBILE_NAV_STYLE_KEY, style);
  window.dispatchEvent(new CustomEvent(MOBILE_NAV_STYLE_CHANGE_EVENT, { detail: { style } }));
}

export async function fetchMobileNavStylePreference(userId: string): Promise<MobileNavStyle | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('mobile_nav_style')
    .eq('user_id', userId)
    .is('role_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  const value = data?.mobile_nav_style;
  return value === 'floating' || value === 'docked' ? value : null;
}

export async function saveMobileNavStylePreference(userId: string, style: MobileNavStyle) {
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .is('role_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('user_preferences')
      .update({ mobile_nav_style: style, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_preferences')
      .insert({ user_id: userId, mobile_nav_style: style });
    if (error) throw error;
  }

  setStoredMobileNavStyle(style);
}
