import { Capacitor, registerPlugin } from '@capacitor/core';
import { createSerializedScreenAwakeSetter } from './screenAwakeLease';

const screenAwake = registerPlugin<{ setEnabled(options: { enabled: boolean }): Promise<void> }>('ScreenAwake');
const sendScreenAwake = createSerializedScreenAwakeSetter(enabled => screenAwake.setEnabled({ enabled }));

export function isNativeAndroidScreenAwake() {
  return Capacitor.getPlatform() === 'android';
}

export function setNativeScreenAwake(enabled: boolean) {
  return sendScreenAwake(enabled);
}
