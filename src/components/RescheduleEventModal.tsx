import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { formatTime12Hour } from '../lib/timeFormat';
import { useToast } from '../contexts/ToastContext';
import { dispatchBadgeCountsRefresh } from '../lib/realtimeSignals';
import type { Event } from '../types';

export function RescheduleEventModal({ event, memberCount, onClose, onSaved, proposalDueDate }: {
  event: Event;
  memberCount: number;
  onClose: () => void;
  onSaved: () => void;
  proposalDueDate: (date: string) => string | null;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState(event.event_date);
  const [start, setStart] = useState(event.start_time?.slice(0, 5) || '');
  const [end, setEnd] = useState(event.end_time?.slice(0, 5) || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const changed = date !== event.event_date || start !== (event.start_time?.slice(0, 5) || '') || end !== (event.end_time?.slice(0, 5) || '');

  const save = async () => {
    if (saving || !changed) return;
    setError('');
    if (end && (!start || end <= start)) {
      setError('Choose an end time after the start time.');
      return;
    }
    setSaving(true);
    try {
      let query = supabase.from('events').update({
        event_date: date, start_time: start || null, end_time: end || null,
        proposal_due_date: proposalDueDate(date),
      }).eq('id', event.id).eq('event_date', event.event_date);
      query = event.start_time ? query.eq('start_time', event.start_time) : query.is('start_time', null);
      query = event.end_time ? query.eq('end_time', event.end_time) : query.is('end_time', null);
      const { data, error: saveError } = await query.select('id');
      if (saveError) throw saveError;
      if (!data?.length) throw new Error('The schedule changed or you no longer have permission. Close this form and refresh the event before trying again.');
      dispatchBadgeCountsRefresh();
      toast('success', 'Event rescheduled. Members have been asked to confirm again.');
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reschedule. Your changes are still here; please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal open onClose={() => { if (!saving) onClose(); }} title="Reschedule event" size="md" closeOnBackdrop={!saving} closeOnEscape={!saving}>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="rounded-xl bg-gray-100 p-3 dark:bg-white/[0.05]">
        <p className="font-semibold">{event.title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Currently {format(parseISO(event.event_date), 'MMM d, yyyy')}{event.start_time ? ` · ${formatTime12Hour(event.start_time)}` : ''}{event.end_time ? ` – ${formatTime12Hour(event.end_time)}` : ''}</p>
      </div>
      <label className="block text-sm font-medium">New date
        <input type="date" className="input-field mt-1.5" value={date} min={format(new Date(), 'yyyy-MM-dd')} required disabled={saving} onChange={e => setDate(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Start time
          <input type="time" className="input-field mt-1.5" value={start} required disabled={saving} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">End time
          <input type="time" className="input-field mt-1.5" value={end} disabled={saving} onChange={e => setEnd(e.target.value)} />
        </label>
      </div>
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        {memberCount} assigned {memberCount === 1 ? 'member will' : 'members will'} receive a reschedule notification. Accepted and declined responses will return to pending so everyone can confirm availability again. Push delivery follows their notification settings.
      </p>
      {event.linked_event_id && <p className="text-sm text-gray-500">This changes only this event’s schedule. The linked event keeps its current date and time.</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary min-h-11" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary min-h-11 disabled:opacity-50" disabled={saving || !changed}>{saving ? 'Rescheduling…' : 'Reschedule & notify'}</button>
      </div>
    </form>
  </Modal>;
}
