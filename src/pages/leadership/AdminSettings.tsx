import { useEffect, useState } from 'react';
import { CalendarClock, Clock3, Loader2, Music2, Save, ScanLine, Settings2, ShieldCheck, Trash2, UserCheck } from '../../lib/lucide-react-proxy';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DEFAULT_EVENT_TEMPLATE_POLICIES, normalizeEventTemplatePolicies, type EventTemplatePolicies, type SetlistSubmissionMode } from '../../lib/eventPolicy';

type PolicySettings = {
  org_id: string;
  attendance_open_minutes_before: number;
  attendance_grace_minutes: number;
  attendance_scan_session_minutes: number;
  attendance_incomplete_scan_minutes: number;
  attendance_pre_start_reminder_minutes: number;
  attendance_auto_absent_after_days: number;
  default_setlist_due_days_before: number;
  event_templates: EventTemplatePolicies;
  setlist_submission_mode: SetlistSubmissionMode;
  setlist_reminder_policy: SetlistReminderPolicy;
  leave_policy: LeavePolicy;
};

type SetlistReminderPolicy = {
  enabled: boolean;
  seven_days: boolean;
  three_days: boolean;
  day_before: boolean;
  due_day: boolean;
  overdue: boolean;
  leadership_escalation: boolean;
};

type LeavePolicy = {
  approval_required: boolean;
  reason_required: boolean;
  allow_date_ranges: boolean;
  minimum_notice_days: number;
  allow_swap_requests: boolean;
  require_swap_reason: boolean;
};

const defaultSetlistReminderPolicy: SetlistReminderPolicy = {
  enabled: true,
  seven_days: true,
  three_days: true,
  day_before: true,
  due_day: true,
  overdue: true,
  leadership_escalation: true,
};

const defaultLeavePolicy: LeavePolicy = {
  approval_required: true,
  reason_required: true,
  allow_date_ranges: true,
  minimum_notice_days: 0,
  allow_swap_requests: true,
  require_swap_reason: true,
};

const fallbackPolicy: Omit<PolicySettings, 'org_id'> = {
  attendance_open_minutes_before: 30,
  attendance_grace_minutes: 5,
  attendance_scan_session_minutes: 5,
  attendance_incomplete_scan_minutes: 2,
  attendance_pre_start_reminder_minutes: 5,
  attendance_auto_absent_after_days: 2,
  default_setlist_due_days_before: 21,
  event_templates: DEFAULT_EVENT_TEMPLATE_POLICIES,
  setlist_submission_mode: 'block_rejected',
  setlist_reminder_policy: defaultSetlistReminderPolicy,
  leave_policy: defaultLeavePolicy,
};

function PolicyNumber({ label, detail, value, min, max, unit = 'minutes', onChange }: { label: string; detail: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="block rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
      <span className="block text-sm font-bold text-gray-900 dark:text-white">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-white/45">{detail}</span>
      <div className="mt-3 flex items-center gap-2">
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} className="input-field h-10 w-24 text-sm font-bold" />
        <span className="text-xs font-semibold text-gray-500 dark:text-white/45">{unit}</span>
      </div>
    </label>
  );
}

function PolicyToggle({ label, detail, checked, disabled, onChange }: { label: string; detail: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${disabled ? 'cursor-not-allowed opacity-45' : 'border-gray-200/80 bg-gray-50/70 hover:border-emerald-400/45 dark:border-white/[0.07] dark:bg-white/[0.035]'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
      <span className="min-w-0"><span className="block text-sm font-bold text-gray-900 dark:text-white">{label}</span><span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-white/45">{detail}</span></span>
    </label>
  );
}

export function AdminSettings() {
  const { profile, user, isOrgAdmin, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const [policy, setPolicy] = useState<PolicySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEventType, setNewEventType] = useState('');

  useEffect(() => {
    if (!profile?.org_id || !(isOrgAdmin || isPlatformOwner)) return;
    const orgId = profile.org_id;
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('organization_policy_settings').select('*').eq('org_id', orgId).maybeSingle();
      if (!active) return;
      if (error) toast('error', 'Could not load organization policies');
      const saved = data as (Omit<PolicySettings, 'event_templates' | 'setlist_reminder_policy' | 'leave_policy'> & { event_templates?: unknown; setlist_reminder_policy?: Partial<SetlistReminderPolicy> | null; leave_policy?: Partial<LeavePolicy> | null }) | null;
      setPolicy(saved ? {
        ...saved,
        event_templates: normalizeEventTemplatePolicies(saved.event_templates),
        setlist_reminder_policy: { ...defaultSetlistReminderPolicy, ...(saved.setlist_reminder_policy || {}) },
        leave_policy: { ...defaultLeavePolicy, ...(saved.leave_policy || {}) },
      } : { org_id: orgId, ...fallbackPolicy });
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [isOrgAdmin, isPlatformOwner, profile?.org_id, toast]);

  const updatePolicy = (key: keyof Omit<PolicySettings, 'org_id'>, value: number) => setPolicy(current => current ? { ...current, [key]: value } : current);
  const updateTemplate = (eventType: string, key: 'start_time' | 'end_time' | 'setlist_due_days_before', value: string) => setPolicy(current => {
    if (!current) return current;
    const currentTemplate = current.event_templates[eventType] || DEFAULT_EVENT_TEMPLATE_POLICIES[eventType];
    if (!currentTemplate) return current;
    return {
      ...current,
      event_templates: {
        ...current.event_templates,
        [eventType]: {
          ...currentTemplate,
          [key]: key === 'setlist_due_days_before' ? (value === '' ? null : Math.min(90, Math.max(0, Number(value) || 0))) : value,
        },
      },
    };
  });

  const updateSetlistReminder = (key: keyof SetlistReminderPolicy, value: boolean) => setPolicy(current => current ? {
    ...current,
    setlist_reminder_policy: { ...current.setlist_reminder_policy, [key]: value },
  } : current);

  const updateLeavePolicy = <Key extends keyof LeavePolicy>(key: Key, value: LeavePolicy[Key]) => setPolicy(current => current ? {
    ...current,
    leave_policy: { ...current.leave_policy, [key]: value },
  } : current);

  const savePolicy = async () => {
    if (!policy || !user) return;
    setSaving(true);
    const { error } = await supabase.from('organization_policy_settings').upsert({ ...policy, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'org_id' });
    setSaving(false);
    if (error) toast('error', 'Attendance policy could not be saved');
    else toast('success', 'Organization policy saved — new check-ins and reminders use it immediately.');
  };

  const addEventType = () => {
    const name = newEventType.trim();
    if (!name) return;
    if (name.length > 60) { toast('error', 'Event type names can be up to 60 characters'); return; }
    if (policy?.event_templates[name]) { toast('error', 'That event type already exists'); return; }
    setPolicy(current => current ? {
      ...current,
      event_templates: {
        ...current.event_templates,
        [name]: { start_time: '', end_time: '', setlist_due_days_before: null, service_format: 'custom' },
      },
    } : current);
    setNewEventType('');
  };

  const deleteEventType = async (eventType: string) => {
    if (DEFAULT_EVENT_TEMPLATE_POLICIES[eventType]) {
      toast('error', 'Built-in event types are protected. You can change their defaults, but not remove them.');
      return;
    }
    const { count, error } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_type', eventType);
    if (error) { toast('error', 'Could not check whether this event type is in use'); return; }
    if ((count || 0) > 0) {
      toast('error', `${eventType} is used by ${count} event${count === 1 ? '' : 's'}. Reassign or remove those events first.`);
      return;
    }
    setPolicy(current => {
      if (!current) return current;
      const nextTemplates = { ...current.event_templates };
      delete nextTemplates[eventType];
      return { ...current, event_templates: nextTemplates };
    });
    toast('success', `${eventType} removed. Save defaults to apply the change.`);
  };

  if (!(isOrgAdmin || isPlatformOwner)) return <div className="page-container page-bottom-pad"><div className="mx-auto flex min-h-[42vh] max-w-xl items-center justify-center text-center"><div><ShieldCheck className="mx-auto h-10 w-10 text-slate-400" /><h1 className="mt-3 text-lg font-black text-gray-900 dark:text-white">Admin access required</h1><p className="mt-1 text-sm text-gray-500 dark:text-white/45">Only church administrators can change organization policies.</p></div></div></div>;
  if (loading || !policy) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;

  return (
    <div className="app-content-shell space-y-5 py-4 sm:py-6">
      <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.16] via-emerald-500/[0.05] to-transparent p-5 sm:p-6">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-900/25"><Settings2 className="h-6 w-6" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Organization administration</p><h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">Admin Settings</h1><p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-white/55">Manage the rules that control how ServeSync operates for your church. Leadership queues stay separate; these controls change organization-wide behavior.</p></div></div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/[0.06]"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300"><Music2 className="h-5 w-5" /></span><div><h2 className="font-black text-gray-900 dark:text-white">Event & setlist defaults</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">Controls used whenever an event type is selected. Existing events keep their saved details until edited.</p></div></div><button type="button" onClick={() => void savePolicy()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save defaults'}</button></div>
        <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]"><label className="block min-w-[220px] flex-1 text-xs font-bold text-gray-700 dark:text-white/70">Add event type<input className="input-field mt-1.5 h-10 w-full text-sm" value={newEventType} onChange={(event) => setNewEventType(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addEventType(); } }} placeholder="e.g. Young Adults Night" /></label><button type="button" onClick={addEventType} disabled={!newEventType.trim()} className="btn-secondary !min-h-10 !px-3.5 text-xs font-black disabled:opacity-50">Add type</button><p className="basis-full text-[11px] leading-relaxed text-gray-500 dark:text-white/45">New types become available in the Event form immediately after you save these defaults.</p></div>
        <div className="overflow-x-auto"><div className="min-w-[680px] divide-y divide-gray-100 dark:divide-white/[0.06]">
          <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_72px] gap-3 bg-gray-50/80 px-5 py-3 text-[10px] font-black uppercase tracking-[0.13em] text-gray-500 dark:bg-white/[0.025] dark:text-white/40"><span>Event type</span><span>Starts</span><span>Ends</span><span>Setlist due</span><span /></div>
          {Object.entries(policy.event_templates).filter(([eventType]) => eventType !== 'Custom').map(([eventType, template]) => (
            <div key={eventType} className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_72px] items-center gap-3 px-5 py-3.5">
              <span className="text-sm font-bold text-gray-900 dark:text-white">{eventType}</span>
              <input type="time" className="input-field h-10 w-full text-sm" value={template.start_time} onChange={(event) => updateTemplate(eventType, 'start_time', event.target.value)} />
              <input type="time" className="input-field h-10 w-full text-sm" value={template.end_time} onChange={(event) => updateTemplate(eventType, 'end_time', event.target.value)} />
              <label className="flex items-center gap-2"><input type="number" min="0" max="90" placeholder="Off" className="input-field h-10 w-20 text-sm" value={template.setlist_due_days_before ?? ''} onChange={(event) => updateTemplate(eventType, 'setlist_due_days_before', event.target.value)} /><span className="text-xs font-semibold text-gray-500 dark:text-white/45">days before</span></label>
              {DEFAULT_EVENT_TEMPLATE_POLICIES[eventType] ? <span className="text-[10px] font-bold text-gray-400 dark:text-white/25">Built-in</span> : <button type="button" onClick={() => void deleteEventType(eventType)} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-black text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
            </div>
          ))}
        </div></div>
        <div className="border-t border-gray-100 px-5 py-4 dark:border-white/[0.06]"><label className="block text-sm font-bold text-gray-900 dark:text-white">Setlist checker submission rule<select className="input-field mt-2 block h-11 w-full max-w-xl text-sm" value={policy.setlist_submission_mode} onChange={(event) => setPolicy(current => current ? { ...current, setlist_submission_mode: event.target.value as SetlistSubmissionMode } : current)}><option value="block_rejected">Block a rejected setlist from being submitted</option><option value="advisory">Advice only — leaders may submit any result</option></select></label><p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-white/45">The checker’s report still shows theological or flow concerns. This rule chooses whether a rejected report stops submission or remains advisory.</p></div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/[0.06]"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300"><UserCheck className="h-5 w-5" /></span><div><h2 className="font-black text-gray-900 dark:text-white">Leave & schedule-change rules</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">These rules are enforced when members submit leave, swap, or substitute requests.</p></div></div><button type="button" onClick={() => void savePolicy()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save rules'}</button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <PolicyToggle label="Require leave approval" detail="When off, valid leave requests are approved immediately." checked={policy.leave_policy.approval_required} onChange={(value) => updateLeavePolicy('approval_required', value)} />
          <PolicyToggle label="Require a leave reason" detail="Members must explain why they will be unavailable." checked={policy.leave_policy.reason_required} onChange={(value) => updateLeavePolicy('reason_required', value)} />
          <PolicyToggle label="Allow date-range leave" detail="Allow a member to request more than one date at a time." checked={policy.leave_policy.allow_date_ranges} onChange={(value) => updateLeavePolicy('allow_date_ranges', value)} />
          <PolicyNumber label="Minimum leave notice" detail="How many full days before the leave date members must submit." value={policy.leave_policy.minimum_notice_days} min={0} max={180} unit="days" onChange={(value) => updateLeavePolicy('minimum_notice_days', value)} />
          <PolicyToggle label="Allow swap & sub requests" detail="Members can ask another eligible person to swap or cover a schedule." checked={policy.leave_policy.allow_swap_requests} onChange={(value) => updateLeavePolicy('allow_swap_requests', value)} />
          <PolicyToggle label="Require a schedule-change reason" detail="Members must state why they need a swap or substitute." checked={policy.leave_policy.require_swap_reason} disabled={!policy.leave_policy.allow_swap_requests} onChange={(value) => updateLeavePolicy('require_swap_reason', value)} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/[0.06]"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300"><CalendarClock className="h-5 w-5" /></span><div><h2 className="font-black text-gray-900 dark:text-white">Setlist reminder schedule</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">Controls the live reminder service for unsubmitted setlist proposals. Changes apply at the next Manila reminder slot.</p></div></div><button type="button" onClick={() => void savePolicy()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save schedule'}</button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <PolicyToggle label="Send setlist reminders" detail="Master switch for every automatic proposal reminder." checked={policy.setlist_reminder_policy.enabled} onChange={(value) => updateSetlistReminder('enabled', value)} />
          <PolicyToggle label="One week before" detail="A morning reminder 7 days before the proposal is due." checked={policy.setlist_reminder_policy.seven_days} disabled={!policy.setlist_reminder_policy.enabled} onChange={(value) => updateSetlistReminder('seven_days', value)} />
          <PolicyToggle label="Three days before" detail="A morning reminder 3 days before the proposal is due." checked={policy.setlist_reminder_policy.three_days} disabled={!policy.setlist_reminder_policy.enabled} onChange={(value) => updateSetlistReminder('three_days', value)} />
          <PolicyToggle label="Day before" detail="Morning, midday, and final-evening reminders the day before." checked={policy.setlist_reminder_policy.day_before} disabled={!policy.setlist_reminder_policy.enabled} onChange={(value) => updateSetlistReminder('day_before', value)} />
          <PolicyToggle label="Due day" detail="Morning, midday, and final-evening reminders on the due day." checked={policy.setlist_reminder_policy.due_day} disabled={!policy.setlist_reminder_policy.enabled} onChange={(value) => updateSetlistReminder('due_day', value)} />
          <PolicyToggle label="Overdue follow-up" detail="Morning and evening follow-ups after the due time." checked={policy.setlist_reminder_policy.overdue} disabled={!policy.setlist_reminder_policy.enabled} onChange={(value) => updateSetlistReminder('overdue', value)} />
          <PolicyToggle label="Escalate overdue setlists" detail="Alert organization admins and leadership on the first overdue reminder." checked={policy.setlist_reminder_policy.leadership_escalation} disabled={!policy.setlist_reminder_policy.enabled || !policy.setlist_reminder_policy.overdue} onChange={(value) => updateSetlistReminder('leadership_escalation', value)} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-white/[0.06]"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"><ScanLine className="h-5 w-5" /></span><div><h2 className="font-black text-gray-900 dark:text-white">Attendance policy</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">Applied to QR check-ins and the timed attendance reminders.</p></div></div><button type="button" onClick={() => void savePolicy()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save policy'}</button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <PolicyNumber label="Open attendance" detail="How early scheduled members may check in." value={policy.attendance_open_minutes_before} min={0} max={180} onChange={(value) => updatePolicy('attendance_open_minutes_before', value)} />
          <PolicyNumber label="On-time grace" detail="Check-ins after this are recorded as Late." value={policy.attendance_grace_minutes} min={0} max={60} onChange={(value) => updatePolicy('attendance_grace_minutes', value)} />
          <PolicyNumber label="Scan session" detail="How long a verified QR scan remains valid." value={policy.attendance_scan_session_minutes} min={1} max={30} onChange={(value) => updatePolicy('attendance_scan_session_minutes', value)} />
          <PolicyNumber label="Incomplete scan alert" detail="Wait this long before reminding someone to finish." value={policy.attendance_incomplete_scan_minutes} min={1} max={30} onChange={(value) => updatePolicy('attendance_incomplete_scan_minutes', value)} />
          <PolicyNumber label="Pre-service reminder" detail="Send the attendance reminder this many minutes before the event starts." value={policy.attendance_pre_start_reminder_minutes} min={0} max={120} onChange={(value) => updatePolicy('attendance_pre_start_reminder_minutes', value)} />
          <PolicyNumber label="Automatic absence" detail="Record missing attendance as absent this many days after the event." value={policy.attendance_auto_absent_after_days} min={1} max={14} unit="days" onChange={(value) => updatePolicy('attendance_auto_absent_after_days', value)} />
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-2xl border border-gray-200/70 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/45"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />Every control on this page saves a church-wide setting and affects new activity. Security permissions, service credentials, deployment keys, and database protections are intentionally not editable here.</p>
    </div>
  );
}
