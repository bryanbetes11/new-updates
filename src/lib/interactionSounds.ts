export type InteractionSound = 'tap' | 'longPress' | 'reactionOpen' | 'reactionLand' | 'reactionRemove';

const STORAGE_KEY = 'servesync:interaction-sounds-enabled';
const VOLUME_STORAGE_KEY = 'servesync:interaction-sounds-volume';

let soundEffectsEnabled = true;
let soundEffectsVolume = 0.55;
let audioContext: AudioContext | null = null;
let fallbackAudio: HTMLAudioElement | null = null;
let fallbackUrl: string | null = null;
let lastSoundAt = Number.NEGATIVE_INFINITY;
let lastDedicatedSoundAt = Number.NEGATIVE_INFINITY;
let lastGlobalTapAt = Number.NEGATIVE_INFINITY;

const soundProfiles: Record<InteractionSound, {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}> = {
  tap: { frequency: 480, endFrequency: 560, duration: 0.034, gain: 0.026, type: 'sine' },
  longPress: { frequency: 260, endFrequency: 220, duration: 0.054, gain: 0.04, type: 'triangle' },
  reactionOpen: { frequency: 420, endFrequency: 520, duration: 0.04, gain: 0.026, type: 'sine' },
  reactionLand: { frequency: 580, endFrequency: 760, duration: 0.066, gain: 0.04, type: 'sine' },
  reactionRemove: { frequency: 320, endFrequency: 235, duration: 0.04, gain: 0.025, type: 'triangle' },
};

function canUseAudio() {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && document.visibilityState === 'visible';
}

function getVolumeMultiplier() {
  // Make the selectable levels meaningfully distinct: quiet remains subtle,
  // while the upper end is noticeably easier to hear in a busy environment.
  return 0.2 + soundEffectsVolume * 1.8;
}

function getAudioContext() {
  if (!canUseAudio()) return null;

  const AudioContextClass = window.AudioContext
    || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  audioContext ??= new AudioContextClass();
  return audioContext;
}

function createFallbackWav(profile: (typeof soundProfiles)[InteractionSound]) {
  const sampleRate = 22050;
  const sampleCount = Math.max(1, Math.floor(sampleRate * profile.duration));
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const frequency = profile.frequency + (profile.endFrequency - profile.frequency) * progress;
    const envelope = Math.sin(Math.PI * progress) ** 1.5;
    const sample = Math.sin(2 * Math.PI * frequency * index / sampleRate) * envelope * profile.gain * getVolumeMultiplier() * 4;
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function playFallbackTone(profile: (typeof soundProfiles)[InteractionSound]) {
  if (!canUseAudio() || typeof document.createElement !== 'function' || typeof URL.createObjectURL !== 'function') return;

  fallbackAudio ??= document.createElement('audio');
  if (!fallbackAudio.isConnected && document.body) {
    fallbackAudio.setAttribute('aria-hidden', 'true');
    fallbackAudio.style.display = 'none';
    document.body.appendChild(fallbackAudio);
  }
  fallbackAudio.preload = 'auto';
  fallbackAudio.volume = Math.max(0.05, soundEffectsVolume);
  const url = URL.createObjectURL(createFallbackWav(profile));
  if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
  fallbackUrl = url;
  fallbackAudio.src = url;
  fallbackAudio.currentTime = 0;
  void fallbackAudio.play().catch(() => undefined).finally(() => {
    window.setTimeout(() => {
      if (fallbackUrl !== url) return;
      URL.revokeObjectURL(url);
      fallbackUrl = null;
    }, 600);
  });
}

export function setInteractionSoundsEnabled(enabled: boolean) {
  soundEffectsEnabled = enabled;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  }
}

export function setInteractionSoundsVolume(volume: number) {
  soundEffectsVolume = Math.min(1, Math.max(0, volume));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(soundEffectsVolume));
  }
}

export function getInteractionSoundsVolume() {
  return soundEffectsVolume;
}

export function initializeInteractionSounds() {
  if (typeof window === 'undefined') return;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved !== null) soundEffectsEnabled = saved !== 'false';
  const savedVolume = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
  if (Number.isFinite(savedVolume)) setInteractionSoundsVolume(savedVolume);
}

export async function primeInteractionSounds() {
  if (!soundEffectsEnabled) return false;
  const context = getAudioContext();
  if (!context) return false;
  if (context.state !== 'suspended') return context.state === 'running';

  try {
    await context.resume();
    return true;
  } catch {
    // Browsers can decline audio until a direct user gesture. The next gesture retries.
    return false;
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  endFrequency: number,
  duration: number,
  gain: number,
  type: OscillatorType,
) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), now + duration);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gain * getVolumeMultiplier(), now + 0.006);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
}

export function playInteractionSound(sound: InteractionSound) {
  if (!soundEffectsEnabled || soundEffectsVolume <= 0) return;

  lastSoundAt = performance.now();
  if (sound !== 'tap') lastDedicatedSoundAt = lastSoundAt;
  const profile = soundProfiles[sound];
  const context = getAudioContext();
  if (!context) {
    playFallbackTone(profile);
    return;
  }

  const contextIsRunning = context.state === 'running';
  if (!contextIsRunning) {
    // Play the native fallback while the browser negotiates Web Audio permission.
    // This keeps the first user gesture audible in restrictive webviews.
    playFallbackTone(profile);
    void primeInteractionSounds();
    return;
  }

  playTone(context, profile.frequency, profile.endFrequency, profile.duration, profile.gain, profile.type);
}

export function playGlobalClickSound() {
  const now = performance.now();
  // Avoid a second generic tap when a control has its own richer feedback,
  // while still acknowledging quick intentional navigation changes.
  if (now - lastDedicatedSoundAt < 95 || now - lastGlobalTapAt < 42) return;
  lastGlobalTapAt = now;
  playInteractionSound('tap');
}
