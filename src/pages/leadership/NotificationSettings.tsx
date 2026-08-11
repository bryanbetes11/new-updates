import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, ChevronDown, Loader2, RefreshCw, RotateCcw, Save, Send, ShieldAlert, Smartphone } from 'lucide-react';
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
  const { user, profile, organization, isOrgAdmin } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({ push_delivery_enabled: true, default_timezone: 'Asia/Manila' });
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushReadiness, setPushReadiness] = useState<PushReadinessMember[]>([]);
  const [refreshingReadiness, setRefreshingReadiness] = useState(false);
  const [testingMemberId, setTestingMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'controls'>('status');

  useEffect(() => {
    if (!profile?.org_id || !isOrgAdmin) return;
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
        setPushReadiness((readinessResult.data || []) as PushReadinessMember[]);
      }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [isOrgAdmin, profile?.org_id, toast]);

  const groupedRules = useMemo(() => rules.reduce<Record<string, Rule[]>>((groups, rule) => {
    (groups[rule.category] ||= []).push(rule);
    return groups;
  }, {}), [rules]);

  const patchRule = (id: string, patch: Partial<Rule>) => {
    setRules(current => current.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
  };

  const refreshPushReadiness = async () => {
    setRefreshingReadiness(true);
    const { data, error } = await supabase.rpc('get_org_push_readiness');
    setRefreshingReadiness(false);
    if (error) toast('error', 'Could not refresh push readiness');
    else setPushReadiness((data || []) as PushReadinessMember[]);
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

  const save = async () => {
    if (!profile?.org_id || !user) return;
    setSaving(true);
    const settingsPromise = supabase.from('notification_system_settings').update({
      ...settings,
      updated_by: user.id,
    }).eq('org_id', profile.org_id);
    const rulePromises = rules.map(rule => supabase.from('notification_rules').update({
      enabled: rule.enabled,
      required: rule.required,
      in_app_enabled: rule.in_app_enabled,
      push_enabled: rule.push_enabled,
      priority: rule.priority,
      template_title: rule.template_title || null,
      template_body: rule.template_body || null,
      updated_by: user.id,
    }).eq('id', rule.id));
    const results = await Promise.all([settingsPromise, ...rulePromises]);
    setSaving(false);
    if (results.some(result => result.error)) toast('error', 'Some notification controls could not be saved');
    else toast('success', 'Notification controls saved');
  };

  if (!isOrgAdmin) return null;
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-5">
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
            <input type="checkbox" checked={settings.push_delivery_enabled} onChange={event => setSettings(current => ({ ...current, push_delivery_enabled: event.target.checked }))} className="h-5 w-5 accent-emerald-600" />
          </label>
          <label className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.035]">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">Default timezone</span>
            <select value={settings.default_timezone} onChange={event => setSettings(current => ({ ...current, default_timezone: event.target.value }))} className="mt-1 w-full bg-transparent text-sm font-bold text-gray-900 outline-none dark:text-white">
              <option value="Asia/Manila">Philippines (Asia/Manila)</option>
              <option value="Asia/Singapore">Singapore (Asia/Singapore)</option>
              <option value="UTC">UTC</option>
              <option value="America/Los_Angeles">US Pacific</option>
              <option value="America/New_York">US Eastern</option>
            </select>
          </label>
        </div>
      </section>

      {Object.entries(groupedRules).map(([category, categoryRules]) => (
        <section key={category} className="overflow-hidden rounded-[1.7rem] border border-gray-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
            <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-gray-700 dark:text-white/70">{categoryLabels[category] || category}</h3>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-white/40">{categoryRules.length} alerts</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
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
                  <NotificationCopyEditor rule={rule} patchRule={patchRule} />
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <button type="button" onClick={save} disabled={saving} className="sticky bottom-5 z-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-700/20 transition hover:bg-emerald-700 disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save notification controls
      </button>
      </>}
    </div>
  );
}

function PushReadinessPanel({
  members,
  refreshing,
  testingMemberId,
  onRefresh,
  onTest,
}: {
  members: PushReadinessMember[];
  refreshing: boolean;
  testingMemberId: string | null;
  onRefresh: () => void;
  onTest: (member: PushReadinessMember) => void;
}) {
  const onboarded = members.filter(member => member.is_onboarded && member.ministry_status === 'active');
  const readyCount = onboarded.filter(member => member.push_ready).length;
  const needsSetup = onboarded.filter(member => !member.push_ready);

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-gray-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-white/[0.025]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
            <Smartphone className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-gray-950 dark:text-white">Member Notification Status</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-white/40">Current push-notification readiness for active members, across all ServeSync features.</p>
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/[0.05]">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06] sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-400/[0.07]">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          <div><p className="text-lg font-black text-emerald-800 dark:text-emerald-200">{readyCount}</p><p className="text-xs font-bold text-emerald-700/65 dark:text-emerald-200/55">Ready for push</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 dark:bg-amber-400/[0.07]">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <div><p className="text-lg font-black text-amber-800 dark:text-amber-200">{needsSetup.length}</p><p className="text-xs font-bold text-amber-700/65 dark:text-amber-200/55">Needs setup</p></div>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
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
            <div key={member.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className={`h-2.5 w-2.5 rounded-full ${member.push_ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-950 dark:text-white">{name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-white/40">{statusText} · {lastSuccess}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-white/30">{member.email}</p>
              </div>
              <button
                type="button"
                onClick={() => onTest(member)}
                disabled={testingMemberId === member.user_id}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/85"
              >
                {testingMemberId === member.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Test
              </button>
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
}: {
  rule: Rule;
  patchRule: (id: string, patch: Partial<Rule>) => void;
}) {
  const builtIn = getBuiltInNotificationCopy(rule.type, rule.label, rule.description);
  const hasCustomTitle = rule.template_title !== null;
  const hasCustomBody = rule.template_body !== null;

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
      <p className="text-[11px] leading-4 text-gray-400 dark:text-white/30">
        {hasCustomTitle || hasCustomBody ? 'Custom wording will replace the built-in wording after you save. ' : 'This is the wording ServeSync currently builds automatically. '}
        Values in brackets are filled from the event or member involved. Audience: {rule.target_roles.join(', ') || 'Applicable members'}.
      </p>
    </div>
  );
}
