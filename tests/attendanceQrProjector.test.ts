import assert from 'node:assert/strict';
import {
  ATTENDANCE_QR_PROJECTOR_HEIGHT,
  ATTENDANCE_QR_PROJECTOR_WIDTH,
} from '../src/lib/attendanceQrProjector';

assert.equal(ATTENDANCE_QR_PROJECTOR_WIDTH, 1920);
assert.equal(ATTENDANCE_QR_PROJECTOR_HEIGHT, 1080);
assert.equal(ATTENDANCE_QR_PROJECTOR_WIDTH / ATTENDANCE_QR_PROJECTOR_HEIGHT, 16 / 9);
