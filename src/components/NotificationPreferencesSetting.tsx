import { useEffect, useMemo, useState } from 'react';
import { BellRing, ChevronDown, Clock3, Loader2, Save, ShieldCheck, Volume2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { playInteractionSound, setInteractionSoundsEnabled } from '../lib/interactionSounds';

type Rule = {
  type: string;
  label: string;
  category: string;
  description: string;
  enabled: boolean;
  required: boolean;
  in_app_enabled: boolean;
  push_enabled: boolean;
};

type Preference = {
  in_app_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  muted_types: string[];
  sound_effects_enabled: boolean;
};

const defaultPreference: Preference = {
  in_app_enabled: true,
  quiet_hours_enabled: false,
  quiet_start: '21:00',
  quiet_end: '07:00',
  timezone: 'Asia/Manila',
  muted_types: [],
  sound_effects_enabled: true,
};

const categoryLabels: Record<string, string> = {
  assignments: 'Assignments',
  events: 'Events',
  attendance: 'Attendance',
  deadlines: 'Deadlines',
  setlists: 'Setlists',
  communication: 'Communication',
  requests: 'Requests',
  members: 'People & roles',
  accountability: 'Accountability',
  system: 'System',
};

export function NotificationPreferencesSetting() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [preference, setPreference] = useState<Preference>(defaultPreference);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !profile?.org_id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const [rulesResult, preferenceResult] = await Promise.all([
        supabase
          .from('notification_rules')
          .select('type, label, category, description, enabled, required, in_app_enabled, push_enabled')
          .eq('org_id', profile.org_id)
          .eq('enabled', true)
          .order('category')
          .order('label'),
        supabase
          .from('notification_preferences')
          .select('in_app_enabled, quiet_hours_enabled, quiet_start, quiet_end, timezone, muted_types, sound_effects_enabled')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (!active) return;
      if (rulesResult.error || preferenceResult.error) {
        toast('error', 'Could not load notification preferences');
      } else {
        setRules((rulesResult.data || []) as Rule[]);
        if (preferenceResult.data) {
          setPreference({
            ...defaultPreference,
            ...preferenceResult.data,
            quiet_start: String(preferenceResult.data.quiet_start).slice(0, 5),
            quiet_end: String(preferenceResult.data.quiet_end).slice(0, 5),
            muted_types: preferenceResult.data.muted_types || [],
          });
        }
      }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [profile?.org_id, toast, user]);

  const groupedRules = useMemo(() => {
    return rules.reduce<Record<string, Rule[]>>((groups, rule) => {
      (groups[rule.category] ||= []).push(rule);
      return groups;
    }, {});
  }, [rules]);

  const toggleType = (type: string) => {
    setPreference(current => ({
      ...current,
      muted_types: current.muted_types.includes(type)
        ? current.muted_types.filter(item => item !== type)
        : [...current.muted_types, type],
    }));
  };

  const save = async () => {
    if (!user || !profile?.org_id) return;
    setSaving(true);
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      org_id: profile.org_id,
      ...preference,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) toast('error', 'Could not save notification preferences');
    else toast('success', 'Notification preferences saved');
  };

  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-3xl border border-gray-200/80 bg-white dark:border-white/[0.06] dark:bg-white/[0.025]">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-white/[0.025]">
      <div className="border-b border-gray-100 px-5 py-5 dark:border-white/[0.06]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-black text-gray-950 dark:text-white">What should reach you</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-white/45">Choose optional alerts. Essential schedule and accountability notices always stay on.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-5 py-5">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-bold text-gray-900 dark:text-white">In-app notifications</span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-white/45">Show optional alerts in the notification center</span>
          </span>
          <input
            type="checkbox"
            checked={preference.in_app_enabled}
            onChange={event => setPreference(current => ({ ...current, in_app_enabled: event.target.checked }))}
            className="h-5 w-5 rounded border-gray-300 accent-emerald-600"
          />
        </label>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.035]">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"><Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> Interaction sounds</span>
            <span className="mt-0.5 block text-xs leading-5 text-gray-500 dark:text-white/45">Low-volume feedback for navigation, buttons, message long-presses, and reactions. It stays on this device and never sends messages or notifications.</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => playInteractionSound('reactionLand')} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-400/10">Test sound</button>
            <input
              type="checkbox"
              checked={preference.sound_effects_enabled}
              onChange={event => {
                const sound_effects_enabled = event.target.checked;
                setPreference(current => ({ ...current, sound_effects_enabled }));
                setInteractionSoundsEnabled(sound_effects_enabled);
              }}
              className="h-5 w-5 shrink-0 rounded border-gray-300 accent-emerald-600"
            />
          </span>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.035]">
          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Clock3 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> Quiet hours
            </span>
            <input
              type="checkbox"
              checked={preference.quiet_hours_enabled}
              onChange={event => setPreference(current => ({ ...current, quiet_hours_enabled: event.target.checked }))}
              className="h-5 w-5 rounded border-gray-300 accent-emerald-600"
            />
          </label>
          {preference.quiet_hours_enabled && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
                From
                <input type="time" value={preference.quiet_start} onChange={event => setPreference(current => ({ ...current, quiet_start: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white" />
              </label>
              <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
                Until
                <input type="time" value={preference.quiet_end} onChange={event => setPreference(current => ({ ...current, quiet_end: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white" />
              </label>
              <label className="col-span-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-white/35">
                Timezone
                <select value={preference.timezone} onChange={event => setPreference(current => ({ ...current, timezone: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white">
                  <option value="Asia/Manila">Philippines (Asia/Manila)</option>
                  <option value="Asia/Singapore">Singapore (Asia/Singapore)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/Los_Angeles">US Pacific</option>
                  <option value="America/New_York">US Eastern</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {Object.entries(groupedRules).map(([category, categoryRules]) => (
            <details key={category} className="group overflow-hidden rounded-2xl border border-gray-100 dark:border-white/[0.06]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-white/45">{categoryLabels[category] || category}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-white/40">{categoryRules.length}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-white/[0.05] dark:border-white/[0.06]">
                {categoryRules.map(rule => {
                  const available = rule.in_app_enabled || rule.push_enabled;
                  const enabled = rule.required || !preference.muted_types.includes(rule.type);
                  return (
                    <label key={rule.type} className="flex items-center gap-3 px-3.5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[13px] font-bold text-gray-900 dark:text-white">
                          {rule.label}
                          {rule.required && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-gray-500 dark:text-white/40">{rule.description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={enabled && available}
                        disabled={rule.required || !available}
                        onChange={() => toggleType(rule.type)}
                        className="h-5 w-5 rounded border-gray-300 accent-emerald-600 disabled:opacity-50"
                      />
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>

        <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save preferences
        </button>
      </div>
    </section>
  );
}
