export interface DetectedPitchFrame {
  midi: number;
  clarity: number;
}

export interface PitchDetection {
  frequency: number;
  midi: number;
  clarity: number;
  note: string;
}

export interface KeySuggestion {
  key: string;
  label: string;
  score: number;
}

export interface KeyInference {
  suggestions: KeySuggestion[];
  confidence: 'high' | 'medium' | 'low';
  detectedNoteCount: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function midiToNoteName(midi: number) {
  const roundedMidi = Math.round(midi);
  const pitchClass = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/**
 * Lightweight normalized-autocorrelation pitch tracking for a single,
 * unaccompanied voice. It intentionally rejects weak/unclear frames instead
 * of returning a confident-looking note for room noise.
 */
export function detectMonophonicPitch(
  samples: Float32Array,
  sampleRate: number,
  minimumFrequency = 75,
  maximumFrequency = 1000,
): PitchDetection | null {
  if (samples.length < 32 || sampleRate <= 0) return null;

  let mean = 0;
  for (let index = 0; index < samples.length; index += 1) mean += samples[index];
  mean /= samples.length;

  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = samples[index] - mean;
    energy += centered * centered;
  }
  const rms = Math.sqrt(energy / samples.length);
  if (rms < 0.008) return null;

  const minimumLag = Math.max(2, Math.floor(sampleRate / maximumFrequency));
  const maximumLag = Math.min(samples.length - 3, Math.ceil(sampleRate / minimumFrequency));
  const correlations = new Float32Array(maximumLag + 1);
  let strongestCorrelation = -1;
  let strongestLag = -1;

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    const comparisonLength = samples.length - lag;

    for (let index = 0; index < comparisonLength; index += 1) {
      const left = samples[index] - mean;
      const right = samples[index + lag] - mean;
      correlation += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }

    const normalized = leftEnergy > 0 && rightEnergy > 0
      ? correlation / Math.sqrt(leftEnergy * rightEnergy)
      : 0;
    correlations[lag] = normalized;

    if (normalized > strongestCorrelation) {
      strongestCorrelation = normalized;
      strongestLag = lag;
    }
  }

  if (strongestLag < 0 || strongestCorrelation < 0.72) return null;

  // Prefer the earliest strong local peak to reduce octave/subharmonic errors.
  const strongPeakThreshold = Math.max(0.72, strongestCorrelation * 0.9);
  let selectedLag = strongestLag;
  for (let lag = minimumLag + 1; lag < strongestLag; lag += 1) {
    if (
      correlations[lag] >= strongPeakThreshold
      && correlations[lag] >= correlations[lag - 1]
      && correlations[lag] >= correlations[lag + 1]
    ) {
      selectedLag = lag;
      break;
    }
  }

  const previous = correlations[selectedLag - 1] || correlations[selectedLag];
  const current = correlations[selectedLag];
  const next = correlations[selectedLag + 1] || correlations[selectedLag];
  const denominator = previous - 2 * current + next;
  const adjustment = Math.abs(denominator) > 1e-6
    ? clamp(0.5 * (previous - next) / denominator, -0.5, 0.5)
    : 0;
  const refinedLag = selectedLag + adjustment;
  const frequency = sampleRate / refinedLag;
  const midi = frequencyToMidi(frequency);

  return {
    frequency,
    midi,
    clarity: clamp(current, 0, 1),
    note: midiToNoteName(midi),
  };
}

function profileForTonic(profile: number[], tonic: number) {
  return Array.from({ length: 12 }, (_, pitchClass) => profile[(pitchClass - tonic + 12) % 12]);
}

export function inferKeyFromPitchFrames(frames: DetectedPitchFrame[]): KeyInference | null {
  const usableFrames = frames.filter(frame => Number.isFinite(frame.midi) && frame.clarity >= 0.72);
  if (usableFrames.length < 12) return null;

  const histogram = Array.from({ length: 12 }, () => 0);
  usableFrames.forEach(frame => {
    const pitchClass = ((Math.round(frame.midi) % 12) + 12) % 12;
    histogram[pitchClass] += 0.5 + frame.clarity;
  });

  // The end of a sung phrase often carries the strongest tonic clue.
  const endingFrames = usableFrames.slice(-Math.min(10, usableFrames.length));
  const endingCounts = Array.from({ length: 12 }, () => 0);
  endingFrames.forEach(frame => {
    const pitchClass = ((Math.round(frame.midi) % 12) + 12) % 12;
    endingCounts[pitchClass] += frame.clarity;
  });
  const endingPitchClass = endingCounts.indexOf(Math.max(...endingCounts));
  histogram[endingPitchClass] += Math.max(2, usableFrames.length * 0.08);

  const candidates: KeySuggestion[] = [];
  for (let tonic = 0; tonic < 12; tonic += 1) {
    candidates.push({
      key: NOTE_NAMES[tonic],
      label: `${NOTE_NAMES[tonic]} major`,
      score: cosineSimilarity(histogram, profileForTonic(MAJOR_PROFILE, tonic)),
    });
  }

  candidates.sort((left, right) => right.score - left.score);
  const scoreMargin = candidates[0].score - candidates[1].score;
  const suggestions = candidates.slice(0, 1);
  const distinctPitchClasses = histogram.filter(value => value > 0).length;
  const confidence = usableFrames.length >= 60 && distinctPitchClasses >= 5 && scoreMargin >= 0.055
    ? 'high'
    : usableFrames.length >= 28 && distinctPitchClasses >= 4 && scoreMargin >= 0.025
      ? 'medium'
      : 'low';

  return { suggestions, confidence, detectedNoteCount: usableFrames.length };
}
