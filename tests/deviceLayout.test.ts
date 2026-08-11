import { isIpadLayoutDevice } from '../src/lib/device';

function expectEqual(actual: boolean, expected: boolean, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

expectEqual(isIpadLayoutDevice({
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',
  platform: 'iPad',
  maxTouchPoints: 5,
  screenWidth: 1366,
  screenHeight: 1024,
}), true, 'detects an iPad user agent');

expectEqual(isIpadLayoutDevice({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  screenWidth: 1180,
  screenHeight: 820,
}), true, 'detects an iPad requesting a desktop website');

expectEqual(isIpadLayoutDevice({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
  platform: 'MacIntel',
  maxTouchPoints: 0,
  screenWidth: 1440,
  screenHeight: 900,
}), false, 'does not classify a Mac as an iPad');

expectEqual(isIpadLayoutDevice({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  platform: 'iPhone',
  maxTouchPoints: 5,
  screenWidth: 430,
  screenHeight: 932,
}), false, 'does not classify a phone as an iPad');
