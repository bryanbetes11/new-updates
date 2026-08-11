export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

interface IpadLayoutSignals {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  screenWidth: number;
  screenHeight: number;
}

export function isIpadLayoutDevice(signals: IpadLayoutSignals) {
  const shortestScreenSide = Math.min(signals.screenWidth, signals.screenHeight);
  return shortestScreenSide > 600 && (
    /iPad/i.test(signals.userAgent)
    || (signals.platform === 'MacIntel' && signals.maxTouchPoints > 1)
  );
}

export function initializeDeviceLayout() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isIpadPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('device') === 'ipad';
  const isIpad = isIpadPreview || isIpadLayoutDevice({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  });

  document.documentElement.dataset.ipadLayout = isIpad ? 'true' : 'false';
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function hasBottomSafeAreaInset() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.bottom = '0';
  probe.style.height = '0';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
  document.body.appendChild(probe);

  const inset = Number.parseFloat(window.getComputedStyle(probe).paddingBottom || '0');
  probe.remove();

  return inset > 0;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && Boolean((window.navigator as unknown as { standalone?: boolean }).standalone));
}

export function getMobilePlatform(): 'ios' | 'android' | 'other' {
  if (isIosDevice()) return 'ios';
  if (isAndroidDevice()) return 'android';
  return 'other';
}
