import { useRef, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { getSetlistReminderState, setlistReminderWaitMinutes } from '../lib/setlistReminder';
import type { Event } from '../types';
import { Modal } from './Modal';

export function EventSetlistReminder({ event, status, recipientId, recipientName }: {
  event: Event; status?: string; recipientId?: string | null; recipientName: string;
}) {
  const { user, profile, isLeader } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState<string | null>(null);
  const busy = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const state = getSetlistReminderState(event, [status || null]);
  if (!isLeader || !user || !profile?.org_id || !recipientId || !state) return null;
  const dueLabel = formatInTimeZone(new Date(event.proposal_due_date!), 'Asia/Manila', 'MMM d, h:mm a');
  const name = recipientName || 'the assigned song leader';

  const send = async () => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      // Recheck recipient, submission and deadline before queueing a notification.
      const { data: latest, error: loadError } = await supabase.from('events')
        .select('id,title,event_date,start_time,end_time,lifecycle_override,proposal_due_date,setlist_required,song_leader_id,setlists(status),event_assignments(user_id,status,roles(name))')
        .eq('id', event.id).eq('org_id', profile.org_id).abortSignal(controller.signal).single();
      if (loadError || !latest) throw new Error('Could not check the latest setlist. Please try again.');
      const latestState = getSetlistReminderState(latest, (latest.setlists || []).map((set: { status: string }) => set.status));
      if (!latestState) throw new Error('This event no longer needs a submission reminder. Refresh to see its latest status.');
      const assigned = latest.event_assignments?.find((assignment: { roles: { name: string } | { name: string }[] | null }) =>
        Array.isArray(assignment.roles) ? assignment.roles.some(role => role.name === 'Song Leader') : assignment.roles?.name === 'Song Leader');
      const latestRecipient = assigned ? (assigned.status === 'declined' ? null : assigned.user_id) : latest.song_leader_id;
      if (latestRecipient !== recipientId) throw new Error('The song leader has changed. Refresh the event before sending a reminder.');
      const { data: recent, error: recentError } = await supabase.from('setlist_reminders').select('sent_at')
        .eq('org_id', profile.org_id).eq('event_id', event.id).eq('user_id', recipientId)
        .order('sent_at', { ascending: false }).limit(1).abortSignal(controller.signal).maybeSingle();
      if (recentError) throw new Error('Could not check recent reminders. Please try again.');
      const minutes = Math.max(setlistReminderWaitMinutes(recent?.sent_at || null), setlistReminderWaitMinutes(lastSent));
      if (minutes) throw new Error(`A reminder was sent recently. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} before sending another.`);
      const identity = `${event.id}:${recipientId}:${latest.proposal_due_date}`;
      if (attempt.current?.key !== identity) attempt.current = { key: identity, id: crypto.randomUUID() };
      const deadline = formatInTimeZone(new Date(latest.proposal_due_date), 'Asia/Manila', 'MMM d, h:mm a');
      const { error: notificationError } = await supabase.from('notifications').insert({
        id: attempt.current.id, org_id: profile.org_id, user_id: recipientId,
        type: 'proposal_reminder', title: 'Setlist Reminder',
        body: `Your setlist for "${latest.title}" is ${latestState === 'overdue' ? 'overdue' : 'due soon'} (deadline: ${deadline}). Open the event to submit it.`,
        data: { event_id: event.id, url: `/events/${event.id}` },
      }).abortSignal(controller.signal);
      // Reusing the notification ID makes retrying an uncertain response safe.
      if (notificationError && notificationError.code !== '23505') throw new Error('Could not confirm the reminder was queued. Please retry.');
      setLastSent(new Date().toISOString());
      setOpen(false);
      attempt.current = null;
      const { error: trackingError } = await supabase.from('setlist_reminders').insert({
        org_id: profile.org_id, event_id: event.id, user_id: recipientId, sent_by: user.id,
      }).abortSignal(controller.signal);
      toast(trackingError ? 'info' : 'success', trackingError
        ? 'Reminder queued, but its history could not be updated.'
        : `Setlist reminder queued for ${name}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not send the reminder. Please try again.');
    } finally {
      clearTimeout(timer);
      busy.current = false;
      setSending(false);
    }
  };

  return <>
    <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${state === 'overdue' ? 'border-red-500/20 bg-red-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
      <BellRing className={`h-5 w-5 shrink-0 ${state === 'overdue' ? 'text-red-500' : 'text-amber-500'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{state === 'overdue' ? 'Setlist submission overdue' : 'Setlist submission due soon'}</p>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-white/55">{name} · Due {dueLabel}</p>
      </div>
      <button type="button" disabled={sending} onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-xl bg-amber-400 px-4 text-xs font-bold text-gray-950 disabled:opacity-50">Remind song leader</button>
    </div>
    <Modal open={open} onClose={() => !sending && setOpen(false)} title="Send setlist reminder" size="sm" instantOpen closeOnEscape={!sending} closeOnBackdrop={!sending}>
      <p className="text-sm text-gray-700 dark:text-white/75">Send a setlist submission reminder to <strong>{name}</strong> for {event.title}?</p>
      <p className="mt-3 text-sm text-gray-600 dark:text-white/60">{state === 'overdue' ? 'Overdue' : 'Due soon'} · {dueLabel}. The reminder will link directly to this event.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={sending} onClick={() => setOpen(false)} className="btn-secondary min-h-11 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={sending} onClick={() => void send()} className="btn-primary min-h-11 disabled:opacity-50">{sending && <Loader2 className="h-4 w-4 animate-spin" />}{sending ? 'Sending…' : 'Send reminder'}</button>
      </div>
    </Modal>
  </>;
}
