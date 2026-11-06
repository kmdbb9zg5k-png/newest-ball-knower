import { Capacitor } from '@capacitor/core';
import { NativeAuthSession } from '@ball-knower/native-auth-session';

function pulseBrowser() {
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.([80, 60, 120]);
  } catch { /* Feedback must never interrupt a GM decision. */ }
}

/** Start feedback without making alert presentation or decisions await it. */
export function pulseGmEvent(): void {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      // Older installed binaries may have the auth plugin without this method.
      void NativeAuthSession.notifyGmEvent().catch(pulseBrowser);
      return;
    }
  } catch { /* Missing bridges and synchronous native failures use the fallback. */ }
  pulseBrowser();
}
