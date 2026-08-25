import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Camera, CheckCircle2, Loader2, QrCode, RotateCcw, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { EventArtwork } from '../components/EventArtwork';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { parseAttendanceQrPayload } from '../lib/attendanceQrPilot';
import { playInteractionSound } from '../lib/interactionSounds';
import { supabase } from '../lib/supabase';

interface EligibleAttendanceEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  existing_status: 'present' | 'late' | 'absent' | 'excused' | null;
  checked_in_at: string | null;
  opens_at?: string;
  attendance_open?: boolean;
  event_type?: string | null;
  artwork_songs?: AttendanceArtworkSong[];
}

interface AttendanceArtworkSong {
  position?: number | null;
  youtube_url?: string | null;
  songs?: {
    title?: string | null;
    artist?: string | null;
    youtube_url?: string | null;
  } | null;
}

interface AttendanceEventArtworkRow {
  id: string;
  event_type: string | null;
  setlists?: Array<{
    status?: string | null;
    created_at?: string | null;
    setlist_songs?: AttendanceArtworkSong[] | null;
  }> | null;
}

interface CheckinResult {
  event_id: string;
  event_title: string;
  status: 'present' | 'late';
  checked_in_at: string;
  pilot_only: boolean;
}

function formatTimeRemaining(opensAt: string, now: number): string {
  const remainingMs = new Date(opensAt).getTime() - now;
  if (remainingMs <= 0) return 'now';
  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'}`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function getPreferredArtworkSongs(event: AttendanceEventArtworkRow): AttendanceArtworkSong[] {
  const setlists = [...(event.setlists || [])].sort((left, right) => {
    const priority = (status?: string | null) => status === 'approved' ? 0 : status === 'pending_review' ? 1 : 2;
    const priorityDifference = priority(left.status) - priority(right.status);
    if (priorityDifference !== 0) return priorityDifference;
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
  return [...(setlists[0]?.setlist_songs || [])]
    .sort((left, right) => (left.position ?? 999) - (right.position ?? 999))
    .slice(0, 4);
}

export function AttendanceQrScanner() {
  const navigate = useNavigate();
  const { user, isOrgAdmin, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const canUsePilot = isOrgAdmin || isPlatformOwner;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [scanToken, setScanToken] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [scanMode, setScanMode] = useState<'live' | 'pilot' | null>(null);
  const [events, setEvents] = useState<EligibleAttendanceEvent[] | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [showScanSuccess, setShowScanSuccess] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const stopScanner = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const validateScan = useCallback(async (rawPayload: string) => {
    if (processingRef.current) return;
    const token = parseAttendanceQrPayload(rawPayload);
    if (!token) {
      stopScanner();
      setCameraError('That code is not a ServeSync attendance QR. Try the printed church QR again.');
      toast('error', 'That is not a ServeSync attendance QR code');
      return;
    }

    processingRef.current = true;
    setValidating(true);
    const liveResult = await supabase.rpc('validate_qr_attendance_checkpoint', { p_token: token });
    let data = liveResult.data as { session_token?: string; events?: EligibleAttendanceEvent[] } | null;
    let error = liveResult.error;
    let mode: 'live' | 'pilot' = 'live';

    if (error && canUsePilot) {
      const pilotResult = await supabase.rpc('validate_qr_attendance_pilot_checkpoint', { p_token: token });
      data = pilotResult.data as { events?: EligibleAttendanceEvent[] } | null;
      error = pilotResult.error;
      mode = 'pilot';
    }
    setValidating(false);
    processingRef.current = false;
    if (error) {
      toast('error', error.message || 'This QR code is not active');
      return;
    }

    const scannedEvents = data?.events || [];
    let enrichedEvents = scannedEvents;
    if (scannedEvents.length > 0) {
      const { data: artworkRows } = await supabase
        .from('events')
        .select('id, event_type, setlists(status, created_at, setlist_songs(position, youtube_url, songs(title, artist, youtube_url)))')
        .in('id', scannedEvents.map((event) => event.id));
      const artworkByEventId = new Map(
        ((artworkRows || []) as AttendanceEventArtworkRow[]).map((event) => [event.id, event]),
      );
      enrichedEvents = scannedEvents.map((event) => {
        const artwork = artworkByEventId.get(event.id);
        return artwork
          ? { ...event, event_type: artwork.event_type, artwork_songs: getPreferredArtworkSongs(artwork) }
          : event;
      });
    }

    stopScanner();
    setScanToken(token);
    setSessionToken(data?.session_token || '');
    setScanMode(mode);
    setEvents(enrichedEvents);
    // Confirm that the church QR itself was accepted. This intentionally does
    // not fire for invalid codes or for the later attendance-recording action.
    playInteractionSound('scanSuccess');
    setShowScanSuccess(true);
  }, [canUsePilot, stopScanner, toast]);

  const startScanner = useCallback(async () => {
    if (!user || !videoRef.current || scannerRef.current) return;
    setCameraError('');
    const scanner = new QrScanner(
      videoRef.current,
      (scanResult) => { void validateScan(scanResult.data); },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
    );
    scannerRef.current = scanner;
    try {
      await scanner.start();
      setScanning(true);
    } catch {
      scanner.destroy();
      scannerRef.current = null;
      setCameraError('Camera access was unavailable. Allow camera permission, then try the live scanner again.');
    }
  }, [user, validateScan]);

  useEffect(() => {
    if (user && events === null) void startScanner();
    return stopScanner;
  }, [user, events, startScanner, stopScanner]);

  useEffect(() => {
    if (events === null) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [events]);

  useEffect(() => {
    if (!showScanSuccess) return;
    const timeout = window.setTimeout(
      () => setShowScanSuccess(false),
      prefersReducedMotion ? 450 : 1400,
    );
    return () => window.clearTimeout(timeout);
  }, [prefersReducedMotion, showScanSuccess]);

  const recordCheckin = async (eventId: string) => {
    if (!scanMode || (scanMode === 'live' ? !sessionToken : !scanToken)) return;
    setCheckingIn(eventId);
    const { data, error } = scanMode === 'live'
      ? await supabase.rpc('record_qr_attendance_checkin', {
          p_session_token: sessionToken,
          p_event_id: eventId,
        })
      : await supabase.rpc('record_qr_attendance_pilot_checkin', {
          p_token: scanToken,
          p_event_id: eventId,
        });
    setCheckingIn(null);
    if (error) {
      toast('error', error.message || 'Could not record your check-in');
      return;
    }
    setResult(data as CheckinResult);
  };

  const reset = () => {
    setShowScanSuccess(false);
    setResult(null);
    setScanToken('');
    setSessionToken('');
    setScanMode(null);
    setEvents(null);
  };

  const openEvents = events?.filter((event) => scanMode === 'pilot' || event.attendance_open) || [];
  const upcomingEvents = scanMode === 'live'
    ? events?.filter((event) => !event.attendance_open) || []
    : [];

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell mx-auto max-w-xl">
        <div className="mb-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-500"><QrCode className="h-4 w-4" /> Church attendance</div><h1 className="mt-2 text-2xl font-black">Scan to check in</h1><p className="mt-1 text-sm text-gray-500">Only events you are scheduled for appear after the church QR is verified.</p></div>

        {createPortal(
          <AnimatePresence>
            {showScanSuccess && (
              <motion.div
                role="status"
                aria-live="polite"
                className="fixed inset-0 z-[120] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#020403]/95 px-6 text-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.08 : 0.2 }}
              >
                <motion.div
                  className="pointer-events-none absolute h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
                  initial={prefersReducedMotion ? false : { scale: 0.35, opacity: 0 }}
                  animate={{ scale: prefersReducedMotion ? 1 : 1.35, opacity: [0, 0.9, 0.5] }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 1.15, ease: 'easeOut' }}
                />
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative flex h-32 w-32 items-center justify-center">
                    {!prefersReducedMotion && (
                      <motion.span
                        className="absolute inset-0 rounded-full border border-emerald-300/55"
                        initial={{ scale: 0.55, opacity: 0.9 }}
                        animate={{ scale: 1.55, opacity: 0 }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    )}
                    <motion.span
                      className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-400/15 text-emerald-300 shadow-[0_0_70px_-12px_rgba(52,211,153,0.9),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
                      initial={prefersReducedMotion ? false : { scale: 0.35, rotate: -14, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 19, delay: 0.08 }}
                    >
                      <ShieldCheck className="h-12 w-12" strokeWidth={2.3} />
                    </motion.span>
                  </div>
                  <motion.p
                    className="mt-4 text-xs font-black uppercase tracking-[0.28em] text-emerald-300"
                    initial={prefersReducedMotion ? false : { y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.28, duration: 0.3 }}
                  >
                    QR locked in
                  </motion.p>
                  <motion.h2
                    className="mt-3 text-3xl font-black tracking-tight"
                    initial={prefersReducedMotion ? false : { y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.38, duration: 0.35 }}
                  >
                    Your schedule is ready
                  </motion.h2>
                  <motion.p
                    className="mt-2 text-sm font-medium text-white/50"
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.5, duration: 0.3 }}
                  >
                    Choose your event, then tap Check In.
                  </motion.p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

        {result ? createPortal(
          <section className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col bg-[#050505] px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] text-white">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
              <span className={`flex h-24 w-24 items-center justify-center rounded-full ${result.status === 'late' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                <CheckCircle2 className="h-14 w-14" strokeWidth={2.2} />
              </span>
              <p className={`mt-7 text-xs font-black uppercase tracking-[0.2em] ${result.status === 'late' ? 'text-amber-400' : 'text-emerald-400'}`}>Check-in complete</p>
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Your attendance has been recorded</h1>
              <p className="mt-3 text-base text-white/60">{result.event_title}</p>

              <div className={`mt-8 w-full rounded-3xl border px-5 py-6 ${result.status === 'late' ? 'border-amber-400/25 bg-amber-500/10' : 'border-emerald-400/25 bg-emerald-500/10'}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Attendance status</p>
                <p className={`mt-2 text-4xl font-black ${result.status === 'late' ? 'text-amber-400' : 'text-emerald-400'}`}>{result.status === 'late' ? 'Late' : 'On-time'}</p>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Check-in timestamp</p>
                  <p className="mt-1 text-sm font-semibold text-white/65">{format(new Date(result.checked_in_at), 'MMM d, yyyy · h:mm a')}</p>
                </div>
              </div>

              <div className={`mt-5 w-full rounded-2xl px-4 py-3 text-xs font-semibold leading-relaxed ${result.pilot_only ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-300'}`}>
                {result.pilot_only ? 'Pilot only — this test did not change real attendance or accountability.' : 'This is now part of your official attendance record.'}
              </div>
            </div>
            <div className="mx-auto grid w-full max-w-md gap-2 sm:grid-cols-2">
              <button type="button" className="btn-secondary min-h-12 w-full !border-white/15 !bg-white/[0.06] !text-white" onClick={reset}><RotateCcw className="h-4 w-4" /> Scan again</button>
              <button type="button" className="btn-primary min-h-12 w-full" onClick={() => navigate('/dashboard')}>Done</button>
            </div>
          </section>,
          document.body,
        ) : events !== null ? (
          <section className="pb-2">
            <div className="flex items-center gap-3 px-1"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold">Church QR verified</h2><p className="text-xs text-gray-500">{scanMode === 'pilot' ? 'Admin test mode' : 'Secure session expires in five minutes'} · review your event, then tap Check In.</p></div></div>
            <div className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold leading-relaxed text-emerald-500">
              Scanning does not record attendance. Your check-in is submitted only when you tap the Check In button.
            </div>
            {openEvents.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-500">Ready to check in</p>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
                  {openEvents.map((event) => (
                    <article key={event.id} className="min-w-0">
                      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black shadow-[0_14px_35px_-24px_rgba(0,0,0,0.9)]">
                        <EventArtwork eventType={event.event_type} title={event.title} songs={event.artwork_songs} className="h-full w-full" />
                        <span className="absolute left-2 top-2 rounded-md bg-white px-2 py-1 text-[9px] font-black uppercase tracking-tight text-black shadow-sm">{format(new Date(event.starts_at), 'MMM d')}</span>
                        <span className="absolute bottom-2 left-2 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-black shadow-lg">{event.existing_status ? (event.existing_status === 'present' ? 'On-time' : event.existing_status) : 'Open now'}</span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-[13px] font-extrabold leading-[1.25] text-gray-950 dark:text-white">{event.title}</h3>
                      <p className="mt-1 truncate text-[11px] font-medium text-gray-500">{format(new Date(event.starts_at), 'EEE · h:mm a')}–{format(new Date(event.ends_at), 'h:mm a')}</p>
                      {event.existing_status ? (
                        <div className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-emerald-500/10 px-2 text-center text-xs font-bold capitalize text-emerald-500">Recorded: {event.existing_status === 'present' ? 'On-time' : event.existing_status}</div>
                      ) : (
                        <button type="button" onClick={() => void recordCheckin(event.id)} disabled={Boolean(checkingIn)} className="btn-primary mt-2 min-h-11 w-full !px-2 text-xs">
                          {checkingIn === event.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</> : <><CheckCircle2 className="h-4 w-4" /> Check In</>}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {upcomingEvents.length > 0 && (
              <div className="mt-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">Upcoming assignments</p>
                  {openEvents.length === 0 && <p className="mt-1 text-xs leading-relaxed text-gray-500">Attendance is not open yet. Scan the church QR again when your event window opens.</p>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5">
                  {upcomingEvents.map((event) => (
                    <article key={event.id} className="min-w-0">
                      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black shadow-[0_14px_35px_-24px_rgba(0,0,0,0.9)]">
                        <EventArtwork eventType={event.event_type} title={event.title} songs={event.artwork_songs} className="h-full w-full opacity-90" />
                        <span className="absolute left-2 top-2 rounded-md bg-white px-2 py-1 text-[9px] font-black uppercase tracking-tight text-black shadow-sm">{format(new Date(event.starts_at), 'MMM d')}</span>
                        {event.opens_at && <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-black text-amber-300 shadow-lg backdrop-blur">Opens in {formatTimeRemaining(event.opens_at, now)}</span>}
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-[13px] font-extrabold leading-[1.25] text-gray-950 dark:text-white">{event.title}</h3>
                      <p className="mt-1 truncate text-[11px] font-medium text-gray-500">{format(new Date(event.starts_at), 'EEE · h:mm a')}</p>
                      {event.opens_at && <p className="mt-1 text-[10px] font-semibold leading-snug text-gray-600 dark:text-gray-300">Opens {format(new Date(event.opens_at), 'EEE, MMM d · h:mm a')}</p>}
                      {event.existing_status && <div className="mt-2 rounded-lg bg-emerald-500/10 px-2 py-2 text-center text-xs font-bold capitalize text-emerald-500">Recorded: {event.existing_status === 'present' ? 'On-time' : event.existing_status}</div>}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 && (
              <div className="mt-5 rounded-xl bg-gray-100 p-5 text-center text-sm text-gray-500 dark:bg-gray-900">{scanMode === 'pilot' ? 'No test event is accepting attendance right now.' : 'You have no upcoming scheduled events.'}</div>
            )}
            <button type="button" className="btn-secondary mt-4 min-h-11 w-full" onClick={reset}><RotateCcw className="h-4 w-4" /> Scan a different QR</button>
          </section>
        ) : (
          <section className="card overflow-hidden">
            <div className="relative aspect-[3/4] max-h-[62vh] bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-56 w-56 rounded-3xl border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" /></div>
              <div className="absolute inset-x-0 bottom-5 text-center"><span className="rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white backdrop-blur">Point at the church QR code</span></div>
              {(validating || !scanning) && !cameraError && <div className="absolute inset-0 flex items-center justify-center bg-black/45"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
            </div>
            {cameraError && (
              <div className="p-4">
                <div className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-500">{cameraError}</div>
                <button type="button" className="btn-secondary mt-2 min-h-11 w-full" onClick={() => void startScanner()}><Camera className="h-4 w-4" /> Try camera again</button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
