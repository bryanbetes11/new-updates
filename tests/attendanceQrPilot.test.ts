import assert from 'node:assert/strict';
import { buildAttendanceQrPayload, parseAttendanceQrPayload } from '../src/lib/attendanceQrPilot';

const token = '24af8b33-9fd6-4af8-83ab-b2b30ee68367';

assert.equal(parseAttendanceQrPayload(buildAttendanceQrPayload(token)), token);
assert.equal(parseAttendanceQrPayload(`  ${buildAttendanceQrPayload(token)}  `), token);
assert.equal(parseAttendanceQrPayload(token), null);
assert.equal(parseAttendanceQrPayload('https://example.com/attendance'), null);
assert.equal(parseAttendanceQrPayload('servesync://attendance/checkpoint/not-a-token'), null);
