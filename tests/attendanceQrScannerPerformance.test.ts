import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scannerSource = readFileSync(
  new URL('../src/pages/AttendanceQrScanner.tsx', import.meta.url),
  'utf8',
);
const manifest = readFileSync(
  new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);

assert.match(scannerSource, /maxScansPerSecond:\s*10/);
assert.match(scannerSource, /highlightScanRegion:\s*false/);
assert.match(scannerSource, /highlightCodeOutline:\s*false/);

const pauseIndex = scannerSource.indexOf("scannerRef.current?.pause(true)");
const validationIndex = scannerSource.indexOf("validate_qr_attendance_checkpoint");
assert.ok(pauseIndex >= 0 && pauseIndex < validationIndex, 'camera decoding pauses before server validation');

const scheduleIndex = scannerSource.indexOf('setEvents(scannedEvents)');
const artworkIndex = scannerSource.indexOf(".from('events')", scheduleIndex);
assert.ok(scheduleIndex >= 0 && artworkIndex > scheduleIndex, 'verified schedule renders before decorative artwork loads');

const validationStart = scannerSource.indexOf('const validateScan');
const scannerStart = scannerSource.indexOf('const startScanner');
const validationSource = scannerSource.slice(validationStart, scannerStart);
assert.doesNotMatch(validationSource, /playInteractionSound\('scanSuccess'\)/);
assert.match(scannerSource, /Your attendance has not been recorded yet\./);

assert.match(manifest, /<uses-permission android:name="android\.permission\.CAMERA"\s*\/>/);
