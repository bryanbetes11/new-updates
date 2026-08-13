import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, ChevronDown, LayoutGrid, List, Loader2, RefreshCw, RotateCcw, Save, Send, ShieldAlert, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getBuiltInNotificationCopy } from '../../lib/notificationCopy';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

type Rule = {
  id: string;
  type: string;
  label: string;
  category: string;
  description: string;
  target_roles: string[];
  enabled: boolean;
  required: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
  priority: Priority;
  reminder_offsets: number[];
  template_title: string | null;
  template_body: string | null;
};

type SystemSettings = {
  push_delivery_enabled: boolean;
  default_timezone: string;
};

type PushReadinessMember = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  ministry_status: string;
  is_onboarded: boolean;
  subscription_count: number;
  preference_enabled: boolean;
  push_ready: boolean;
  last_push_status: string | null;
  last_push_sent_at: string | null;
};

const categoryLabels: Record<string, string> = {
  assignments: 'Assignments', events: 'Events', attendance: 'Attendance',
  deadlines: 'Deadlines', setlists: 'Setlists', communication: 'Communication',
  requests: 'Requests', members: 'People & roles', accountability: 'Accountability', system: 'System',
};

export function NotificationSettings() {
  const { user, profile, organization, isOrgAdmin, isPlatformOwner } = useAuth();
  const canManageNotifications = isOrgAdmin || isPlatformOwner;
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({ push_delivery_enabled: true, default_timezone: 'Asia/Manila' });
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [dirtyCategories, setDirtyCategories] = useState<Set<string>>(() => new Set());
  const [pushReadiness, setPushReadiness] = useState<PushReadinessMember[]>([]);
  const [hasDetailedReadiness, setHasDetailedReadiness] = useState(true);
  const [refreshingReadiness, setRefreshingReadiness] = useState(false);
  const [testingMemberId, setTestingMemberId] = useState<string | null>(null);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'controls'>('status');
  const [memberView, setMemberView] = useState<'list' | 'grid'>(() => localStorage.getItem('notificationMemberView') === 'grid' ? 'grid' : 'list');

  const loadRosterFallback = async () => {
    if (!profile?.org_id) return [] as PushReadinessMember[];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, ministry_status, is_onboarded')
      .eq('org_id', profile.org_id)
      .eq('is_onboarded', true)
      .eq('ministry_status', 'active')
      .order('first_name')
      .order('last_name');
    if (error) return [] as PushReadinessMember[];
    return (data || []).map(member => ({
      user_id: member.id,
      first_name: member.first_name || '',
      last_name: member.last_name || '',
      email: member.email || '',
      ministry_status: member.ministry_status || 'active',
      is_onboarded: member.is_onboarded ?? true,
      subscription_count: 0,
      preference_enabled: true,
      push_ready: false,
      last_push_status: null,
      last_push_sent_at: null,
    }));
  };

  useEffect(() => {
    if (!profile?.org_id || !canManageNotifications) return;
    let active = true;
    const load = async () => {
      const [settingsResult, rulesResult, readinessResult] = await Promise.all([
        supabase.from('notification_system_settings').select('push_delivery_enabled, default_timezone').eq('org_id', profile.org_id).maybeSingle(),
        supabase.from('notification_rules').select('*').eq('org_id', profile.org_id).order('category').order('label'),
        supabase.rpc('get_org_push_readiness'),
      ]);
      if (!active) return;
      if (settingsResult.error || rulesResult.error) toast('error', 'Could not load notification controls');
      else {
        if (settingsResult.data) setSettings(settingsResult.data as SystemSettings);
        setRules((rulesResult.data || []) as Rule[]);
      }
      const readinessMembers = (readinessResult.data || []) as PushReadinessMember[];
      const hasDetailedData = !readinessResult.error && readinessMembers.length > 0;
      setHasDetailedReadiness(hasDetailedData);
      setPushReadiness(hasDetailedData ? readinessMembers : await loadRosterFallback());
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [canManageNotifications, profile?.org_id, toast]);

  useEffect(() => { localStorage.setItem('notificationMemberView', memberView); }, [memberView]);

  const groupedRules = useMemo(() => rules.reduce<Record<string, Rule[]>>((groups, rule) => {
    (groups[rule.category] ||= []).push(rule);
    return groups;
  }, {}), [rules]);

  const patchRule = (id: string, patch: Partial<Rule>) => {
    setRules(current => current.map(rule => {
      if (rule.id !== id) return rule;
      setDirtyCategories(categories => new Set(categories).add(rule.category));
      return { ...rule, ...patch };
    }));
  };

  const saveSettings = async () => {
    if (!profile?.org_id || !user) return;
    setSavingSection('settings');
    const { error } = await supabase.from('notification_system_settings').update({
      ...settings,
      updated_by: user.id,
    }).eq('org_id', profile.org_id);
    setSavingSection(null);
    if (error) toast('error', 'Notification settings could not be saved');
    else {
      setSettingsDirty(false);
      toast('success', 'Notification settings saved');
    }
  };

  const saveCategory = async (category: string, categoryRules: Rule[]) => {
    if (!user) return;
    setSavingSection(category);
    const results = await Promise.all(categoryRules.map(rule => supabase.from('notification_rules').update({
      enabled: rule.enabled,
      required: rule.required,
      in_app_enabled: rule.in_app_enabled,
      push_enabled: rule.push_enabled,
      priority: rule.priority,
      template_title: rule.template_title || null,
      template_body: rule.template_body || null,
      updated_by: user.id,
    }).eq('id', rule.id)));
    setSavingSection(null);
    if (results.some(result => result.error)) toast('error', `${categoryLabels[category] || category} changes could not be saved`);
    else {
      setDirtyCategories(categories => {
        const next = new Set(categories);
        next.delete(category);
        return next;
      });
      toast('success', `${categoryLabels[category] || category} changes saved`);
    }
  };

  const refreshPushReadiness = async () => {
    setRefreshingReadiness(true);
    const { data, error } = await supabase.rpc('get_org_push_readiness');
    setRefreshingReadiness(false);
    if (error || !data?.length) {
      setPushReadiness(await loadRosterFallback());
      setHasDetailedReadiness(false);
    } else {
      setPushReadiness((data || []) as PushReadinessMember[]);
      setHasDetailedReadiness(true);
    }
  };

  const sendPushTest = async (member: PushReadinessMember) => {
    setTestingMemberId(member.user_id);
    const { error } = await supabase.rpc('send_push_readiness_test', { p_user_id: member.user_id });
    setTestingMemberId(null);
    if (error) {
      toast('error', 'Could not send the notification test');
      return;
    }
    toast('success', `Notification test sent to ${member.first_name}`);
    window.setTimeout(refreshPushReadiness, 1200);
  };

  const sendRuleTest = async (rule: Rule) => {
    const builtIn = getBuiltInNotificationCopy(rule.type, rule.label, rule.description);
    setTestingRuleId(rule.id);
    const { error } = await supabase.rpc('send_notification_template_test_to_admin_dev', {
      p_rule_type: rule.type,
      p_title: rule.template_title ?? builtIn.title,
      p_body: rule.template_body ?? builtIn.body,
    });
    setTestingRuleId(null);
    if (error) toast('error', 'Could not send the template test to Admin Dev');
    else toast('success', 'Test sent to Admin Dev using the current title and message');
  };

  if (!canManageNotifications) return null;
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;

  return (
    <div className="app-content-shell space-y-5 py-4 sm:py-5">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-gray-200/80 bg-gray-100 p-1 dark:border-white/[0.06] dark:bg-white/[0.04]">
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${activeTab === 'status' ? 'bg-white text-gray-950 shadow-sm dark:bg-white/[0.1] dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-white/45 dark:hover:text-white/75'}`}
        >
          Member Status
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('controls')}
          className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${activeTab === 'controls' ? 'bg-white text-gray-950 shadow-sm dark:bg-white/[0.1] dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-white/45 dark:hover:text-white/75'}`}
        >
          Notification Controls
        </button>
      </div>

      {activeTab === 'status' && (
        <PushReadinessPanel
          members={pushReadiness}
          refreshing={refreshingReadiness}
          testingMemberId={testingMemberId}
          hasDetailedReadiness={hasDetailedReadiness}
          view={memberView}
          onViewChange={setMemberView}
          onRefresh={refreshPushReadiness}
          onTest={sendPushTest}
        />
      )}

      {activeTab === 'controls' && <>
      <section className="overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-white shadow-sm dark:border-emerald-400/10 dark:bg-white/[0.025]">
        <div className="bg-gradient-to-br from-emerald-50 to-white px-5 py-5 dark:from-emerald-400/[0.08] dark:to-transparent sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><BellRing className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-black text-gray-950 dark:text-white">Notification control center</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-white/45">Decide which alerts {organization?.name || 'your church'} sends, where they appear, and how urgent they are.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 border-t border-gray-100 px-5 py-5 dark:border-white/[0.06] sm:grid-cols-2 sm:px-6">
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.035]">
            <span><span className="block text-sm font-bold text-gray-900 dark:text-white">Send push alerts</span><span className="text-xs text-gray-500 dark:text-white/40">Master switch for the organization</span></span>
            <input type="checkbox" checked={settings.push_delivery_enabled} onChange={event => { setSettings(current => ({ ...current, push_delivery_enabled: event.target.checked })); setSettingsDirty(true); }} className="h-5 w-5 accent-emerald-600" />
          </label>
          <label className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.035]">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">Default timezone</span>
            <select value={settings.default_timezone} onChange={event => { setSettings(current => ({ ...current, default_timezone: event.target.value })); setSettingsDirty(true); }} className="mt-1 w-full bg-transparent text-sm font-bold text-gray-900 outline-none dark:text-white">
              <option value="Asia/Manila">Philippines (Asia/Manila)</option>
              <option value="Asia/Singapore">Singapore (Asia/Singapore)</option>
              <option value="UTC">UTC</option>
              <option value="America/Los_Angeles">US Pacific</option>
              <option value="America/New_York">US Eastern</option>
            </select>
          </label>
        </div>
        {settingsDirty && (
          <div className="flex justify-end border-t border-gray-100 px-5 py-3 dark:border-white/[0.06] sm:px-6">
            <button type="button" onClick={saveSettings} disabled={savingSection === 'settings'} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-60">
              {savingSection === 'settings' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </button>
          </div>
        )}
      </section>

      {Object.entries(groupedRules).map(([category, categoryRules]) => (
        <details key={category} className="group/category overflow-hidden rounded-[1.7rem] border border-gray-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-white/[0.025]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none">
            <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-gray-700 dark:text-white/70">{categoryLabels[category] || category}</h3>
            <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-white/40">{categoryRules.length} alerts</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open/category:rotate-180" />
          </summary>
          <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-white/[0.05] dark:border-white/[0.06]">
            {categoryRules.map(rule => (
              <details key={rule.id} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-black text-gray-950 dark:text-white">{rule.label}{rule.required && <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}</span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-white/40">{rule.description}</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-white/45" onClick={event => event.stopPropagation()}>
                    Active <input type="checkbox" checked={rule.enabled} onChange={event => patchRule(rule.id, { enabled: event.target.checked })} className="h-5 w-5 accent-emerald-600" />
                  </label>
                  <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
                </summary>
                <div className="mt-4 grid gap-4 rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.035] sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="flex items-center justify-between text-sm font-bold text-gray-700 dark:text-white/65">Show in app <input type="checkbox" checked={rule.in_app_enabled} onChange={event => patchRule(rule.id, { in_app_enabled: event.target.checked })} className="h-5 w-5 accent-emerald-600" /></label>
                    <label className="flex items-center justify-between text-sm font-bold text-gray-700 dark:text-white/65">Send push <input type="checkbox" checked={rule.push_enabled} onChange={event => patchRule(rule.id, { push_enabled: event.target.checked })} className="h-5 w-5 accent-emerald-600" /></label>
                    <label className="flex items-center justify-between text-sm font-bold text-gray-700 dark:text-white/65">Required notice <input type="checkbox" checked={rule.required} onChange={event => patchRule(rule.id, { required: event.target.checked, in_app_enabled: event.target.checked || rule.in_app_enabled })} className="h-5 w-5 accent-amber-500" /></label>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">Priority
                      <select value={rule.priority} onChange={event => patchRule(rule.id, { priority: event.target.value as Priority })} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white">
                        <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                      </select>
                    </label>
                  </div>
                  <NotificationCopyEditor rule={rule} patchRule={patchRule} testing={testingRuleId === rule.id} onTest={() => sendRuleTest(rule)} />
                </div>
              </details>
            ))}
            {dirtyCategories.has(category) && (
              <div className="flex justify-end px-5 py-3">
                <button type="button" onClick={() => saveCategory(category, categoryRules)} disabled={savingSection === category} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-60">
                  {savingSection === category ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
                </button>
              </div>
            )}
          </div>
        </details>
      ))}
      </>}
    </div>
  );
}

function PushReadinessPanel({
  members,
  refreshing,
  testingMemberId,
  hasDetailedReadiness,
  view,
  onViewChange,
  onRefresh,
  onTest,
}: {
  members: PushReadinessMember[];
  refreshing: boolean;
  testingMemberId: string | null;
  hasDetailedReadiness: boolean;
  view: 'list' | 'grid';
  onViewChange: (view: 'list' | 'grid') => void;
  onRefresh: () => void;
  onTest: (member: PushReadinessMember) => void;
}) {
  const onboarded = members.filter(member => member.is_onboarded && member.ministry_status === 'active');
  const readyCount = onboarded.filter(member => member.push_ready).length;
  const needsSetup = onboarded.filter(member => !member.push_ready);

  return (
    <section>
      <div className="flex items-start justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-gray-950 dark:text-white">Member Notification Status</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-white/40">Current push-notification readiness for active members, across all ServeSync features.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center rounded-full border border-gray-200 p-1 dark:border-white/10 sm:flex">
            <button type="button" onClick={() => onViewChange('list')} aria-label="List view" aria-pressed={view === 'list'} className={`flex h-8 w-8 items-center justify-center rounded-full ${view === 'list' ? 'bg-emerald-500 text-black' : 'text-white/55'}`}><List className="h-4 w-4" /></button>
            <button type="button" onClick={() => onViewChange('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} className={`flex h-8 w-8 items-center justify-center rounded-full ${view === 'grid' ? 'bg-emerald-500 text-black' : 'text-white/55'}`}><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh member notification status" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-black text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.05]">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-y border-gray-100 py-4 dark:border-white/[0.06]">
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-400/[0.07]">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          <div><p className="text-lg font-black text-emerald-800 dark:text-emerald-200">{readyCount}</p><p className="text-xs font-bold text-emerald-700/65 dark:text-emerald-200/55">Ready for push</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-400/[0.07]">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <div><p className="text-lg font-black text-amber-800 dark:text-amber-200">{needsSetup.length}</p><p className="text-xs font-bold text-amber-700/65 dark:text-amber-200/55">Needs setup</p></div>
        </div>
      </div>

      {!hasDetailedReadiness && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200/75">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Showing the active member roster. Detailed device and notification status will appear after the pending Supabase access update is deployed.</span>
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${view === 'list' ? 'sm:block sm:overflow-hidden sm:rounded-2xl sm:border sm:border-gray-200/80 sm:bg-white sm:divide-y sm:divide-gray-100 sm:dark:border-white/[0.06] sm:dark:bg-white/[0.025] sm:dark:divide-white/[0.05]' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {onboarded.map(member => {
          const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email;
          const lastSuccess = member.last_push_sent_at
            ? new Date(member.last_push_sent_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
            : 'No successful delivery yet';
          const statusText = member.push_ready
            ? member.last_push_status === 'failed'
              ? 'Registered device · Latest delivery failed'
              : `Ready · ${member.subscription_count} device${member.subscription_count === 1 ? '' : 's'}`
            : member.preference_enabled ? 'No registered device' : 'Push preference disabled';
          return (
            <div key={member.user_id} className={`flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.025] ${view === 'list' ? 'sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 sm:py-3.5 sm:dark:bg-transparent' : ''}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${member.push_ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-950 dark:text-white">{name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-white/40">{statusText} · {lastSuccess}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-white/30">{member.email}</p>
              </div>
              {hasDetailedReadiness && (
                <button
                  type="button"
                  onClick={() => onTest(member)}
                  disabled={testingMemberId === member.user_id || !member.push_ready}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-white dark:text-black dark:hover:bg-white/85"
                >
                  {testingMemberId === member.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Test
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NotificationCopyEditor({
  rule,
  patchRule,
  testing,
  onTest,
}: {
  rule: Rule;
  patchRule: (id: string, patch: Partial<Rule>) => void;
  testing: boolean;
  onTest: () => void;
}) {
  const builtIn = getBuiltInNotificationCopy(rule.type, rule.label, rule.description);
  const hasCustomTitle = rule.template_title !== null;
  const hasCustomBody = rule.template_body !== null;
  const availableValues = Array.from(new Set(`${builtIn.title} ${builtIn.body}`.match(/\[[^\]]+\]/g) || []));

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
        <span className="flex items-center justify-between gap-3">
          <span>{hasCustomTitle ? 'Custom title' : 'Current built-in title'}</span>
          {hasCustomTitle && (
            <button type="button" onClick={() => patchRule(rule.id, { template_title: null })} className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 hover:text-emerald-700 dark:text-emerald-300">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </span>
        <input
          value={rule.template_title ?? builtIn.title}
          onChange={event => patchRule(rule.id, { template_title: event.target.value })}
          className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm text-gray-900 dark:text-white ${hasCustomTitle ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06]' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.05]'}`}
        />
      </label>
      <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
        <span className="flex items-center justify-between gap-3">
          <span>{hasCustomBody ? 'Custom message' : 'Current built-in message'}</span>
          {hasCustomBody && (
            <button type="button" onClick={() => patchRule(rule.id, { template_body: null })} className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 hover:text-emerald-700 dark:text-emerald-300">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </span>
        <textarea
          value={rule.template_body ?? builtIn.body}
          onChange={event => patchRule(rule.id, { template_body: event.target.value })}
          rows={3}
          className={`mt-1.5 w-full resize-none rounded-xl border px-3 py-2 text-sm text-gray-900 dark:text-white ${hasCustomBody ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06]' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.05]'}`}
        />
      </label>
      {availableValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 dark:text-white/35">
          <span className="mr-1 font-bold uppercase tracking-wide">Values for this alert</span>
          {availableValues.map(value => <code key={value} className="rounded-md bg-gray-100 px-1.5 py-1 font-bold text-gray-600 dark:bg-white/[0.06] dark:text-white/55">{value}</code>)}
        </div>
      )}
      <p className="text-[11px] leading-4 text-gray-400 dark:text-white/30">
        {hasCustomTitle || hasCustomBody ? 'Custom wording will replace the built-in wording after you save. ' : 'This is the wording ServeSync currently builds automatically. '}
        Values in brackets are filled from the event or member involved. Audience: {rule.target_roles.join(', ') || 'Applicable members'}.
      </p>
      <button type="button" onClick={onTest} disabled={testing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-500/[0.14] disabled:opacity-60 dark:text-emerald-300">
        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test to Admin Dev
      </button>
    </div>
  );
}
