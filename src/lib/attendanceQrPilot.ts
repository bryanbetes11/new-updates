export const ATTENDANCE_QR_PREFIX = 'servesync://attendance/checkpoint/';

export function buildAttendanceQrPayload(token: string): string {
  return `${ATTENDANCE_QR_PREFIX}${token}`;
}

export function parseAttendanceQrPayload(payload: string): string | null {
  const value = payload.trim();
  if (!value.startsWith(ATTENDANCE_QR_PREFIX)) return null;

  const token = value.slice(ATTENDANCE_QR_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
    ? token
    : null;
}
