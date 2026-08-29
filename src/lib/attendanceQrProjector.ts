export const ATTENDANCE_QR_PROJECTOR_WIDTH = 1920;
export const ATTENDANCE_QR_PROJECTOR_HEIGHT = 1080;

type AttendanceQrProjectorMode = 'live' | 'test';

interface AttendanceQrProjectorOptions {
  qrImage: string;
  mode: AttendanceQrProjectorMode;
  churchName?: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load projector image asset: ${src}`));
    image.src = src;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawStep(
  context: CanvasRenderingContext2D,
  number: string,
  label: string,
  x: number,
  y: number,
  accent: string,
) {
  context.fillStyle = accent;
  context.beginPath();
  context.arc(x + 28, y + 28, 28, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#07110d';
  context.font = '800 26px Inter, ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(number, x + 28, y + 29);

  context.fillStyle = '#edf5f1';
  context.font = '650 34px Inter, ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText(label, x + 80, y + 30);
}

export async function createAttendanceQrProjectorPng({
  qrImage,
  mode,
  churchName,
}: AttendanceQrProjectorOptions): Promise<string> {
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = ATTENDANCE_QR_PROJECTOR_WIDTH;
  canvas.height = ATTENDANCE_QR_PROJECTOR_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available for the attendance QR export.');

  const live = mode === 'live';
  const accent = live ? '#34d399' : '#fbbf24';
  const accentSoft = live ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 191, 36, 0.12)';

  const background = context.createLinearGradient(0, 0, ATTENDANCE_QR_PROJECTOR_WIDTH, ATTENDANCE_QR_PROJECTOR_HEIGHT);
  background.addColorStop(0, '#07110d');
  background.addColorStop(0.58, '#0b1712');
  background.addColorStop(1, '#101a16');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = accentSoft;
  context.beginPath();
  context.arc(1660, 130, 430, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(150, 1030, 310, 0, Math.PI * 2);
  context.fill();

  const [logo, qr] = await Promise.all([
    loadImage('/servesync-logo-latest.png'),
    loadImage(qrImage),
  ]);

  context.drawImage(logo, 112, 74, 54, 54);
  context.fillStyle = '#ffffff';
  context.font = '800 34px Inter, ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText('ServeSync', 184, 114);

  const badgeLabel = live ? 'Official Attendance' : 'Attendance Test';
  context.font = '800 28px Inter, ui-sans-serif, system-ui, sans-serif';
  const badgeWidth = Math.ceil(context.measureText(badgeLabel).width) + 64;
  context.fillStyle = live ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)';
  roundedRect(context, 112, 190, badgeWidth, 64, 32);
  context.fill();
  context.fillStyle = accent;
  context.fillText(badgeLabel, 144, 232);

  context.fillStyle = '#ffffff';
  context.font = '900 96px Inter, ui-sans-serif, system-ui, sans-serif';
  context.fillText('Scan to', 112, 370);
  context.fillText(live ? 'check in' : 'test check-in', 112, 472);

  context.fillStyle = '#c7d4ce';
  context.font = '650 39px Inter, ui-sans-serif, system-ui, sans-serif';
  context.fillText(churchName?.trim() || 'Your church attendance', 116, 536, 810);

  drawStep(context, '1', 'Open ServeSync', 116, 606, accent);
  drawStep(context, '2', 'Tap the QR scan button', 116, 696, accent);
  drawStep(context, '3', live ? 'Choose your event and tap Check In' : 'Choose the test event', 116, 786, accent);

  context.fillStyle = '#bdcbc4';
  context.font = '650 29px Inter, ui-sans-serif, system-ui, sans-serif';
  context.fillText(live ? 'Attendance is recorded only after you confirm your event.' : 'Test mode does not change official attendance records.', 116, 914, 820);

  context.fillStyle = '#ffffff';
  roundedRect(context, 1064, 112, 744, 856, 52);
  context.fill();

  context.fillStyle = '#07110d';
  context.font = '800 30px Inter, ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(live ? 'Scan Here' : 'Scan Test Code', 1436, 205);

  context.drawImage(qr, 1124, 248, 624, 624);

  context.fillStyle = live ? '#065f46' : '#92400e';
  context.font = '800 28px Inter, ui-sans-serif, system-ui, sans-serif';
  context.fillText(live ? 'Reusable Official Church Code' : 'Safe Isolated Test Code', 1436, 925);

  context.fillStyle = accent;
  context.fillRect(112, 1012, 68, 4);
  context.fillStyle = '#b5c3bc';
  context.font = '650 26px Inter, ui-sans-serif, system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText(live ? 'Serve with clarity. Check in with confidence.' : 'Preview and verify before using the live code.', 198, 1020);

  return canvas.toDataURL('image/png');
}
