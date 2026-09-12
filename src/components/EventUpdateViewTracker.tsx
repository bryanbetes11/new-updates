import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Record only a loaded event in a visible tab, with the schedule version actually rendered.
export function EventUpdateViewTracker({ eventId, rescheduledAt }: { eventId: string; rescheduledAt: string | null }) {
  useEffect(() => {
    let timer: number | undefined;
    let active = true;
    let recorded = false;
    const record = () => {
      window.clearTimeout(timer);
      if (!active || recorded || document.visibilityState !== 'visible' || !navigator.onLine) return;
      timer = window.setTimeout(() => {
        if (!active || document.visibilityState !== 'visible') return;
        void supabase.rpc('record_event_update_view', { p_event_id: eventId, p_rescheduled_at: rescheduledAt })
          .then(({ data, error }) => { if (!error && data) recorded = true; });
      }, 1500);
    };
    record();
    document.addEventListener('visibilitychange', record);
    window.addEventListener('online', record);
    return () => { active = false; window.clearTimeout(timer); document.removeEventListener('visibilitychange', record); window.removeEventListener('online', record); };
  }, [eventId, rescheduledAt]);
  return null;
}
