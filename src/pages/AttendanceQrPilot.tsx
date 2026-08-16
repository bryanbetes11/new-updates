import { useCallback, useEffect, useMemo, useState } from 'react';
import { addHours, format } from 'date-fns';
import { CalendarClock, Download, FlaskConical, Loader2, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { buildAttendanceQrPayload } from '../lib/attendanceQrPilot';
import { supabase } from '../lib/supabase';

interface PilotEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  checkin_count: number;
}

interface PilotState {
  checkpoint_token: string;
  events: PilotEvent[];
}

interface LiveQrState {
  checkpoint_token: string;
  active: boolean;
  session_minutes: number;
  window_opens_minutes_before: number;
  present_grace_minutes: number;
}

function localDateTimeValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function AttendanceQrPilot() {
  const { isOrgAdmin, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const canUsePilot = isOrgAdmin || isPlatformOwner;
  const [pilotState, setPilotState] = useState<PilotState | null>(null);
  const [liveState, setLiveState] = useState<LiveQrState | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [liveQrImage, setLiveQrImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('QR Attendance Test');
  const [startsAt, setStartsAt] = useState(() => localDateTimeValue(new Date()));
  const [endsAt, setEndsAt] = useState(() => localDateTimeValue(addHours(new Date(), 2)));

  const qrPayload = useMemo(
    () => pilotState?.checkpoint_token ? buildAttendanceQrPayload(pilotState.checkpoint_token) : '',
    [pilotState?.checkpoint_token],
  );
  const liveQrPayload = useMemo(
    () => liveState?.checkpoint_token ? buildAttendanceQrPayload(liveState.checkpoint_token) : '',
    [liveState?.checkpoint_token],
  );

  const loadPilot = useCallback(async () => {
    if (!canUsePilot) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [pilotResult, liveResult] = await Promise.all([
      supabase.rpc('get_qr_attendance_pilot_admin_state'),
      supabase.rpc('get_qr_attendance_admin_state'),
    ]);
    if (pilotResult.error || liveResult.error) {
      toast('error', pilotResult.error?.message || liveResult.error?.message || 'Could not load QR attendance');
      setLoading(false);
      return;
    }
    setPilotState(pilotResult.data as PilotState);
    setLiveState(liveResult.data as LiveQrState);
    setLoading(false);
  }, [canUsePilot, toast]);

  useEffect(() => { void loadPilot(); }, [loadPilot]);

  useEffect(() => {
    if (!qrPayload) return;
    void QRCode.toDataURL(qrPayload, {
      width: 720,
      margin: 2,
      color: { dark: '#050505', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrImage);
  }, [qrPayload]);

  useEffect(() => {
    if (!liveQrPayload) return;
    void QRCode.toDataURL(liveQrPayload, {
      width: 720,
      margin: 2,
      color: { dark: '#050505', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setLiveQrImage);
  }, [liveQrPayload]);

  const createTestEvent = async () => {
    if (!title.trim()) {
      toast('error', 'Enter a test event title');
      return;
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast('error', 'Choose a valid start and end time');
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('create_qr_attendance_pilot_event', {
      p_title: title.trim(),
      p_starts_at: start.toISOString(),
      p_ends_at: end.toISOString(),
    });
    setSaving(false);
    if (error) {
      toast('error', error.message || 'Could not create the test event');
      return;
    }
    toast('success', 'Test event created. It will never affect accountability.');
    await loadPilot();
  };

  if (!canUsePilot) {
    return (
      <div className="page-container page-bottom-pad">
        <div className="app-content-shell mx-auto max-w-2xl">
          <div className="card p-6 text-center">
            <QrCode className="mx-auto h-10 w-10 text-gray-400" />
            <h1 className="mt-3 text-xl font-bold">Admin pilot only</h1>
            <p className="mt-2 text-sm text-gray-500">QR attendance testing is currently restricted to organization admins.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell mx-auto max-w-5xl space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-500">
            <ShieldCheck className="h-4 w-4" /> Attendance control
          </div>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">QR Attendance</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Download the live church QR for members, or keep using the isolated test lab without changing real records.</p>
        </div>

        {loading ? (
          <div className="card flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
            <section className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500"><CalendarClock className="h-5 w-5" /></span>
                <div><h2 className="font-bold">Create a test event</h2><p className="text-xs text-gray-500">Set it to now so it appears after scanning.</p></div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-semibold">Event name
                  <input className="input mt-1.5 w-full" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
                </label>
                <label className="text-sm font-semibold">Starts
                  <input type="datetime-local" className="input mt-1.5 w-full" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                </label>
                <label className="text-sm font-semibold">Ends
                  <input type="datetime-local" className="input mt-1.5 w-full" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
                </label>
              </div>
              <button type="button" className="btn-primary mt-5 min-h-11 w-full" onClick={createTestEvent} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Create isolated test event
              </button>

              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Pilot events</h3><button type="button" className="btn-secondary !min-h-9 !px-3" onClick={() => void loadPilot()}><RefreshCw className="h-4 w-4" /> Refresh</button></div>
                <div className="mt-3 space-y-2">
                  {pilotState?.events.length ? pilotState.events.map((event) => (
                    <div key={event.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{event.title}</p><p className="mt-0.5 text-xs text-gray-500">{format(new Date(event.starts_at), 'MMM d, h:mm a')} – {format(new Date(event.ends_at), 'h:mm a')}</p></div><span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-bold text-emerald-500">{event.checkin_count} check-in{event.checkin_count === 1 ? '' : 's'}</span></div>
                    </div>
                  )) : <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-500 dark:bg-gray-900">No pilot events yet.</p>}
                </div>
              </div>
            </section>

            <div className="space-y-5">
              <section className="card border-emerald-500/20 p-5 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500"><ShieldCheck className="h-6 w-6" /></div>
                <h2 className="mt-3 font-bold">Live reusable church QR</h2>
                <p className="mt-1 text-xs text-gray-500">This writes to official attendance. Members see only events they are scheduled for.</p>
                {liveQrImage && <img src={liveQrImage} alt="Live reusable ServeSync church attendance QR code" className="mx-auto mt-4 w-full max-w-[300px] rounded-2xl bg-white p-3" />}
                {liveQrImage && (
                  <a href={liveQrImage} download="servesync-live-church-attendance-qr.png" className="btn-primary mt-4 inline-flex min-h-11 w-full items-center justify-center">
                    <Download className="h-4 w-4" /> Download live QR
                  </a>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-emerald-500">Each scan opens a one-use {liveState?.session_minutes || 5}-minute session. Attendance still requires a separate Check In tap.</p>
              </section>

              <section className="card p-5 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-amber-500"><QrCode className="h-6 w-6" /></div>
                <h2 className="mt-3 font-bold">Isolated test QR</h2>
                <p className="mt-1 text-xs text-gray-500">Use this only with the test events on the left.</p>
                {qrImage && <img src={qrImage} alt="Reusable ServeSync attendance test QR code" className="mx-auto mt-4 w-full max-w-[300px] rounded-2xl bg-white p-3" />}
                {qrImage && (
                  <a href={qrImage} download="servesync-attendance-test-qr.png" className="btn-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center">
                    <Download className="h-4 w-4" /> Download test QR
                  </a>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-amber-500">Admin test only. It cannot change real attendance or accountability.</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
