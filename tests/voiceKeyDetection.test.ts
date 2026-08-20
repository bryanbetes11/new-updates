import {
  detectMonophonicPitch,
  frequencyToMidi,
  inferKeyFromPitchFrames,
  midiToNoteName,
  type DetectedPitchFrame,
} from '../src/lib/voiceKeyDetection';

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function framesForNotes(notes: number[]): DetectedPitchFrame[] {
  return notes.flatMap(midi => Array.from({ length: 10 }, () => ({ midi, clarity: 0.94 })));
}

expect(Math.abs(frequencyToMidi(440) - 69) < 0.001, 'converts A440 to MIDI 69');
expect(midiToNoteName(69) === 'A4', 'formats MIDI note names with octave');

const sampleRate = 48000;
const sineWave = Float32Array.from({ length: 4096 }, (_, index) => Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 0.4);
const detectedPitch = detectMonophonicPitch(sineWave, sampleRate);
expect(detectedPitch !== null, 'detects a clean monophonic tone');
expect(Math.abs((detectedPitch?.frequency || 0) - 220) < 2, 'detects A3 within two hertz');
expect(detectedPitch?.note === 'A3', 'labels the detected A3 note');

const silence = new Float32Array(4096);
expect(detectMonophonicPitch(silence, sampleRate) === null, 'rejects silence');

const cMajor = inferKeyFromPitchFrames(framesForNotes([60, 64, 67, 71, 69, 62, 67, 64, 60]));
expect(cMajor !== null, 'infers a key from enough clear notes');
expect(cMajor?.suggestions.some(suggestion => suggestion.key === 'C') === true, 'ranks C major among the top suggestions');
expect(cMajor?.suggestions.length === 1, 'returns one best-match key');
expect(cMajor?.suggestions.every(suggestion => !suggestion.key.endsWith('m')) === true, 'returns major-key suggestions only');

const minorLeaningPhrase = inferKeyFromPitchFrames(framesForNotes([69, 72, 76, 79, 68, 69]));
expect(minorLeaningPhrase?.suggestions.every(suggestion => !suggestion.key.endsWith('m')) === true, 'never exposes minor keys for a minor-leaning melody');

const tooShort = inferKeyFromPitchFrames(framesForNotes([60]));
expect(tooShort === null, 'rejects recordings with too few detected frames');
