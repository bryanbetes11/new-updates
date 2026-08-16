import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Camera, CheckCircle2, ImagePlus, Loader2, QrCode, RotateCcw, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { parseAttendanceQrPayload } from '../lib/attendanceQrPilot';
import { supabase } from '../lib/supabase';

interface EligiblePilotEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  existing_status: 'present' | 'late' | null;
  checked_in_at: string | null;
}

interface CheckinResult {
  event_id: string;
  event_title: string;
  status: 'present' | 'late';
  checked_in_at: string;
  pilot_only: true;
}

export function AttendanceQrScanner() {
  const navigate = useNavigate();
  const { isOrgAdmin, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const canUsePilot = isOrgAdmin || isPlatformOwner;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [checkpointToken, setCheckpointToken] = useState('');
  const [events, setEvents] = useState<EligiblePilotEvent[] | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

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
      setCameraError('That code is not a ServeSync attendance QR. Try the reusable QR from the admin test lab.');
      toast('error', 'That is not a ServeSync attendance QR code');
      return;
    }

    processingRef.current = true;
    setValidating(true);
    const { data, error } = await supabase.rpc('validate_qr_attendance_pilot_checkpoint', { p_token: token });
    setValidating(false);
    processingRef.current = false;
    if (error) {
      toast('error', error.message || 'This QR code is not active');
      return;
    }

    stopScanner();
    setCheckpointToken(token);
    setEvents(((data as { events?: EligiblePilotEvent[] })?.events || []));
  }, [stopScanner, toast]);

  const startScanner = useCallback(async () => {
    if (!canUsePilot || !videoRef.current || scannerRef.current) return;
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
      setCameraError('Camera access was unavailable. Allow camera permission or choose a saved QR image below.');
    }
  }, [canUsePilot, validateScan]);

  useEffect(() => {
    if (canUsePilot && events === null) void startScanner();
    return stopScanner;
  }, [canUsePilot, events, startScanner, stopScanner]);

  const scanImage = async (file: File | undefined) => {
    if (!file) return;
    setValidating(true);
    try {
      const scanResult = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      setValidating(false);
      await validateScan(scanResult.data);
    } catch {
      setValidating(false);
      toast('error', 'No readable QR code was found in that image');
    }
  };

  const recordCheckin = async (eventId: string) => {
    if (!checkpointToken) return;
    setCheckingIn(eventId);
    const { data, error } = await supabase.rpc('record_qr_attendance_pilot_checkin', {
      p_token: checkpointToken,
      p_event_id: eventId,
    });
    setCheckingIn(null);
    if (error) {
      toast('error', error.message || 'Could not record the test check-in');
      return;
    }
    setResult(data as CheckinResult);
  };

  const reset = () => {
    setResult(null);
    setCheckpointToken('');
    setEvents(null);
  };

  if (!canUsePilot) {
    return <div className="page-container page-bottom-pad"><div className="app-content-shell mx-auto max-w-xl"><div className="card p-6 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-gray-400" /><h1 className="mt-3 text-xl font-bold">Admin pilot only</h1><p className="mt-2 text-sm text-gray-500">The QR scanner is currently available only to organization admins while attendance testing is isolated.</p></div></div></div>;
  }

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell mx-auto max-w-xl">
        <div className="mb-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-500"><QrCode className="h-4 w-4" /> Attendance pilot</div><h1 className="mt-2 text-2xl font-black">Scan to check in</h1><p className="mt-1 text-sm text-gray-500">The attendance choices stay locked until a valid church QR is scanned.</p></div>

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
                <p className={`mt-2 text-4xl font-black ${result.status === 'late' ? 'text-amber-400' : 'text-emerald-400'}`}>{result.status === 'late' ? 'Late' : 'Present'}</p>
                <p className="mt-2 text-sm font-semibold text-white/55">Recorded at {format(new Date(result.checked_in_at), 'h:mm a')}</p>
              </div>

              <div className="mt-5 w-full rounded-2xl bg-amber-500/10 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-400">Pilot only — this test did not change real attendance or accountability.</div>
            </div>
            <div className="mx-auto grid w-full max-w-md gap-2 sm:grid-cols-2">
              <button type="button" className="btn-secondary min-h-12 w-full !border-white/15 !bg-white/[0.06] !text-white" onClick={reset}><RotateCcw className="h-4 w-4" /> Scan again</button>
              <button type="button" className="btn-primary min-h-12 w-full" onClick={() => navigate('/dashboard')}>Done</button>
            </div>
          </section>,
          document.body,
        ) : events !== null ? (
          <section className="card p-5">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold">Church QR verified</h2><p className="text-xs text-gray-500">Review your event, then tap Check In.</p></div></div>
            <div className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold leading-relaxed text-emerald-500">
              Scanning does not record attendance. Your check-in is submitted only when you tap the Check In button.
            </div>
            <div className="mt-5 space-y-3">
              {events.length ? events.map((event) => (
                <div key={event.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="font-semibold">{event.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{format(new Date(event.starts_at), 'MMM d, h:mm a')} – {format(new Date(event.ends_at), 'h:mm a')}</p>
                  </div>
                  {event.existing_status ? (
                    <div className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-emerald-500/10 px-4 text-sm font-bold text-emerald-500">Already checked in</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void recordCheckin(event.id)}
                      disabled={Boolean(checkingIn)}
                      className="btn-primary mt-3 min-h-11 w-full"
                    >
                      {checkingIn === event.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording check-in…</> : <><CheckCircle2 className="h-4 w-4" /> Check In</>}
                    </button>
                  )}
                </div>
              )) : <div className="rounded-xl bg-gray-100 p-5 text-center text-sm text-gray-500 dark:bg-gray-900">No test event is accepting attendance right now. Create one in the QR Test Lab with a start time within 30 minutes of now.</div>}
            </div>
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
            <div className="p-4">
              {cameraError && <div className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-500">{cameraError}</div>}
              <label className="btn-secondary flex min-h-11 w-full cursor-pointer items-center justify-center">
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Scan QR from photo
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => void scanImage(event.target.files?.[0])} />
              </label>
              {cameraError && <button type="button" className="btn-secondary mt-2 min-h-11 w-full" onClick={() => void startScanner()}><Camera className="h-4 w-4" /> Try camera again</button>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
