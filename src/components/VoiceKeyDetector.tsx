import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, RotateCcw, ShieldCheck, Square, Volume2 } from 'lucide-react';
import {
  detectMonophonicPitch,
  inferKeyFromPitchFrames,
  type DetectedPitchFrame,
  type KeyInference,
} from '../lib/voiceKeyDetection';

interface VoiceKeyDetectorProps {
  onApply: (key: string) => void;
}

type DetectorStatus = 'idle' | 'requesting' | 'listening' | 'result' | 'error';

const RECORDING_SECONDS = 12;
const SAMPLE_INTERVAL_MS = 110;

function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Microphone access was blocked. Allow it in your browser settings, then try again.';
    }
    if (error.name === 'NotFoundError') return 'No microphone was found on this device.';
    if (error.name === 'NotReadableError') return 'The microphone is being used by another app.';
  }
  return 'ServeSync could not start the microphone. Check your browser permission and try again.';
}

export function VoiceKeyDetector({ onApply }: VoiceKeyDetectorProps) {
  const [status, setStatus] = useState<DetectorStatus>('idle');
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_SECONDS);
  const [liveNote, setLiveNote] = useState('—');
  const [inputStrength, setInputStrength] = useState(0);
  const [result, setResult] = useState<KeyInference | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const framesRef = useRef<DetectedPitchFrame[]>([]);
  const mountedRef = useRef(true);

  const releaseMicrophone = useCallback(() => {
    if (sampleTimerRef.current !== null) window.clearInterval(sampleTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    sampleTimerRef.current = null;
    countdownTimerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  const finishRecording = useCallback(() => {
    releaseMicrophone();
    const inference = inferKeyFromPitchFrames(framesRef.current);
    if (!inference) {
      setErrorMessage('Not enough clear singing was detected. Try again somewhere quieter and sing a steady chorus phrase.');
      setStatus('error');
      return;
    }
    setResult(inference);
    setStatus('result');
  }, [releaseMicrophone]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseMicrophone();
    };
  }, [releaseMicrophone]);

  const startRecording = async () => {
    setStatus('requesting');
    setErrorMessage('');
    setResult(null);
    setLiveNote('—');
    setInputStrength(0);
    setSecondsLeft(RECORDING_SECONDS);
    framesRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Voice Key Assist needs a secure HTTPS connection and a browser with microphone support.');
      setStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const audioContext = new AudioContext();
      if (audioContext.state === 'suspended') await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      setStatus('listening');

      const waveform = new Float32Array(analyser.fftSize);
      sampleTimerRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(waveform);
        let energy = 0;
        for (let index = 0; index < waveform.length; index += 1) energy += waveform[index] ** 2;
        const rms = Math.sqrt(energy / waveform.length);
        setInputStrength(Math.min(100, Math.round(rms * 700)));

        const pitch = detectMonophonicPitch(waveform, audioContext.sampleRate);
        if (!pitch) return;
        framesRef.current.push({ midi: pitch.midi, clarity: pitch.clarity });
        setLiveNote(pitch.note);
      }, SAMPLE_INTERVAL_MS);

      let remaining = RECORDING_SECONDS;
      countdownTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) finishRecording();
      }, 1000);
    } catch (error) {
      releaseMicrophone();
      if (!mountedRef.current) return;
      setErrorMessage(microphoneErrorMessage(error));
      setStatus('error');
    }
  };

  const reset = () => {
    releaseMicrophone();
    setStatus('idle');
    setResult(null);
    setErrorMessage('');
    setSecondsLeft(RECORDING_SECONDS);
    setLiveNote('—');
    setInputStrength(0);
  };

  if (status === 'idle' || status === 'requesting') {
    return (
      <div className="contents">
        <button
          type="button"
          onClick={() => void startRecording()}
          disabled={status === 'requesting'}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60 dark:border-violet-400/30 dark:bg-violet-500/[0.08] dark:text-violet-200 dark:hover:bg-violet-500/[0.14] sm:w-auto"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
          {status === 'requesting' ? 'Waiting for microphone…' : 'Find with voice'}
        </button>
        <p className="col-span-full text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Sing for 12 seconds with no music. We’ll suggest one major key. Check it with an instrument before saving. Your audio stays on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="col-span-full rounded-2xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-400/20 dark:bg-violet-500/[0.08]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-violet-950 dark:text-violet-100">Voice Key Assist</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Major keys
        </span>
      </div>

      {status === 'listening' && (
        <div className="mt-2" aria-live="polite">
          <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-violet-200/70 dark:bg-black/20 dark:ring-violet-400/15">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-300/60">Hearing</p>
              <p className="text-xl font-black tabular-nums text-violet-950 dark:text-white">{liveNote}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-300/60">Keep singing</p>
              <p className="text-xl font-black tabular-nums text-violet-950 dark:text-white">{secondsLeft}s</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-300/10">
              <div className="h-full rounded-full bg-violet-500 transition-[width] duration-100" style={{ width: `${inputStrength}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={finishRecording}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-400/20 dark:bg-white/[0.04] dark:text-violet-100 dark:hover:bg-white/[0.08]"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Finish now
          </button>
        </div>
      )}

      {status === 'result' && result && (
        <div className="mt-2" aria-live="polite">
          <div className="rounded-xl bg-white/80 p-3 ring-1 ring-violet-200/70 dark:bg-black/20 dark:ring-violet-400/15">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-300/60">Likely key</p>
                <p className="text-lg font-black text-violet-950 dark:text-white">{result.suggestions[0].label}</p>
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
                {result.confidence} confidence
              </span>
            </div>
            {result.confidence === 'low' && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">The melody was ambiguous, so test this result carefully before using it.</p>
            )}
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20">
              <p className="font-bold">Verify before saving</p>
              <p className="mt-0.5">Play the suggested key on your instrument and sing the chorus once. Adjust it manually if it does not feel right for your voice.</p>
            </div>
            <button
              type="button"
              onClick={() => onApply(result.suggestions[0].key)}
              className="mt-3 min-h-11 w-full rounded-xl bg-violet-600 px-3 text-sm font-black text-white transition-colors hover:bg-violet-700"
              aria-label={`Use ${result.suggestions[0].label}`}
            >
              Use {result.suggestions[0].key}
            </button>
          </div>
          <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-200">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-2" role="alert">
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20">{errorMessage}</p>
          <button type="button" onClick={reset} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-200">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
