import { supabase } from './supabase';
import { DEFAULT_STAGE_REQUEST_MESSAGES, DEFAULT_TECH_MODE_MESSAGES, TECH_MESSAGE_GROUPS, saveStageRequestMessages, saveTechModeMessages, type TechModeMessages } from './techModeMessages';

function normalize(value: unknown, defaults: TechModeMessages): TechModeMessages {
  const source = value && typeof value === 'object' ? value as Partial<TechModeMessages> : {};
  return Object.fromEntries(TECH_MESSAGE_GROUPS.map(group => [group, Array.from({ length: 4 }, (_, i) => {
    const message = source[group]?.[i];
    return typeof message === 'string' && message.trim() ? message.trim().slice(0, 32) : defaults[group][i];
  })])) as TechModeMessages;
}

export async function fetchSharedTechMessages(orgId: string) {
  const { data, error } = await supabase.from('organization_policy_settings')
    .select('tech_mode_messages, stage_request_messages, updated_at').eq('org_id', orgId).single();
  if (error || !data) throw new Error(error?.message || 'Church settings unavailable');
  return {
    messages: normalize(data.tech_mode_messages, DEFAULT_TECH_MODE_MESSAGES),
    stageRequests: normalize(data.stage_request_messages, DEFAULT_STAGE_REQUEST_MESSAGES),
    updatedAt: data.updated_at as string,
  };
}

export async function saveSharedTechMessages(orgId: string, messages: TechModeMessages, stageRequests: TechModeMessages, updatedAt: string) {
  const next = { messages: normalize(messages, DEFAULT_TECH_MODE_MESSAGES), stageRequests: normalize(stageRequests, DEFAULT_STAGE_REQUEST_MESSAGES) };
  const { data, error } = await supabase.from('organization_policy_settings').update({
    tech_mode_messages: next.messages, stage_request_messages: next.stageRequests, updated_at: new Date().toISOString(),
  }).eq('org_id', orgId).eq('updated_at', updatedAt).select('updated_at').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Church settings changed on another device. Reload saved settings before saving again.');
  saveTechModeMessages(orgId, next.messages);
  saveStageRequestMessages(orgId, next.stageRequests);
  return { ...next, updatedAt: data.updated_at as string };
}

// Refresh on resume and while a visible event is open, including devices without Realtime.
export function watchSharedTechMessages(orgId: string) {
  let active = true;
  let running = false;
  const refresh = async () => {
    if (running || document.visibilityState === 'hidden') return;
    running = true;
    try {
      const saved = await fetchSharedTechMessages(orgId);
      if (active) { saveTechModeMessages(orgId, saved.messages); saveStageRequestMessages(orgId, saved.stageRequests); }
    } catch { /* Keep the last acknowledged cache during connection loss. */ }
    finally { running = false; }
  };
  void refresh();
  const timer = window.setInterval(() => void refresh(), 30000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
}
